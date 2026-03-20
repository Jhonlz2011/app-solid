import { db } from '../db';
import { authUserRoles, authRoles, authRolePermissions, authPermissions, authUsers, authRoleHierarchy, authAuditLog, sessions, entities } from '@app/schema/tables';
import { eq, sql, count, and, inArray, ilike, or, asc, desc } from '@app/schema';
import { redis } from '../config/redis';
import { cacheService } from './cache.service';
import { DomainError } from './errors';
import { broadcast } from '../plugins/sse';
import { RealtimeEvents } from '@app/schema/realtime-events';
import type { AuditAction } from '@app/schema/enums';

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
        // Recursive CTE: resolves permissions from direct roles + inherited via hierarchy
        const result = await db.execute(sql`
            WITH RECURSIVE role_tree AS (
                -- Direct roles assigned to user
                SELECT role_id FROM auth_user_roles WHERE user_id = ${userId}
                UNION
                -- Inherited roles via hierarchy (child inherits parent permissions)
                SELECT rh.parent_role_id
                FROM auth_role_hierarchy rh
                JOIN role_tree rt ON rh.child_role_id = rt.role_id
            )
            SELECT DISTINCT ap.slug
            FROM role_tree rt
            JOIN auth_role_permissions rp ON rt.role_id = rp.role_id
            JOIN auth_permissions ap ON rp.permission_id = ap.id
        `);

        return (result as unknown as { slug: string }[]).map(r => r.slug);
    }, 300);
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(userId: number, requiredPermission: string): Promise<boolean> {
    const roles = await getUserRoles(userId);
    // Only superadmin bypasses all checks
    if (roles.includes('superadmin')) {
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

    if (roles.includes('superadmin')) {
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
    } catch (error) {
        console.error('RBAC cache invalidation error:', error);
    }
}

// ============================================
// ADMIN CRUD OPERATIONS
// ============================================

/**
 * Get all roles with user count
 */
export async function getAllRoles() {
    const roles = await db
        .select({
            id: authRoles.id,
            name: authRoles.name,
            description: authRoles.description,
        })
        .from(authRoles)
        .orderBy(authRoles.name);

    // Get user counts per role
    const userCounts = await db
        .select({
            roleId: authUserRoles.role_id,
            count: count(),
        })
        .from(authUserRoles)
        .groupBy(authUserRoles.role_id);

    const countMap = new Map(userCounts.map(uc => [uc.roleId, Number(uc.count)]));

    return roles.map(role => ({
        ...role,
        userCount: countMap.get(role.id) ?? 0,
    }));
}

/**
 * Create a new role
 */
export async function createRole(name: string, description?: string) {
    const existing = await db.query.authRoles.findFirst({
        where: eq(authRoles.name, name),
    });

    if (existing) {
        throw new DomainError('Ya existe un rol con ese nombre', 409);
    }

    const [role] = await db
        .insert(authRoles)
        .values({ name, description })
        .returning();

    return role;
}

/**
 * Update a role
 */
export async function updateRole(id: number, name: string, description?: string) {
    const [updated] = await db
        .update(authRoles)
        .set({ name, description })
        .where(eq(authRoles.id, id))
        .returning();

    if (!updated) {
        throw new DomainError('Rol no encontrado', 404);
    }

    return updated;
}

/**
 * Delete a role (with protection for system roles)
 */
export async function deleteRole(id: number) {
    const role = await db.query.authRoles.findFirst({
        where: eq(authRoles.id, id),
    });

    if (!role) {
        throw new DomainError('Rol no encontrado', 404);
    }

    if (role.is_system) {
        throw new DomainError('No se puede eliminar roles del sistema', 403);
    }

    await db.delete(authRoles).where(eq(authRoles.id, id));
    return { success: true };
}

/**
 * Get all permissions
 */
export async function getAllPermissions() {
    const permissions = await db
        .select()
        .from(authPermissions)
        .orderBy(authPermissions.slug);

    // Group by module
    const grouped: Record<string, typeof permissions> = {};
    for (const perm of permissions) {
        const [module] = perm.slug.split('.');
        if (!grouped[module]) {
            grouped[module] = [];
        }
        grouped[module].push(perm);
    }

    return {
        all: permissions,
        grouped,
    };
}

/**
 * Get permissions for a specific role
 */
export async function getRolePermissions(roleId: number) {
    const permissions = await db
        .select({
            id: authPermissions.id,
            slug: authPermissions.slug,
            description: authPermissions.description,
        })
        .from(authRolePermissions)
        .innerJoin(authPermissions, eq(authRolePermissions.permission_id, authPermissions.id))
        .where(eq(authRolePermissions.role_id, roleId));

    return permissions;
}

/**
 * Update permissions for a role
 */
export async function updateRolePermissions(roleId: number, permissionIds: number[]) {
    const role = await db.query.authRoles.findFirst({
        where: eq(authRoles.id, roleId),
    });

    if (!role) {
        throw new DomainError('Rol no encontrado', 404);
    }

    await db.transaction(async (tx) => {
        // Remove existing permissions
        await tx.delete(authRolePermissions).where(eq(authRolePermissions.role_id, roleId));

        // Add new permissions
        if (permissionIds.length > 0) {
            await tx.insert(authRolePermissions).values(
                permissionIds.map(permissionId => ({
                    role_id: roleId,
                    permission_id: permissionId,
                }))
            );
        }
    });

    // Invalidate cache for all users with this role — AWAIT to prevent race conditions
    const usersWithRole = await db
        .select({ userId: authUserRoles.user_id })
        .from(authUserRoles)
        .where(eq(authUserRoles.role_id, roleId));

    await Promise.all(usersWithRole.map(({ userId }) => invalidateUserRbacCache(userId)));

    return { success: true };
}

// ============================================
// USER LIST (PAGINATED) + SINGLE USER/ROLE
// ============================================

interface UsersListFilters {
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    isActive?: string[];
    roles?: string[];
}

const USERS_SORT_WHITELIST: Record<string, any> = {
    username: authUsers.username,
    email: authUsers.email,
    isActive: authUsers.is_active,
    lastLogin: authUsers.last_login,
};

/**
 * Get paginated users with their roles.
 * Returns { data, meta } matching the CacheShape pattern.
 */
export async function getAllUsersWithRoles(filters: UsersListFilters = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 15));
    const offset = (page - 1) * limit;

    // ── WHERE conditions ──
    const conditions = [];
    if (filters.search) {
        const term = `%${filters.search}%`;
        conditions.push(or(ilike(authUsers.username, term), ilike(authUsers.email, term)));
    }
    if (filters.isActive && filters.isActive.length > 0) {
        const boolValues = filters.isActive.map(v => v === 'true');
        if (boolValues.length === 1) {
            conditions.push(eq(authUsers.is_active, boolValues[0]));
        }
    }
    
    if (filters.roles && filters.roles.length > 0) {
        const rolesSubquery = db
            .select({ userId: authUserRoles.user_id })
            .from(authUserRoles)
            .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
            .where(inArray(authRoles.name, filters.roles));
            
        conditions.push(inArray(authUsers.id, rolesSubquery));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // ── ORDER BY ──
    const sortCol = filters.sortBy && USERS_SORT_WHITELIST[filters.sortBy]
        ? USERS_SORT_WHITELIST[filters.sortBy]
        : authUsers.username;
    const orderFn = filters.sortOrder === 'desc' ? desc : asc;

    // ── Parallel: count + page data ──
    const [totalResult, users] = await Promise.all([
        db.select({ count: count() }).from(authUsers).where(where),
        db.select({
            id: authUsers.id,
            username: authUsers.username,
            email: authUsers.email,
            isActive: authUsers.is_active,
            lastLogin: authUsers.last_login,
        })
        .from(authUsers)
        .where(where)
        .orderBy(orderFn(sortCol))
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const pageCount = Math.ceil(total / limit);

    // ── Roles for this page only ──
    const userIds = users.map(u => u.id);
    let roleMap = new Map<number, { id: number; name: string }[]>();

    if (userIds.length > 0) {
        const userRoles = await db
            .select({
                userId: authUserRoles.user_id,
                roleId: authRoles.id,
                roleName: authRoles.name,
            })
            .from(authUserRoles)
            .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
            .where(inArray(authUserRoles.user_id, userIds));

        for (const ur of userRoles) {
            if (!roleMap.has(ur.userId)) roleMap.set(ur.userId, []);
            roleMap.get(ur.userId)!.push({ id: ur.roleId, name: ur.roleName });
        }
    }

    return {
        data: users.map(user => ({
            ...user,
            roles: roleMap.get(user.id) ?? [],
        })),
        meta: {
            total,
            page,
            pageCount,
            hasNextPage: page < pageCount,
            hasPrevPage: page > 1,
        },
    };
}

/**
 * Get faceted filter values + counts for users (is_active, roles)
 */
export async function getUserFacets(filters: { search?: string; isActive?: string[]; roles?: string[] }) {
    const cacheKey = `rbac:facets:users:${JSON.stringify(filters)}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const results: Record<string, { value: string; count: number }[]> = {};

        // 1. is_active facet (exclude isActive filter)
        let activeConditions = [];
        if (filters.search) {
            const term = `%${filters.search}%`;
            activeConditions.push(or(ilike(authUsers.username, term), ilike(authUsers.email, term)));
        }
        if (filters.roles && filters.roles.length > 0) {
            const rolesSubquery = db
                .select({ userId: authUserRoles.user_id })
                .from(authUserRoles)
                .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
                .where(inArray(authRoles.name, filters.roles));
            activeConditions.push(inArray(authUsers.id, rolesSubquery));
        }
        const activeWhere = activeConditions.length > 0 ? and(...activeConditions) : undefined;
        
        const activeRows = await db
            .select({
                value: sql<string>`CAST(${authUsers.is_active} AS TEXT)`,
                count: count(),
            })
            .from(authUsers)
            .where(activeWhere)
            .groupBy(authUsers.is_active)
            .orderBy(desc(count()));
            
        results['is_active'] = activeRows.filter(r => r.value !== null).map(r => ({ value: r.value, count: Number(r.count) }));

        // 2. roles facet (exclude roles filter)
        let rolesConditions = [];
        if (filters.search) {
            const term = `%${filters.search}%`;
            rolesConditions.push(or(ilike(authUsers.username, term), ilike(authUsers.email, term)));
        }
        if (filters.isActive && filters.isActive.length > 0) {
            const boolValues = filters.isActive.map(v => v === 'true');
            if (boolValues.length === 1) {
                rolesConditions.push(eq(authUsers.is_active, boolValues[0]));
            }
        }
        const rolesWhere = rolesConditions.length > 0 ? and(...rolesConditions) : undefined;

        const rolesRows = await db
            .select({
                value: authRoles.name,
                count: sql<number>`count(DISTINCT ${authUsers.id})`.mapWith(Number),
            })
            .from(authUsers)
            .innerJoin(authUserRoles, eq(authUsers.id, authUserRoles.user_id))
            .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
            .where(rolesWhere)
            .groupBy(authRoles.name)
            .orderBy(desc(sql`count(DISTINCT ${authUsers.id})`));

        results['roles'] = rolesRows.filter(r => r.value !== null);

        return results;
    }, 120);
}

/**
 * Get a single user by ID with their roles
 */
export async function getUserById(id: number) {
    const user = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, id),
        columns: {
            id: true,
            username: true,
            email: true,
            is_active: true,
            last_login: true,
            entity_id: true,
        },
        with: { entity: true },
    });

    if (!user) throw new DomainError('Usuario no encontrado', 404);

    const roles = await db
        .select({ id: authRoles.id, name: authRoles.name, description: authRoles.description })
        .from(authUserRoles)
        .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
        .where(eq(authUserRoles.user_id, id));

    return {
        id: user.id,
        username: user.username,
        email: user.email,
        isActive: user.is_active,
        lastLogin: user.last_login,
        entityId: user.entity_id,
        entity: user.entity ? {
            id: user.entity.id,
            businessName: user.entity.business_name,
            taxId: user.entity.tax_id,
            isClient: user.entity.is_client ?? false,
            isSupplier: user.entity.is_supplier ?? false,
            isEmployee: user.entity.is_employee ?? false,
        } : null,
        roles,
    };
}

/**
 * Get a single role by ID with is_system, permissionCount, userCount
 */
export async function getRoleById(id: number) {
    const role = await db.query.authRoles.findFirst({
        where: eq(authRoles.id, id),
    });

    if (!role) throw new DomainError('Rol no encontrado', 404);

    const [permCount, userCount] = await Promise.all([
        db.select({ count: count() }).from(authRolePermissions).where(eq(authRolePermissions.role_id, id)),
        db.select({ count: count() }).from(authUserRoles).where(eq(authUserRoles.role_id, id)),
    ]);

    return {
        ...role,
        permissionCount: Number(permCount[0]?.count ?? 0),
        userCount: Number(userCount[0]?.count ?? 0),
    };
}

/**
 * Get roles for a specific user
 */
export async function getUserRolesById(userId: number) {
    const roles = await db
        .select({
            id: authRoles.id,
            name: authRoles.name,
            description: authRoles.description,
        })
        .from(authUserRoles)
        .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
        .where(eq(authUserRoles.user_id, userId));

    return roles;
}

/**
 * Assign roles to a user — with self-elevation protection
 */
export async function assignUserRoles(userId: number, roleIds: number[], currentUserId: number) {
    // SEC-BE-02: Prevent self-modification of roles
    if (userId === currentUserId) {
        throw new DomainError('No puedes modificar tus propios roles', 403);
    }

    const user = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, userId),
    });

    if (!user) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    // SEC-BE-02: Only superadmin can assign system roles
    if (roleIds.length > 0) {
        const currentRoles = await getUserRoles(currentUserId);
        if (!currentRoles.includes('superadmin')) {
            const systemRoles = await db.select({ id: authRoles.id })
                .from(authRoles)
                .where(and(
                    inArray(authRoles.id, roleIds),
                    eq(authRoles.is_system, true)
                ));
            if (systemRoles.length > 0) {
                throw new DomainError('Solo superadmin puede asignar roles de sistema', 403);
            }
        }
    }

    await db.transaction(async (tx) => {
        // Remove existing roles
        await tx.delete(authUserRoles).where(eq(authUserRoles.user_id, userId));

        // Add new roles
        if (roleIds.length > 0) {
            await tx.insert(authUserRoles).values(
                roleIds.map(roleId => ({
                    user_id: userId,
                    role_id: roleId,
                }))
            );
        }
    });

    // Invalidate cache
    await invalidateUserRbacCache(userId);

    return { success: true };
}

/**
 * Create a new user (admin function)
 */
export async function createUser(data: { username: string; email: string; password: string; roleIds?: number[] }) {
    // Check for existing user
    const existing = await db.query.authUsers.findFirst({
        where: eq(authUsers.email, data.email),
    });

    if (existing) {
        throw new DomainError('Ya existe un usuario con ese email', 409);
    }

    const existingUsername = await db.query.authUsers.findFirst({
        where: eq(authUsers.username, data.username),
    });

    if (existingUsername) {
        throw new DomainError('Ya existe un usuario con ese nombre de usuario', 409);
    }

    const password_hash = await Bun.password.hash(data.password);

    const [user] = await db
        .insert(authUsers)
        .values({
            username: data.username,
            email: data.email,
            password_hash,
            is_active: true,
        })
        .returning({ id: authUsers.id, username: authUsers.username, email: authUsers.email });

    // Assign roles if provided
    if (data.roleIds && data.roleIds.length > 0) {
        await db.insert(authUserRoles).values(
            data.roleIds.map(roleId => ({
                user_id: user.id,
                role_id: roleId,
            }))
        );
    }

    return user;
}

/**
 * Get all users with a specific role
 */
export async function getUsersByRole(roleId: number) {
    const usersInRole = await db
        .select({
            id: authUsers.id,
            username: authUsers.username,
            email: authUsers.email,
            isActive: authUsers.is_active,
        })
        .from(authUserRoles)
        .innerJoin(authUsers, eq(authUserRoles.user_id, authUsers.id))
        .where(eq(authUserRoles.role_id, roleId));

    return usersInRole;
}

/**
 * Remove a user from a specific role
 */
export async function removeUserFromRole(userId: number, roleId: number) {
    const deleted = await db
        .delete(authUserRoles)
        .where(and(
            eq(authUserRoles.user_id, userId),
            eq(authUserRoles.role_id, roleId)
        ))
        .returning();

    if (deleted.length === 0) {
        throw new DomainError('El usuario no tiene este rol', 404);
    }

    // Invalidate cache
    await invalidateUserRbacCache(userId);

    return { success: true };
}

/**
 * Update user details
 */
export async function updateUser(userId: number, data: { username?: string; email?: string; isActive?: boolean }) {
    // Check for existing email/username if changing
    if (data.email) {
        const existing = await db.query.authUsers.findFirst({
            where: sql`${authUsers.email} = ${data.email} AND ${authUsers.id} != ${userId}`,
        });

        if (existing) {
            throw new DomainError('Ya existe un usuario con ese email', 409);
        }
    }

    if (data.username) {
        const existing = await db.query.authUsers.findFirst({
            where: sql`${authUsers.username} = ${data.username} AND ${authUsers.id} != ${userId}`,
        });

        if (existing) {
            throw new DomainError('Ya existe un usuario con ese nombre de usuario', 409);
        }
    }

    const updateData: Partial<{ username: string; email: string; is_active: boolean }> = {};
    if (data.username !== undefined) updateData.username = data.username;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const [updated] = await db
        .update(authUsers)
        .set(updateData)
        .where(eq(authUsers.id, userId))
        .returning({ id: authUsers.id, username: authUsers.username, email: authUsers.email, isActive: authUsers.is_active });

    if (!updated) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    return updated;
}

/**
 * Deactivate a user (soft-delete) — preserves roles, only sets is_active = false.
 * Guards: self-deactivation, last superadmin protection.
 */
export async function deactivateUser(userId: number, currentUserId: number) {
    if (userId === currentUserId) {
        throw new DomainError('No puedes desactivar tu propia cuenta', 403);
    }

    const userRoles = await getUserRoles(userId);
    if (userRoles.includes('superadmin')) {
        const superadminCount = await db
            .select({ count: count() })
            .from(authUserRoles)
            .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
            .innerJoin(authUsers, eq(authUserRoles.user_id, authUsers.id))
            .where(and(
                eq(authRoles.name, 'superadmin'),
                eq(authUsers.is_active, true)
            ));
        if (Number(superadminCount[0].count) <= 1) {
            throw new DomainError('No se puede desactivar al último superadmin activo', 403);
        }
    }

    const [updated] = await db
        .update(authUsers)
        .set({ is_active: false })
        .where(eq(authUsers.id, userId))
        .returning();

    if (!updated) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    await invalidateUserRbacCache(userId);
    broadcast(RealtimeEvents.USER.SESSION_REVOKED, { userId }, `user:${userId}`);

    return { success: true };
}

/**
 * Backwards-compatible alias — delegates to deactivateUser.
 */
export async function deleteUser(userId: number, currentUserId: number) {
    return deactivateUser(userId, currentUserId);
}

/**
 * Restore a deactivated user — sets is_active = true (roles preserved).
 */
export async function restoreUser(userId: number, currentUserId: number) {
    if (userId === currentUserId) {
        throw new DomainError('No puedes restaurar tu propia cuenta', 403);
    }

    const [updated] = await db
        .update(authUsers)
        .set({ is_active: true })
        .where(eq(authUsers.id, userId))
        .returning();

    if (!updated) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    await invalidateUserRbacCache(userId);

    return { success: true };
}

/**
 * Hard delete (destroy) a user permanently — removes user, roles, sessions.
 * Requires `users.destroy` permission.
 */
export async function hardDeleteUser(userId: number, currentUserId: number) {
    if (userId === currentUserId) {
        throw new DomainError('No puedes destruir tu propia cuenta', 403);
    }

    const userRoles = await getUserRoles(userId);
    if (userRoles.includes('superadmin')) {
        const superadminCount = await db
            .select({ count: count() })
            .from(authUserRoles)
            .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
            .innerJoin(authUsers, eq(authUserRoles.user_id, authUsers.id))
            .where(and(
                eq(authRoles.name, 'superadmin'),
                eq(authUsers.is_active, true)
            ));
        if (Number(superadminCount[0].count) <= 1) {
            throw new DomainError('No se puede destruir al último superadmin', 403);
        }
    }

    // Remove roles
    await db.delete(authUserRoles).where(eq(authUserRoles.user_id, userId));

    // Kill active sessions
    const activeSessions = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.user_id, userId));

    if (activeSessions.length > 0) {
        await db.delete(sessions).where(eq(sessions.user_id, userId));
        await Promise.all(
            activeSessions.map(s => cacheService.invalidate(`session:${s.id}`))
        );
        for (const s of activeSessions) {
            broadcast(RealtimeEvents.USER.SESSION_REVOKED, { userId, sessionId: s.id }, `user:${userId}`);
        }
    }

    // Permanently delete the user
    const deleted = await db.delete(authUsers).where(eq(authUsers.id, userId)).returning();
    if (deleted.length === 0) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    await invalidateUserRbacCache(userId);

    return { success: true };
}

/**
 * Pre-flight check for hard delete — returns reference counts.
 */
export async function checkUserReferences(userId: number) {
    const user = await db.query.authUsers.findFirst({ where: eq(authUsers.id, userId) });
    if (!user) throw new DomainError('Usuario no encontrado', 404);

    const [rolesResult, sessionsResult, auditResult] = await Promise.all([
        db.select({ count: count() }).from(authUserRoles).where(eq(authUserRoles.user_id, userId)),
        db.select({ count: count() }).from(sessions).where(eq(sessions.user_id, userId)),
        db.select({ count: count() }).from(authAuditLog).where(eq(authAuditLog.user_id, userId)),
    ]);

    const roles = Number(rolesResult[0]?.count ?? 0);
    const activeSessions = Number(sessionsResult[0]?.count ?? 0);
    const auditLogs = Number(auditResult[0]?.count ?? 0);
    const total = roles + activeSessions + auditLogs;

    return { roles, activeSessions, auditLogs, total, canDelete: true };
}

// ============================================
// AUDIT LOGGING
// ============================================

/**
 * Log an RBAC mutation for audit trail
 */
export async function logAudit(
    userId: number,
    action: AuditAction,
    targetType: string,
    targetId?: number,
    details?: Record<string, unknown>,
    ipAddress?: string,
): Promise<void> {
    try {
        await db.insert(authAuditLog).values({
            user_id: userId,
            action,
            target_type: targetType,
            target_id: targetId ?? null,
            details: details ? JSON.stringify(details) : null,
            ip_address: ipAddress ?? null,
        });
    } catch (error) {
        console.error('Audit log error:', error);
    }
}

/**
 * Get paginated audit log for a specific user.
 * Returns entries where the user performed the action OR was the target.
 */
export async function getUserAuditLog(userId: number, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const [totalResult, entries] = await Promise.all([
        db.select({ count: sql<number>`count(*)`.mapWith(Number) })
            .from(authAuditLog)
            .where(or(
                eq(authAuditLog.user_id, userId),
                and(eq(authAuditLog.target_type, 'user'), eq(authAuditLog.target_id, userId))
            )),
        db.select({
            id: authAuditLog.id,
            action: authAuditLog.action,
            targetType: authAuditLog.target_type,
            targetId: authAuditLog.target_id,
            details: authAuditLog.details,
            ipAddress: authAuditLog.ip_address,
            createdAt: authAuditLog.created_at,
            performedBy: authAuditLog.user_id,
            performedByUsername: authUsers.username,
        })
            .from(authAuditLog)
            .leftJoin(authUsers, eq(authAuditLog.user_id, authUsers.id))
            .where(or(
                eq(authAuditLog.user_id, userId),
                and(eq(authAuditLog.target_type, 'user'), eq(authAuditLog.target_id, userId))
            ))
            .orderBy(desc(authAuditLog.created_at))
            .limit(limit)
            .offset(offset),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
        data: entries,
        meta: {
            total,
            page,
            pageCount: Math.ceil(total / limit),
            hasNextPage: page * limit < total,
            hasPrevPage: page > 1,
        },
    };
}

/**
 * Admin password reset — sets password without requiring old one.
 * Invalidates all sessions and logs to audit.
 */
export async function adminResetPassword(
    adminUserId: number,
    targetUserId: number,
    newPassword: string,
) {
    if (adminUserId === targetUserId) {
        throw new DomainError('Usa el cambio de contraseña personal para tu propia cuenta', 400);
    }

    const user = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, targetUserId),
    });
    if (!user) throw new DomainError('Usuario no encontrado', 404);

    const newHash = await Bun.password.hash(newPassword);
    await db.update(authUsers)
        .set({ password_hash: newHash })
        .where(eq(authUsers.id, targetUserId));

    // Invalidate all sessions for the target user
    const activeSessions = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.user_id, targetUserId));

    if (activeSessions.length > 0) {
        await db.delete(sessions).where(eq(sessions.user_id, targetUserId));
        await Promise.all(
            activeSessions.map(s => cacheService.invalidate(`session:${s.id}`))
        );
        for (const s of activeSessions) {
            broadcast(RealtimeEvents.USER.SESSION_REVOKED, { userId: targetUserId, sessionId: s.id }, `user:${targetUserId}`);
        }
    }

    await logAudit(adminUserId, 'user.updated', 'user', targetUserId, {
        field: 'password',
        action: 'admin_reset',
    });

    return { success: true };
}

/**
 * Assign or unassign an entity to a user.
 */
export async function setUserEntity(
    userId: number,
    entityId: number | null,
    adminUserId: number,
) {
    // Validate entity exists if assigning
    if (entityId !== null) {
        const entity = await db.query.entities.findFirst({
            where: eq(entities.id, entityId),
        });
        if (!entity) throw new DomainError('Entidad no encontrada', 404);
    }

    const [updated] = await db
        .update(authUsers)
        .set({ entity_id: entityId })
        .where(eq(authUsers.id, userId))
        .returning({ id: authUsers.id, entityId: authUsers.entity_id });

    if (!updated) throw new DomainError('Usuario no encontrado', 404);

    await logAudit(adminUserId, 'user.updated', 'user', userId, {
        field: 'entity_id',
        entityId,
    });

    return updated;
}

// ============================================
// ROLE HIERARCHY (Recursive RBAC)
// ============================================

/**
 * Get the full hierarchy tree for display
 */
export async function getRoleHierarchy() {
    return db
        .select({
            parentRoleId: authRoleHierarchy.parent_role_id,
            parentRoleName: sql<string>`p.name`,
            childRoleId: authRoleHierarchy.child_role_id,
            childRoleName: sql<string>`c.name`,
        })
        .from(authRoleHierarchy)
        .innerJoin(sql`auth_roles p`, sql`p.id = ${authRoleHierarchy.parent_role_id}`)
        .innerJoin(sql`auth_roles c`, sql`c.id = ${authRoleHierarchy.child_role_id}`);
}

/**
 * Add a parent→child hierarchy link with cycle detection
 */
export async function addRoleHierarchy(
    parentRoleId: number,
    childRoleId: number,
    currentUserId: number,
) {
    // Self-reference guard
    if (parentRoleId === childRoleId) {
        throw new DomainError('Un rol no puede ser su propio padre', 400);
    }

    // Cycle detection: check if childRoleId is already an ancestor of parentRoleId
    const cycleCheck = await db.execute(sql`
        WITH RECURSIVE ancestors AS (
            SELECT parent_role_id FROM auth_role_hierarchy WHERE child_role_id = ${parentRoleId}
            UNION
            SELECT rh.parent_role_id
            FROM auth_role_hierarchy rh
            JOIN ancestors a ON rh.child_role_id = a.parent_role_id
        )
        SELECT 1 FROM ancestors WHERE parent_role_id = ${childRoleId} LIMIT 1
    `);

    if ((cycleCheck as unknown as any[]).length > 0) {
        throw new DomainError('Esta asignación crearía un ciclo en la jerarquía', 400);
    }

    await db.insert(authRoleHierarchy).values({
        parent_role_id: parentRoleId,
        child_role_id: childRoleId,
    });

    // Invalidate permissions cache for all users with the child role
    const affectedUsers = await db
        .select({ userId: authUserRoles.user_id })
        .from(authUserRoles)
        .where(eq(authUserRoles.role_id, childRoleId));

    await Promise.all(affectedUsers.map(({ userId }) => invalidateUserRbacCache(userId)));

    await logAudit(currentUserId, 'hierarchy.added', 'hierarchy', undefined, {
        parentRoleId, childRoleId,
    });

    return { success: true };
}

/**
 * Remove a parent→child hierarchy link
 */
export async function removeRoleHierarchy(
    parentRoleId: number,
    childRoleId: number,
    currentUserId: number,
) {
    const deleted = await db
        .delete(authRoleHierarchy)
        .where(and(
            eq(authRoleHierarchy.parent_role_id, parentRoleId),
            eq(authRoleHierarchy.child_role_id, childRoleId),
        ))
        .returning();

    if (deleted.length === 0) {
        throw new DomainError('Relación de jerarquía no encontrada', 404);
    }

    // Invalidate cache for affected users
    const affectedUsers = await db
        .select({ userId: authUserRoles.user_id })
        .from(authUserRoles)
        .where(eq(authUserRoles.role_id, childRoleId));

    await Promise.all(affectedUsers.map(({ userId }) => invalidateUserRbacCache(userId)));

    await logAudit(currentUserId, 'hierarchy.removed', 'hierarchy', undefined, {
        parentRoleId, childRoleId,
    });

    return { success: true };
}

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * Batch deactivate (soft-delete) multiple users — preserves roles.
 */
export async function batchDeleteUsers(userIds: number[], currentUserId: number) {
    if (userIds.includes(currentUserId)) {
        throw new DomainError('No puedes desactivar tu propia cuenta', 403);
    }

    const results = [];
    for (const userId of userIds) {
        try {
            await deactivateUser(userId, currentUserId);
            results.push({ userId, success: true });
        } catch (error: any) {
            results.push({ userId, success: false, error: error.message });
        }
    }

    return results;
}

/**
 * Batch restore multiple deactivated users.
 */
export async function batchRestoreUsers(userIds: number[], currentUserId: number) {
    const results = [];
    for (const userId of userIds) {
        try {
            await restoreUser(userId, currentUserId);
            results.push({ userId, success: true });
        } catch (error: any) {
            results.push({ userId, success: false, error: error.message });
        }
    }

    return results;
}
