import { db } from '../../core/db';
import { authRoles, authRolePermissions, authPermissions, authUserRoles, auditLogs } from '@app/schema/tables';
import { eq, count, and } from '@app/schema';
import { DomainError } from '../../core/errors';
import { broadcast } from '../../core/sse';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { SYSTEM_ROLES } from '@app/schema/enums';
import { invalidateUserRbacCache } from './rbac.permission.service';

/**
 * Log an audit entry — fire-and-forget
 */
export function logAudit(
    userId: string | number,
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
        userId: String(userId),
        oldData: oldData ?? null,
        newData: newData ?? null,
    }).catch(error => console.error('Audit log error:', error));
}

/**
 * Get all roles with user and permission count
 */
export async function getAllRoles(companyId: number) {
    const roles = await db
        .select({
            id: authRoles.id,
            name: authRoles.name,
            description: authRoles.description,
            is_system: authRoles.is_system,
        })
        .from(authRoles)
        .where(eq(authRoles.company_id, companyId))
        .orderBy(authRoles.name);

    const [userCounts, permCounts] = await Promise.all([
        db.select({ roleId: authUserRoles.role_id, count: count() })
            .from(authUserRoles)
            .where(eq(authUserRoles.company_id, companyId))
            .groupBy(authUserRoles.role_id),
        db.select({ roleId: authRolePermissions.role_id, count: count() })
            .from(authRolePermissions)
            .where(eq(authRolePermissions.company_id, companyId))
            .groupBy(authRolePermissions.role_id),
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
 * Get single role by ID
 */
export async function getRoleById(roleId: number, companyId?: number) {
    const where = companyId
        ? and(eq(authRoles.id, roleId), eq(authRoles.company_id, companyId))
        : eq(authRoles.id, roleId);

    const role = await db.query.authRoles.findFirst({
        where,
    });

    if (!role) {
        throw new DomainError('Rol no encontrado', 404);
    }

    return role;
}

/**
 * Create a new role
 */
export async function createRole(name: string, description?: string | null, currentUserId?: string | number, companyId?: number) {
    const trimmedName = name.trim();
    if (trimmedName.toLowerCase() === SYSTEM_ROLES.SUPERADMIN) {
        throw new DomainError('No se puede crear un rol con el nombre reservado superadmin', 400);
    }

    const existing = await db.query.authRoles.findFirst({
        where: and(eq(authRoles.company_id, companyId!), eq(authRoles.name, trimmedName)),
    });

    if (existing) {
        throw new DomainError('Ya existe un rol con ese nombre', 409);
    }

    const [role] = await db
        .insert(authRoles)
        .values({ name: trimmedName, description, company_id: companyId! })
        .returning();

    if (currentUserId) logAudit(currentUserId, 'INSERT', 'auth_roles', role.id, { name: trimmedName, description });

    return role;
}

/**
 * Update a role
 */
export async function updateRole(id: number, name: string, description?: string | null, currentUserId?: string | number) {
    const oldRole = await db.query.authRoles.findFirst({ where: eq(authRoles.id, id) });
    if (!oldRole) {
        throw new DomainError('Rol no encontrado', 404);
    }

    const trimmedName = name.trim();
    if (oldRole.name === SYSTEM_ROLES.SUPERADMIN && trimmedName.toLowerCase() !== SYSTEM_ROLES.SUPERADMIN) {
        throw new DomainError('No se puede cambiar el nombre del rol superadmin', 403);
    }

    if (oldRole.name !== SYSTEM_ROLES.SUPERADMIN && trimmedName.toLowerCase() === SYSTEM_ROLES.SUPERADMIN) {
        throw new DomainError('No se puede renombrar un rol al nombre reservado superadmin', 400);
    }

    const [updated] = await db
        .update(authRoles)
        .set({ name: trimmedName, description })
        .where(eq(authRoles.id, id))
        .returning();

    if (currentUserId) logAudit(currentUserId, 'UPDATE', 'auth_roles', id, { name: trimmedName, description }, { name: oldRole.name, description: oldRole.description });

    return updated;
}

/**
 * Delete a role (with protection for system roles)
 */
export async function deleteRole(id: number, currentUserId?: string | number) {
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
export async function updateRolePermissions(roleId: number, permissionIds: number[], currentUserId?: string | number) {
    const role = await db.query.authRoles.findFirst({
        where: eq(authRoles.id, roleId),
    });

    if (!role) {
        throw new DomainError('Rol no encontrado', 404);
    }

    const oldPerms = await db.select({ id: authRolePermissions.permission_id }).from(authRolePermissions).where(eq(authRolePermissions.role_id, roleId));
    const oldPermIds = oldPerms.map(p => p.id);

    await db.transaction(async (tx) => {
        await tx.delete(authRolePermissions).where(eq(authRolePermissions.role_id, roleId));

        if (permissionIds.length > 0) {
            await tx.insert(authRolePermissions).values(
                permissionIds.map(permissionId => ({
                    role_id: roleId,
                    permission_id: permissionId,
                    company_id: role.company_id,
                }))
            );
        }
    });

    const usersWithRole = await db
        .select({ userId: authUserRoles.user_id })
        .from(authUserRoles)
        .where(eq(authUserRoles.role_id, roleId));

    await Promise.all(usersWithRole.map(({ userId }) => invalidateUserRbacCache(userId, role.company_id )));

    for (const { userId } of usersWithRole) {
        broadcast(RealtimeEvents.USER.RBAC_CHANGED, { userId }, `user:${userId}`);
    }

    if (currentUserId) logAudit(currentUserId, 'UPDATE', 'auth_role_permissions', roleId, { permissionIds }, { permissionIds: oldPermIds });

    return { success: true };
}
