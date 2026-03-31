import { db } from '../db';
import { authUserRoles, authRoles, authRolePermissions, authPermissions, authUsers, auditLogs, sessions, entities } from '@app/schema/tables';
import { eq, sql, count, and, inArray, ilike, or, asc, desc } from '@app/schema';
import { redis } from '../config/redis';
import { cacheService } from './cache.service';
import { DomainError } from './errors';
import { broadcast } from '../plugins/sse';
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
    // Only superadmin bypasses all checks
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

        // Also invalidate all active sessions for this user so their new RBAC is reflected immediately
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
 * Extracted helper: used by adminResetPassword, hardDeleteUser.
 */
async function revokeAllUserSessions(userId: number): Promise<void> {
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
 * Extracted helper: used by deactivateUser, hardDeleteUser, batchDeleteUsers.
 */
async function ensureNotLastSuperadmin(userId: number): Promise<void> {
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
            is_system: authRoles.is_system,
        })
        .from(authRoles)
        .orderBy(authRoles.name);

    // Get user + permission counts per role in parallel
    const [userCounts, permCounts] = await Promise.all([
        db.select({ roleId: authUserRoles.role_id, count: count() })
            .from(authUserRoles).groupBy(authUserRoles.role_id),
        db.select({ roleId: authRolePermissions.role_id, count: count() })
            .from(authRolePermissions).groupBy(authRolePermissions.role_id),
    ]);

    const userCountMap = new Map(userCounts.map(uc => [uc.roleId, Number(uc.count)]));
    const permCountMap = new Map(permCounts.map(pc => [pc.roleId, Number(pc.count)]));

    return roles.map(role => ({
        ...role,
        userCount: userCountMap.get(role.id) ?? 0,
        permissionCount: permCountMap.get(role.id) ?? 0,
    }));
}

/**
 * Create a new role
 */
export async function createRole(name: string, description?: string, currentUserId?: number) {
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

    if (currentUserId) logAudit(currentUserId, 'INSERT', 'auth_roles', role.id, { name, description });

    return role;
}

/**
 * Update a role
 */
export async function updateRole(id: number, name: string, description?: string, currentUserId?: number) {
    // Capture old data for audit diff
    const oldRole = await db.query.authRoles.findFirst({ where: eq(authRoles.id, id) });

    const [updated] = await db
        .update(authRoles)
        .set({ name, description })
        .where(eq(authRoles.id, id))
        .returning();

    if (!updated) {
        throw new DomainError('Rol no encontrado', 404);
    }

    if (currentUserId) logAudit(currentUserId, 'UPDATE', 'auth_roles', id, { name, description }, oldRole ? { name: oldRole.name, description: oldRole.description } : undefined);

    return updated;
}

/**
 * Delete a role (with protection for system roles)
 */
