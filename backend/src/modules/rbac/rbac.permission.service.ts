import { db, adminDb } from '../../core/db';
import { authUserRoles, authRoles, authRolePermissions, sessions, companies } from '@app/schema/tables';
import { eq, and } from '@app/schema';
import { redis } from '../../core/cache/redis';
import { cacheService } from '../../core/cache';
import { DomainError } from '../../core/errors';
import { broadcastToUser } from '../../core/sse/events';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { SYSTEM_ROLES } from '@app/schema/enums';

// ============================================
// USER PERMISSION QUERIES (CACHED)
// ============================================

/**
 * Get all roles for a user (cached per tenant)
 */
export async function getUserRoles(userId: string | number, companyId: number): Promise<string[]> {
    const userIdStr = String(userId);
    const cacheKey = `rbac:roles:${userIdStr}:${companyId}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const conditions = [
            eq(authUserRoles.user_id, userIdStr),
            eq(authUserRoles.company_id, companyId),
        ];

        const userRoles = await adminDb
            .select({ roleName: authRoles.name })
            .from(authUserRoles)
            .innerJoin(authRoles, and(
                eq(authUserRoles.role_id, authRoles.id),
                eq(authUserRoles.company_id, authRoles.company_id),
            ))
            .where(and(...conditions));

        if (userRoles.length > 0) {
            return userRoles.map(r => r.roleName);
        }

        return [];
    }, 120);
}

/**
 * Get all permissions for a user based on their roles (cached per tenant)
 * Optimized: Single query with JOIN
 */
export async function getUserPermissions(userId: string | number, companyId: number): Promise<string[]> {
    const userIdStr = String(userId);
    const cacheKey = `rbac:permissions:${userIdStr}:${companyId}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const conditions = [
            eq(authUserRoles.user_id, userIdStr),
            eq(authUserRoles.company_id, companyId),
        ];

        const result = await adminDb
            .selectDistinct({ slug: authRolePermissions.permission_slug })
            .from(authUserRoles)
            .innerJoin(authRolePermissions, and(
                eq(authUserRoles.role_id, authRolePermissions.role_id),
                eq(authUserRoles.company_id, authRolePermissions.company_id),
            ))
            .where(and(...conditions));

        return result.map(r => r.slug);
    }, 120);
}

/**
 * User Auth Context (Roles + Permissions combined in a single cached payload).
 * Reduces Redis roundtrips from 2 to 1 on every authenticated request.
 */
export interface UserAuthContext {
    roles: string[];
    permissions: string[];
}

