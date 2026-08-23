import { db, adminDb } from '../../core/db';
import { authUserRoles, authRoles, authUsers, sessions, member, companies } from '@app/schema/tables';
import { eq, sql, count, and } from '@app/schema';
import { redis } from '../../core/cache/redis';
import { cacheService } from '../../core/cache';
import { DomainError } from '../../core/errors';
import { broadcast } from '../../core/sse/events';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { SYSTEM_ROLES } from '@app/schema/enums';

// ============================================
// USER PERMISSION QUERIES (CACHED)
// ============================================

/**
 * Get all roles for a user (cached per tenant)
 */
export async function getUserRoles(userId: string | number, companyId?: number | null): Promise<string[]> {
    const userIdStr = String(userId);
    const cacheKey = companyId ? `rbac:roles:${userIdStr}:${companyId}` : `rbac:roles:${userIdStr}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const conditions = [eq(authUserRoles.user_id, userIdStr)];
        if (companyId) {
            conditions.push(eq(authUserRoles.company_id, companyId));
        }

        const userRoles = await adminDb
            .select({ roleName: authRoles.name })
            .from(authUserRoles)
            .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
            .where(and(...conditions));

        if (userRoles.length > 0) {
            return userRoles.map(r => r.roleName);
        }

        // Fallback: check Better-Auth member table for owner role IN THIS SPECIFIC COMPANY CONTEXT
        if (companyId) {
            const [memberRow] = await adminDb
                .select({ role: member.role })
                .from(member)
                .innerJoin(companies, eq(companies.organization_id, member.organizationId))
                .where(and(eq(member.userId, userIdStr), eq(companies.id, companyId)))
                .limit(1);

            if (memberRow?.role === 'owner') {
                return ['superadmin'];
            }
        }

        return [];
    }, 300);
}

/**
 * Get all permissions for a user based on their roles (cached per tenant)
 * Optimized: Single query with JOIN
 */
export async function getUserPermissions(userId: string | number, companyId?: number | null): Promise<string[]> {
    const userIdStr = String(userId);
    const cacheKey = companyId ? `rbac:permissions:${userIdStr}:${companyId}` : `rbac:permissions:${userIdStr}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const companyFilter = companyId ? sql`AND ur.company_id = ${companyId}` : sql``;
        const result = await adminDb.execute(sql`
            SELECT DISTINCT ap.slug
            FROM auth_user_roles ur
            JOIN auth_role_permissions rp ON ur.role_id = rp.role_id
            JOIN auth_permissions ap ON rp.permission_id = ap.id
            WHERE ur.user_id = ${userIdStr}
            ${companyFilter}
        `);

        const perms = (result as unknown as { slug: string }[]).map(r => r.slug);
        if (perms.length > 0) return perms;

        // Fallback: if user is superadmin / owner, give full wildcard access
        const roles = await getUserRoles(userId, companyId);
        if (roles.includes(SYSTEM_ROLES.SUPERADMIN)) {
            return ['*'];
        }

        return [];
    }, 300);
}

/**
 * Invalidate RBAC cache for a user — direct DEL (O(1) vs SCAN O(N))
 */
export async function invalidateUserRbacCache(userId: string | number, companyId?: number | null): Promise<void> {
    const userIdStr = String(userId);
    try {
        const keysToDelete = [
            `rbac:roles:${userIdStr}`,
            `rbac:permissions:${userIdStr}`,
        ];
        if (companyId) {
            keysToDelete.push(`rbac:roles:${userIdStr}:${companyId}`, `rbac:permissions:${userIdStr}:${companyId}`);
        }
        await redis.del(...keysToDelete);

        // Usar adminDb — sessions de Better-Auth no tienen RLS, pero esta es una operación
        // administrativa que debe funcionar independientemente del contexto de tenant activo
        const activeSessions = await adminDb.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userIdStr));
        if (activeSessions.length > 0) {
            const sessionKeys = activeSessions.map(s => `session:${s.id}`);
            await redis.del(...sessionKeys);
        }
    } catch (error) {
        console.error('RBAC cache invalidation error:', error);
    }
}

/**
 * Revoke ALL sessions for a user — deletes from DB + Redis, broadcasts SSE.
 */
export async function revokeAllUserSessions(userId: string | number): Promise<void> {
    const userIdStr = String(userId);
    // Usar adminDb — operación administrativa, independiente del contexto de tenant
    const activeSessions = await adminDb.select({ id: sessions.id })
        .from(sessions).where(eq(sessions.userId, userIdStr));
    if (!activeSessions.length) return;
    await adminDb.delete(sessions).where(eq(sessions.userId, userIdStr));
    await redis.del(...activeSessions.map(s => `session:${s.id}`));
    for (const s of activeSessions) {
        broadcast(RealtimeEvents.USER.SESSION_REVOKED, { id: userId, sessionId: s.id }, `user:${userIdStr}`);
    }
}

/**
 * Guard: throws if userId is the last active superadmin.
 */
export async function ensureNotLastSuperadmin(userId: string | number): Promise<void> {
    const userIdStr = String(userId);
    const roles = await getUserRoles(userId);
    if (!roles.includes(SYSTEM_ROLES.SUPERADMIN)) return;
    // CRÍTICO: usar adminDb para evitar que RLS bloquee la query cuando no hay companyId en tenantStorage
    // Si db retorna count=0 por RLS → dejaría eliminar al último superadmin
    const [result] = await adminDb.select({ count: count() })
        .from(authUserRoles)
        .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
        .innerJoin(authUsers, eq(authUserRoles.user_id, authUsers.id))
        .where(and(eq(authRoles.name, SYSTEM_ROLES.SUPERADMIN), eq(authUsers.is_active, true)));
    if (Number(result.count) <= 1) {
        throw new DomainError('No se puede modificar al último superadmin activo', 403);
    }
}