export async function deleteRole(id: number, currentUserId?: number) {
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

    if (currentUserId) logAudit(currentUserId, 'DELETE', 'auth_roles', id, undefined, { name: role.name, description: role.description });

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
export async function updateRolePermissions(roleId: number, permissionIds: number[], currentUserId?: number) {
    const role = await db.query.authRoles.findFirst({
        where: eq(authRoles.id, roleId),
    });

    if (!role) {
        throw new DomainError('Rol no encontrado', 404);
    }

    // Capture old permission IDs for audit diff
    const oldPerms = await db.select({ id: authRolePermissions.permission_id }).from(authRolePermissions).where(eq(authRolePermissions.role_id, roleId));
    const oldPermIds = oldPerms.map(p => p.id);

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

    if (currentUserId) logAudit(currentUserId, 'UPDATE', 'auth_role_permissions', roleId, { permissionIds }, { permissionIds: oldPermIds });

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
            entityId: entities.id,
            entityName: entities.business_name,
            entityTaxId: entities.tax_id,
            entityIsClient: entities.is_client,
            entityIsSupplier: entities.is_supplier,
            entityIsEmployee: entities.is_employee,
        })
        .from(authUsers)
        .leftJoin(entities, eq(authUsers.entity_id, entities.id))
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
            
        results['isActive'] = activeRows.filter(r => r.value !== null).map(r => ({ value: r.value, count: Number(r.count) }));

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

    const user = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, userId),
    });

    if (!user) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    // Capture old role IDs for audit diff
    const oldRoles = await db.select({ id: authUserRoles.role_id }).from(authUserRoles).where(eq(authUserRoles.user_id, userId));
    const oldRoleIds = oldRoles.map(r => r.id);

    // SEC-BE-02: Only superadmin can assign system roles
    if (roleIds.length > 0) {
        const currentRoles = await getUserRoles(currentUserId);
        if (!currentRoles.includes(SYSTEM_ROLES.SUPERADMIN)) {
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
    broadcast(RealtimeEvents.USER.UPDATED, { id: userId }, RealtimeEvents.ROOMS.USERS);

    logAudit(currentUserId, 'UPDATE', 'auth_user_roles', userId, { roleIds }, { roleIds: oldRoleIds });

    return { success: true };
}

/**
 * Create a new user (admin function)
 */
export async function createUser(data: { username: string; email: string; password: string; roleIds?: number[] }, currentUserId?: number) {
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

    broadcast(RealtimeEvents.USER.CREATED, { id: user.id }, RealtimeEvents.ROOMS.USERS);

    if (currentUserId) logAudit(currentUserId, 'INSERT', 'auth_users', user.id, { username: data.username, email: data.email, roleIds: data.roleIds });

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
    broadcast(RealtimeEvents.USER.UPDATED, { id: userId }, RealtimeEvents.ROOMS.USERS);

    return { success: true };
}

/**
 * Update user details
 */
export async function updateUser(userId: number, data: { username?: string; email?: string; isActive?: boolean }, currentUserId?: number) {
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

    // Capture old data for audit diff
    const oldUser = currentUserId ? await db.query.authUsers.findFirst({
        where: eq(authUsers.id, userId),
        columns: { username: true, email: true, is_active: true },
    }) : undefined;

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

    broadcast(RealtimeEvents.USER.UPDATED, { userId }, RealtimeEvents.ROOMS.USERS);

    if (currentUserId) logAudit(currentUserId, 'UPDATE', 'auth_users', userId, updateData, oldUser ? { username: oldUser.username, email: oldUser.email, is_active: oldUser.is_active } : undefined);

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

    await ensureNotLastSuperadmin(userId);

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
    broadcast(RealtimeEvents.USER.UPDATED, { userId }, RealtimeEvents.ROOMS.USERS);

    logAudit(currentUserId, 'UPDATE', 'auth_users', userId, { is_active: false }, { is_active: true });

    return { success: true };
}

// deleteUser alias removed (F-04) — use deactivateUser or hardDeleteUser directly

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
    broadcast(RealtimeEvents.USER.UPDATED, { userId }, RealtimeEvents.ROOMS.USERS);

    logAudit(currentUserId, 'UPDATE', 'auth_users', userId, { is_active: true }, { is_active: false });

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

    await ensureNotLastSuperadmin(userId);

    // Remove roles
    await db.delete(authUserRoles).where(eq(authUserRoles.user_id, userId));

    // Kill active sessions
    await revokeAllUserSessions(userId);

    // Permanently delete the user
    const deleted = await db.delete(authUsers).where(eq(authUsers.id, userId)).returning({
        id: authUsers.id, username: authUsers.username, email: authUsers.email,
    });
    if (deleted.length === 0) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    await invalidateUserRbacCache(userId);
    broadcast(RealtimeEvents.USER.DELETED, { userId }, RealtimeEvents.ROOMS.USERS);

    logAudit(currentUserId, 'DELETE', 'auth_users', userId, undefined, { username: deleted[0].username, email: deleted[0].email });

    return { success: true };
}

/**
 * Pre-flight check for hard delete — returns reference counts.
 */
export async function checkUserReferences(userId: number) {
    const user = await db.query.authUsers.findFirst({ where: eq(authUsers.id, userId) });
    if (!user) throw new DomainError('Usuario no encontrado', 404);

    const [rolesResult, sessionsResult] = await Promise.all([
        db.select({ count: count() }).from(authUserRoles).where(eq(authUserRoles.user_id, userId)),
        db.select({ count: count() }).from(sessions).where(eq(sessions.user_id, userId)),
    ]);

    const rolesCount = Number(rolesResult[0]?.count ?? 0);
    const activeSessionsCount = Number(sessionsResult[0]?.count ?? 0);
    const total = rolesCount + activeSessionsCount;

    return { roles: rolesCount, activeSessions: activeSessionsCount, total, canDelete: true };
}

// ============================================
// AUDIT LOGGING
// ============================================

/**
 * Log an audit entry — fire-and-forget (never awaited in mutations).
 * Aligned with audit_logs schema: tableName, recordId, action, oldData, newData.
 */
export function logAudit(
    userId: number,
    action: 'INSERT' | 'UPDATE' | 'DELETE',
    tableName: string,
    recordId: string | number,
    newData?: Record<string, unknown>,
    oldData?: Record<string, unknown>,
): void {
    db.insert(auditLogs).values({
        tableName,
        recordId: String(recordId),
        action,
        userId,
        oldData: oldData ?? null,
        newData: newData ?? null,
    }).catch(error => console.error('Audit log error:', error));
}

/**
 * Get paginated audit log for a specific user.
 * Returns entries where the user performed the action.
 * Partition-aware: audit_logs is partitioned by createdAt (composite PK [id, createdAt]).
 */