export async function getUserAuthContext(userId: string | number, companyId: number): Promise<UserAuthContext> {
    const userIdStr = String(userId);
    const cacheKey = `rbac:auth_ctx:${userIdStr}:${companyId}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const roles = await getUserRoles(userId, companyId);
        
        const permissions = await getUserPermissions(userId, companyId);

        return { roles, permissions };
    }, 120);
}

/**
 * Invalidate RBAC cache for a user — direct DEL (O(1) vs SCAN O(N))
 */
export async function invalidateUserRbacCache(userId: string | number, companyId: number): Promise<void> {
    const userIdStr = String(userId);
    try {
        const keysToDelete = [
            `rbac:roles:${userIdStr}:${companyId}`,
            `rbac:permissions:${userIdStr}:${companyId}`,
            `rbac:auth_ctx:${userIdStr}:${companyId}`,
        ];
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
    const activeSessions = await adminDb
        .select({ id: sessions.id, token: sessions.token })
        .from(sessions)
        .where(eq(sessions.userId, userIdStr));

    if (activeSessions.length > 0) {
        await adminDb.delete(sessions).where(eq(sessions.userId, userIdStr));
        const keysToDelete = [
            `active-sessions-${userIdStr}`,
            ...activeSessions.flatMap(s => [
                s.token,
                `session:${s.token}`,
                `better-auth:session:${s.token}`,
                `session:${s.id}`,
            ]),
        ];
        await redis.del(...keysToDelete);
        for (const s of activeSessions) {
            broadcastToUser(userIdStr, RealtimeEvents.USER.SESSION_REVOKED, { id: userId, sessionId: s.id });
        }
    } else {
        await redis.del(`active-sessions-${userIdStr}`).catch(() => {});
    }
}

/**
 * Checks if a user has the superadmin role in the given company context (or globally).
 */
export async function isUserSuperadmin(userId: string | number, companyId: number): Promise<boolean> {
    const roles = await getUserRoles(userId, companyId);
    return roles.includes(SYSTEM_ROLES.SUPERADMIN);
}

/**
 * Guard: throws 403 if userId is the superadmin / owner of the company.
 * In a multi-tenant SaaS, each organization has exactly 1 immutable superadmin (the owner).
 * The superadmin can NEVER be deactivated, deleted, or stripped of their role.
 */
export async function assertNotSuperadmin(
    userId: string | number,
    companyId: number,
    action: string = 'modificar'
): Promise<void> {
    const isSuper = await isUserSuperadmin(userId, companyId);
    if (isSuper) {
        throw new DomainError(`No se puede ${action} al Superadmin / Propietario de la empresa`, 403);
    }
}

/**
 * Returns the highest role priority held by a user in a company.
 * Superadmin is always treated as >= 100 even if legacy DB rows had priority = 0.
 */
export async function getUserMaxRolePriority(userId: string | number, companyId: number): Promise<number> {
    const userIdStr = String(userId);
    const rows = await adminDb
        .select({ name: authRoles.name, priority: authRoles.priority })
        .from(authUserRoles)
        .innerJoin(authRoles, and(
            eq(authUserRoles.role_id, authRoles.id),
            eq(authUserRoles.company_id, authRoles.company_id),
        ))
        .where(and(
            eq(authUserRoles.user_id, userIdStr),
            eq(authUserRoles.company_id, companyId),
        ));

    let maxPriority = -1;
    for (const row of rows) {
        let p = row.priority ?? 0;
        if (row.name === SYSTEM_ROLES.SUPERADMIN) p = Math.max(p, 100);
        else if (row.name === SYSTEM_ROLES.ADMIN) p = Math.max(p, 80);
        if (p > maxPriority) maxPriority = p;
    }
    return maxPriority;
}

/**
 * Effective priority of a role row (handles legacy rows whose priority may still be 0).
 */
export function getEffectiveRolePriority(role: { name: string; priority?: number | null }): number {
    let p = role.priority ?? 0;
    if (role.name === SYSTEM_ROLES.SUPERADMIN) p = Math.max(p, 100);
    else if (role.name === SYSTEM_ROLES.ADMIN) p = Math.max(p, 80);
    return p;
}

/**
 * Ensures the caller is allowed to manage (edit/delete/assign/update permissions of) a target role.
 * - Superadmin can manage any non-superadmin role.
 * - Non-superadmin cannot manage system roles (superadmin, admin, contador) nor any role with priority >= their own.
 */
export async function assertCanManageRole(
    callerUserId: string | number,
    targetRole: { id: number; name: string; is_system?: boolean | null; priority?: number | null },
    companyId: number,
    action: string = 'gestionar'
): Promise<void> {
    const callerIsSuper = await isUserSuperadmin(callerUserId, companyId);
    if (callerIsSuper) {
        return;
    }

    const isProtectedSystem = targetRole.is_system === true
        || targetRole.name === SYSTEM_ROLES.SUPERADMIN
        || targetRole.name === SYSTEM_ROLES.ADMIN
        || targetRole.name === SYSTEM_ROLES.CONTADOR;
    if (isProtectedSystem) {
        throw new DomainError(`Solo el Superadmin puede ${action} el rol de sistema '${targetRole.name}'`, 403);
    }

    const callerMaxPriority = await getUserMaxRolePriority(callerUserId, companyId);
    const targetPriority = getEffectiveRolePriority(targetRole);
    if (targetPriority >= callerMaxPriority) {
        throw new DomainError(`No tienes jerarquía suficiente para ${action} el rol '${targetRole.name}'`, 403);
    }
}

/**
 * Ensures the caller has strictly higher role hierarchy than the target user in the company.
 * Prevents non-superadmins from modifying/deactivating/resetting superadmin or peers of equal/higher rank.
 */
export async function assertCanManageTargetUser(
    callerUserId: string | number,
    targetUserId: string | number,
    companyId: number,
    action: string = 'gestionar'
): Promise<void> {
    if (String(callerUserId) === String(targetUserId)) {
        return;
    }
    const callerIsSuper = await isUserSuperadmin(callerUserId, companyId);
    if (callerIsSuper) {
        return;
    }

    const targetIsSuper = await isUserSuperadmin(targetUserId, companyId);
    if (targetIsSuper) {
        throw new DomainError(`No se puede ${action} al Superadmin / Propietario de la empresa`, 403);
    }

    const [callerMaxPriority, targetMaxPriority] = await Promise.all([
        getUserMaxRolePriority(callerUserId, companyId),
        getUserMaxRolePriority(targetUserId, companyId),
    ]);

    if (targetMaxPriority >= callerMaxPriority) {
        throw new DomainError(`No tienes jerarquía suficiente para ${action} a este usuario`, 403);
    }
}

/**
 * Revoke ONLY sessions belonging to a specific company/organization for a user.
 * Deletes from Postgres, purges raw Better Auth tokens in Redis, prunes active-sessions index, and broadcasts SSE.
 */
export async function revokeTenantUserSessions(userId: string | number, companyId: number): Promise<void> {
    const userIdStr = String(userId);
    const [company] = await adminDb
        .select({ organizationId: companies.organization_id })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

    if (!company?.organizationId) return;

    const tenantSessions = await adminDb
        .select({ id: sessions.id, token: sessions.token })
        .from(sessions)
        .where(and(
            eq(sessions.userId, userIdStr),
            eq(sessions.activeOrganizationId, company.organizationId),
        ));

    if (tenantSessions.length === 0) return;

    await adminDb
        .delete(sessions)
        .where(and(
            eq(sessions.userId, userIdStr),
            eq(sessions.activeOrganizationId, company.organizationId),
        ));

    const revokedTokens = new Set(tenantSessions.map(s => s.token));
    const keysToDelete = tenantSessions.flatMap(s => [
        s.token,
        `session:${s.token}`,
        `better-auth:session:${s.token}`,
        `session:${s.id}`,
    ]);
    await redis.del(...keysToDelete).catch(() => {});

    try {
        const activeListKey = `active-sessions-${userIdStr}`;
        const listRaw = await redis.get(activeListKey);
        if (listRaw) {
            const parsed = JSON.parse(listRaw) as Array<{ token: string; expiresAt: number }>;
            const remaining = parsed.filter(entry => !revokedTokens.has(entry.token));
            if (remaining.length > 0) {
                const ttl = await redis.ttl(activeListKey);
                if (ttl > 0) {
                    await redis.set(activeListKey, JSON.stringify(remaining), 'EX', ttl);
                } else {
                    await redis.set(activeListKey, JSON.stringify(remaining));
                }
            } else {
                await redis.del(activeListKey);
            }
        }
    } catch { /* Redis best effort */ }

    for (const s of tenantSessions) {
        broadcastToUser(userIdStr, RealtimeEvents.USER.SESSION_REVOKED, { id: userIdStr, sessionId: s.id, companyId });
    }
}

/**
 * Invalidate cached user facets for a company.
 */
export async function invalidateUserFacetsCache(companyId: number): Promise<void> {
    await cacheService.invalidate(`rbac:facets:users:${companyId}:*`);
}

/**
 * Invalidate cached tenant roles list for a company.
 */
export async function invalidateRolesListCache(companyId: number): Promise<void> {
    await cacheService.del(`rbac:roles:list:${companyId}`);
}

/**
 * Invalidate all RBAC caches across an entire company (e.g. after a SaaS plan change).
 */
export async function invalidateCompanyRbacCache(companyId: number): Promise<void> {
    await Promise.all([
        cacheService.invalidate(`rbac:roles:*:${companyId}`),
        cacheService.invalidate(`rbac:permissions:*:${companyId}`),
        cacheService.invalidate(`rbac:auth_ctx:*:${companyId}`),
        cacheService.invalidate(`rbac:facets:users:${companyId}:*`),
        cacheService.del(`rbac:roles:list:${companyId}`),
    ]);
}
