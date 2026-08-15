import { db } from '../../core/db';
import { authUserRoles, authRoles, authUsers, sessions } from '@app/schema/tables';
import { eq, sql, count, and } from '@app/schema';
import { redis } from '../../core/cache/redis';
import { cacheService } from '../../core/cache';
import { DomainError } from '../../core/errors';
import { broadcast } from '../../core/sse/sse';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { SYSTEM_ROLES } from '@app/schema/enums';

// ============================================
// USER PERMISSION QUERIES (CACHED)
// ============================================

/**
 * Get all roles for a user (cached)
 */
export async function getUserRoles(userId: number): Promise<string[]> {
    const cacheKey = `rbac:roles:${userId}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const userRoles = await db
            .select({ roleName: authRoles.name })
            .from(authUserRoles)
            .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
            .where(eq(authUserRoles.user_id, userId));

        return userRoles.map(r => r.roleName);
    }, 300);
}

/**
 * Get all permissions for a user based on their roles (cached)
 * Optimized: Single query with JOIN
 */
export async function getUserPermissions(userId: number): Promise<string[]> {
    const cacheKey = `rbac:permissions:${userId}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const result = await db.execute(sql`
            SELECT DISTINCT ap.slug
            FROM auth_user_roles ur
            JOIN auth_role_permissions rp ON ur.role_id = rp.role_id
            JOIN auth_permissions ap ON rp.permission_id = ap.id
            WHERE ur.user_id = ${userId}
        `);

        return (result as unknown as { slug: string }[]).map(r => r.slug);
    }, 300);
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(userId: number, requiredPermission: string): Promise<boolean> {
    const roles = await getUserRoles(userId);
    if (roles.includes(SYSTEM_ROLES.SUPERADMIN)) {
        return true;
    }
    const perms = await getUserPermissions(userId);
    return perms.includes(requiredPermission);
}

/**
 * Check if user has a specific role
 */
export async function hasRole(userId: number, requiredRole: string): Promise<boolean> {
    const roles = await getUserRoles(userId);
    return roles.includes(requiredRole);
}

/**
 * Get allowed module keys for a user based on permissions
 */
export async function getAllowedModules(userId: number): Promise<string[]> {
    const permissions = await getUserPermissions(userId);
    const roles = await getUserRoles(userId);

    if (roles.includes(SYSTEM_ROLES.SUPERADMIN)) {
        return ['*'];
    }

    const moduleKeys = new Set<string>();
    moduleKeys.add('dashboard');

    for (const perm of permissions) {
        const [module] = perm.split('.');
        if (module) {
            moduleKeys.add(module);
        }
    }

    return Array.from(moduleKeys);
}

/**
 * Invalidate RBAC cache for a user — direct DEL (O(1) vs SCAN O(N))
 */
export async function invalidateUserRbacCache(userId: number): Promise<void> {
    try {
        await redis.del(`rbac:roles:${userId}`, `rbac:permissions:${userId}`);

        const activeSessions = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.user_id, userId));
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
export async function revokeAllUserSessions(userId: number): Promise<void> {
    const activeSessions = await db.select({ id: sessions.id })
        .from(sessions).where(eq(sessions.user_id, userId));
    if (!activeSessions.length) return;
    await db.delete(sessions).where(eq(sessions.user_id, userId));
    await redis.del(...activeSessions.map(s => `session:${s.id}`));
    for (const s of activeSessions) {
        broadcast(RealtimeEvents.USER.SESSION_REVOKED, { id: userId, sessionId: s.id }, `user:${userId}`);
    }
}

/**
 * Guard: throws if userId is the last active superadmin.
 */
export async function ensureNotLastSuperadmin(userId: number): Promise<void> {
    const roles = await getUserRoles(userId);
    if (!roles.includes(SYSTEM_ROLES.SUPERADMIN)) return;
    const [result] = await db.select({ count: count() })
        .from(authUserRoles)
        .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
        .innerJoin(authUsers, eq(authUserRoles.user_id, authUsers.id))
        .where(and(eq(authRoles.name, SYSTEM_ROLES.SUPERADMIN), eq(authUsers.is_active, true)));
    if (Number(result.count) <= 1) {
        throw new DomainError('No se puede modificar al último superadmin activo', 403);
    }
}