export async function getUserAuditLog(userId: number, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    const condition = eq(auditLogs.userId, userId);

    const [totalResult, entries] = await Promise.all([
        db.select({ count: sql<number>`count(*)`.mapWith(Number) })
            .from(auditLogs)
            .where(condition),
        db.select({
            id: auditLogs.id,
            tableName: auditLogs.tableName,
            recordId: auditLogs.recordId,
            action: auditLogs.action,
            oldData: auditLogs.oldData,
            newData: auditLogs.newData,
            ipAddress: auditLogs.ipAddress,
            createdAt: auditLogs.createdAt,
            userId: auditLogs.userId,
            performedByUsername: authUsers.username,
        })
            .from(auditLogs)
            .leftJoin(authUsers, eq(auditLogs.userId, authUsers.id))
            .where(condition)
            .orderBy(desc(auditLogs.createdAt))
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

    // Revoke all sessions for the target user
    await revokeAllUserSessions(targetUserId);

    logAudit(adminUserId, 'UPDATE', 'auth_users', targetUserId, { field: 'password', action: 'admin_reset' });

    return { success: true };
}

/**
 * Assign or unassign an entity to a user.
 */
export async function setUserEntity(
    userId: number,
    entityId: number | null,
    currentUserId?: number,
) {
    // Validate entity exists if assigning
    if (entityId !== null) {
        const entity = await db.query.entities.findFirst({
            where: eq(entities.id, entityId),
        });
        if (!entity) throw new DomainError('Entidad no encontrada', 404);
    }

    // Capture old value for audit trail
    const oldUser = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, userId),
        columns: { entity_id: true },
    });

    const [updated] = await db
        .update(authUsers)
        .set({ entity_id: entityId })
        .where(eq(authUsers.id, userId))
        .returning({ id: authUsers.id, entityId: authUsers.entity_id });

    if (!updated) throw new DomainError('Usuario no encontrado', 404);

    if (currentUserId) logAudit(currentUserId, 'UPDATE', 'auth_users', userId, { entity_id: entityId }, { entity_id: oldUser?.entity_id ?? null });
    broadcast(RealtimeEvents.USER.UPDATED, { userId }, RealtimeEvents.ROOMS.USERS);

    return updated;
}



// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * Batch deactivate (soft-delete) multiple users — preserves roles.
 * F-08: Single UPDATE + parallel cache invalidation instead of serial loop.
 */
export async function batchDeleteUsers(userIds: number[], currentUserId: number) {
    if (userIds.includes(currentUserId)) {
        throw new DomainError('No puedes desactivar tu propia cuenta', 403);
    }

    // Filter out superadmins that would leave zero active superadmins
    const safeIds = [];
    const errors: { userId: number; success: false; error: string }[] = [];

    for (const userId of userIds) {
        try {
            await ensureNotLastSuperadmin(userId);
            safeIds.push(userId);
        } catch (error: any) {
            errors.push({ userId, success: false, error: error.message });
        }
    }

    // Single UPDATE for all safe IDs
    if (safeIds.length > 0) {
        await db.update(authUsers)
            .set({ is_active: false })
            .where(inArray(authUsers.id, safeIds));

        // Parallel cache invalidation
        await Promise.all(safeIds.map(id => invalidateUserRbacCache(id)));

        // Single broadcast for all changes
        broadcast(RealtimeEvents.USER.UPDATED, { userIds: safeIds }, RealtimeEvents.ROOMS.USERS);

        // Audit each deactivation
        for (const id of safeIds) logAudit(currentUserId, 'UPDATE', 'auth_users', id, { is_active: false }, { is_active: true });
    }

    return [
        ...safeIds.map(userId => ({ userId, success: true as const })),
        ...errors,
    ];
}

/**
 * Batch restore multiple deactivated users.
 * F-08: Single UPDATE + parallel cache invalidation instead of serial loop.
 */
export async function batchRestoreUsers(userIds: number[], currentUserId: number) {
    // Filter out self-restoration
    const safeIds = userIds.filter(id => id !== currentUserId);
    const errors: { userId: number; success: false; error: string }[] = [];

    if (userIds.includes(currentUserId)) {
        errors.push({ userId: currentUserId, success: false, error: 'No puedes restaurar tu propia cuenta' });
    }

    if (safeIds.length > 0) {
        await db.update(authUsers)
            .set({ is_active: true })
            .where(inArray(authUsers.id, safeIds));

        await Promise.all(safeIds.map(id => invalidateUserRbacCache(id)));

        broadcast(RealtimeEvents.USER.UPDATED, { userIds: safeIds }, RealtimeEvents.ROOMS.USERS);

        // Audit each restoration
        for (const id of safeIds) logAudit(currentUserId, 'UPDATE', 'auth_users', id, { is_active: true }, { is_active: false });
    }

    return [
        ...safeIds.map(userId => ({ userId, success: true as const })),
        ...errors,
    ];
}
