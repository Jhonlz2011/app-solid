import { db } from '../db';
import { authUserRoles, authRoles, authRolePermissions, authPermissions, authUsers } from '@app/schema/tables';
import { eq, sql, count } from '@app/schema';
import { cacheService } from './cache.service';
import { DomainError } from './errors';

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
        // Direct optimized query joining all tables in one go
        const result = await db
            .selectDistinct({ slug: authPermissions.slug })
            .from(authUserRoles)
            .innerJoin(authRolePermissions, eq(authUserRoles.role_id, authRolePermissions.role_id))
            .innerJoin(authPermissions, eq(authRolePermissions.permission_id, authPermissions.id))
            .where(eq(authUserRoles.user_id, userId));

        return result.map(r => r.slug);
    }, 300);
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(userId: number, requiredPermission: string): Promise<boolean> {
    const roles = await getUserRoles(userId);
    // Superadmin/admin bypass
    if (roles.includes('superadmin') || roles.includes('admin')) {
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

    if (roles.includes('admin') || roles.includes('superadmin')) {
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
 * Invalidate RBAC cache for a user
 */
export function invalidateUserRbacCache(userId: number): void {
    cacheService.invalidate(`rbac:roles:${userId}`);
    cacheService.invalidate(`rbac:permissions:${userId}`);
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

    if (role.name === 'superadmin' || role.name === 'admin') {
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

    // Invalidate cache for all users with this role
    const usersWithRole = await db
        .select({ userId: authUserRoles.user_id })
        .from(authUserRoles)
        .where(eq(authUserRoles.role_id, roleId));

    for (const { userId } of usersWithRole) {
        invalidateUserRbacCache(userId);
    }

    return { success: true };
}

/**
 * Get all users with their roles
 */
export async function getAllUsersWithRoles() {
    const users = await db
        .select({
            id: authUsers.id,
            username: authUsers.username,
            email: authUsers.email,
            isActive: authUsers.is_active,
            lastLogin: authUsers.last_login,
        })
        .from(authUsers)
        .orderBy(authUsers.username);

    const userRoles = await db
        .select({
            userId: authUserRoles.user_id,
            roleId: authRoles.id,
            roleName: authRoles.name,
        })
        .from(authUserRoles)
        .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id));

    const roleMap = new Map<number, { id: number; name: string }[]>();
    for (const ur of userRoles) {
        if (!roleMap.has(ur.userId)) {
            roleMap.set(ur.userId, []);
        }
        roleMap.get(ur.userId)!.push({ id: ur.roleId, name: ur.roleName });
    }

    return users.map(user => ({
        ...user,
        roles: roleMap.get(user.id) ?? [],
    }));
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
 * Assign roles to a user
 */
export async function assignUserRoles(userId: number, roleIds: number[]) {
    const user = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, userId),
    });

    if (!user) {
        throw new DomainError('Usuario no encontrado', 404);
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
    invalidateUserRbacCache(userId);

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
        .where(
            sql`${authUserRoles.user_id} = ${userId} AND ${authUserRoles.role_id} = ${roleId}`
        )
        .returning();

    if (deleted.length === 0) {
        throw new DomainError('El usuario no tiene este rol', 404);
    }

    // Invalidate cache
    invalidateUserRbacCache(userId);

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

    const updateData: any = {};
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
 * Delete (deactivate) a user
 */
export async function deleteUser(userId: number) {
    // Soft delete by deactivating
    const [updated] = await db
        .update(authUsers)
        .set({ is_active: false })
        .where(eq(authUsers.id, userId))
        .returning();

    if (!updated) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    // Remove all roles
    await db.delete(authUserRoles).where(eq(authUserRoles.user_id, userId));

    // Invalidate cache
    invalidateUserRbacCache(userId);

    return { success: true };
}
