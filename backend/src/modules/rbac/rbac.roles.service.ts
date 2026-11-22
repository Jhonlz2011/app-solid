import { db, tenantStorage, withTenant } from '../../core/db';
import { authRoles, authRolePermissions, authPermissions, authUserRoles, auditLogs } from '@app/schema/tables';
import { eq, count, and, inArray, sql } from '@app/schema';
import { DomainError } from '../../core/errors';
import { broadcastToUser } from '../../core/sse';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { SYSTEM_ROLES } from '@app/schema/enums';
import {
    invalidateUserRbacCache,
    invalidateUserFacetsCache,
    assertCanManageRole,
    isUserSuperadmin,
    getUserPermissions,
} from './rbac.permission.service';
import { getTenantEntitlements, hasUsableSubscription } from '../saas/entitlements.service';
import { resolveAllowedModulesFromFeatures } from '@app/schema/backend';

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
        company_id: tenantStorage.getStore()?.companyId ?? null,
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
    return withTenant(async () => {
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
    });
}

/**
 * Get single role by ID
 */
export async function getRoleById(roleId: number, companyId: number) {
    return withTenant(async () => {
        const role = await db.query.authRoles.findFirst({
            where: and(eq(authRoles.id, roleId), eq(authRoles.company_id, companyId)),
        });

        if (!role) {
            throw new DomainError('Rol no encontrado', 404);
        }

        return role;
    });
}

/**
 * Create a new role
 */
export async function createRole(name: string, description: string | null | undefined, currentUserId: string | number, companyId: number) {
    const trimmedName = name.trim();
    const reservedNames = Object.values(SYSTEM_ROLES).map(r => r.toLowerCase());
    if (reservedNames.includes(trimmedName.toLowerCase())) {
        throw new DomainError(`No se puede crear un rol con el nombre reservado '${trimmedName}'`, 400);
    }

    const role = await withTenant(async () => {
        const existing = await db.query.authRoles.findFirst({
            where: and(eq(authRoles.company_id, companyId), eq(authRoles.name, trimmedName)),
        });

        if (existing) {
            throw new DomainError('Ya existe un rol con ese nombre', 409);
        }

        const [created] = await db
            .insert(authRoles)
            .values({ name: trimmedName, description, company_id: companyId, is_system: false, priority: 0 })
            .returning();
        return created;
    });

    if (currentUserId) logAudit(currentUserId, 'INSERT', 'auth_roles', role.id, { name: trimmedName, description });

    return role;
}

/**
 * Update a role
 */
export async function updateRole(id: number, name: string, description: string | null | undefined, currentUserId: string | number, companyId: number) {
    const { oldRole, updated } = await withTenant(async () => {
        const existing = await db.query.authRoles.findFirst({
            where: and(eq(authRoles.id, id), eq(authRoles.company_id, companyId)),
        });
        if (!existing) {
            throw new DomainError('Rol no encontrado', 404);
        }

        await assertCanManageRole(currentUserId, existing, companyId, 'modificar');

        const trimmedName = name.trim();
        if (existing.is_system && trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
            throw new DomainError('No se puede cambiar el nombre de un rol de sistema', 403);
        }

        const reservedNames = Object.values(SYSTEM_ROLES).map(r => r.toLowerCase());
        if (!existing.is_system && reservedNames.includes(trimmedName.toLowerCase())) {
            throw new DomainError(`No se puede renombrar un rol al nombre reservado '${trimmedName}'`, 400);
        }

        const [row] = await db
            .update(authRoles)
            .set({ name: trimmedName, description })
            .where(and(eq(authRoles.id, id), eq(authRoles.company_id, companyId)))
            .returning();

        return { oldRole: existing, updated: row };
    });

    await invalidateUserFacetsCache(companyId);
    if (currentUserId) logAudit(currentUserId, 'UPDATE', 'auth_roles', id, { name: updated.name, description }, { name: oldRole.name, description: oldRole.description });

    return updated;
}

/**
 * Delete a role (with protection for system roles, hierarchy, and orphan-user prevention)
 */
export async function deleteRole(id: number, currentUserId: string | number, companyId: number) {
    const { role, usersWithRole } = await withTenant(async () => {
        const foundRole = await db.query.authRoles.findFirst({
            where: and(eq(authRoles.id, id), eq(authRoles.company_id, companyId)),
        });

        if (!foundRole) {
            throw new DomainError('Rol no encontrado', 404);
        }

        if (foundRole.is_system || foundRole.name === SYSTEM_ROLES.SUPERADMIN || foundRole.name === SYSTEM_ROLES.ADMIN || foundRole.name === SYSTEM_ROLES.CONTADOR) {
            throw new DomainError('No se puede eliminar roles del sistema', 403);
        }

        await assertCanManageRole(currentUserId, foundRole, companyId, 'eliminar');

        const assignedUsers = await db
            .select({ userId: authUserRoles.user_id })
            .from(authUserRoles)
            .where(and(
                eq(authUserRoles.role_id, id),
                eq(authUserRoles.company_id, companyId),
            ));

        // Prevent leaving any assigned user with 0 roles in this company
        if (assignedUsers.length > 0) {
            const assignedUserIds = assignedUsers.map(u => u.userId);
            const roleCounts = await db
                .select({
                    userId: authUserRoles.user_id,
                    roleCount: sql<number>`count(*)::int`,
                })
                .from(authUserRoles)
                .where(and(
                    eq(authUserRoles.company_id, companyId),
                    inArray(authUserRoles.user_id, assignedUserIds),
                ))
                .groupBy(authUserRoles.user_id);

            const hasSingleRoleUser = roleCounts.some(r => r.roleCount <= 1);
            if (hasSingleRoleUser) {
                throw new DomainError(
                    'No se puede eliminar este rol porque hay usuarios que dependen exclusivamente de él. Reasigna sus roles antes de eliminarlo.',
                    409
                );
            }
        }

        await db.delete(authRoles).where(and(
            eq(authRoles.id, id),
            eq(authRoles.company_id, companyId),
        ));

        return { role: foundRole, usersWithRole: assignedUsers };
    });

    await Promise.all([
        ...usersWithRole.map(({ userId }) => invalidateUserRbacCache(userId, role.company_id)),
        invalidateUserFacetsCache(companyId),
    ]);

    for (const { userId } of usersWithRole) {
        broadcastToUser(userId, RealtimeEvents.USER.RBAC_CHANGED, { userId });
    }

    if (currentUserId) logAudit(currentUserId, 'DELETE', 'auth_roles', id, undefined, { name: role.name, description: role.description });

    return { success: true };
}

/**
 * Get all permissions, filtered by SaaS plan features & active subscription for a company
 */
export async function getAllPermissions(companyId: number) {
    const ent = await getTenantEntitlements(companyId);
    if (!hasUsableSubscription(ent)) {
        return { all: [], grouped: {} };
    }

    const permissions = await db
        .select()
        .from(authPermissions)
        .orderBy(authPermissions.slug);

    const allowedModules = resolveAllowedModulesFromFeatures(ent.features);
    const filteredPermissions = permissions.filter(p => allowedModules.has(p.module as any));

    const resultPermissions = filteredPermissions.map(p => ({
        ...p,
        planAllowed: true,
    }));

    const grouped: Record<string, typeof resultPermissions> = {};
    for (const perm of resultPermissions) {
        const moduleName = perm.module;
        if (!grouped[moduleName]) {
            grouped[moduleName] = [];
        }
        grouped[moduleName].push(perm);
    }

    return {
        all: resultPermissions,
        grouped,
    };
}

/**
 * Get permissions for a specific role
 */
export async function getRolePermissions(roleId: number, companyId: number) {
    return withTenant(async () => {
        const permissions = await db
            .select({
                slug: authRolePermissions.permission_slug,
                description: authPermissions.description,
            })
            .from(authRolePermissions)
            .leftJoin(authPermissions, eq(authRolePermissions.permission_slug, authPermissions.slug))
            .where(and(
                eq(authRolePermissions.role_id, roleId),
                eq(authRolePermissions.company_id, companyId),
            ));

        return permissions;
    });
}

/**
 * Update permissions for a role (with anti-escalation, system role protection, and feature entitlements)
 */
export async function updateRolePermissions(roleId: number, companyId: number, permissionSlugs: string[], currentUserId: string | number) {
    const uniqueSlugs = [...new Set(permissionSlugs.map(s => s.trim()).filter(Boolean))];

    const { role, oldPermSlugs, usersWithRole } = await withTenant(async () => {
        const targetRole = await db.query.authRoles.findFirst({
            where: and(eq(authRoles.id, roleId), eq(authRoles.company_id, companyId)),
        });

        if (!targetRole) {
            throw new DomainError('Rol no encontrado', 404);
        }

        if (targetRole.name === SYSTEM_ROLES.SUPERADMIN) {
            throw new DomainError('Los permisos del rol superadmin no pueden modificarse', 403);
        }

        await assertCanManageRole(currentUserId, targetRole, companyId, 'modificar permisos de');

        const callerIsSuper = await isUserSuperadmin(currentUserId, companyId);
        if (!callerIsSuper) {
            // Prevent modifying permissions of any role the caller themselves holds (self-escalation)
            const [callerHoldsRole] = await db
                .select({ roleId: authUserRoles.role_id })
                .from(authUserRoles)
                .where(and(
                    eq(authUserRoles.user_id, String(currentUserId)),
                    eq(authUserRoles.role_id, roleId),
                    eq(authUserRoles.company_id, companyId),
                ))
                .limit(1);
            if (callerHoldsRole) {
                throw new DomainError('No puedes modificar los permisos de tu propio rol', 403);
            }
        }

        // Validate subscription & feature entitlements
        const ent = await getTenantEntitlements(companyId);
        if (!hasUsableSubscription(ent)) {
            throw new DomainError('La suscripción de la empresa no se encuentra activa para modificar permisos.', 403);
        }

        if (uniqueSlugs.length > 0) {
            // 1. Ensure every requested permission exists in the global catalog
            const catalogPerms = await db
                .select({ slug: authPermissions.slug, module: authPermissions.module })
                .from(authPermissions)
                .where(inArray(authPermissions.slug, uniqueSlugs));

            if (catalogPerms.length !== uniqueSlugs.length) {
                throw new DomainError('Uno o más permisos especificados no son válidos', 400);
            }

            // 2. Ensure every permission's module is allowed by the tenant's active plan features
            const allowedModules = resolveAllowedModulesFromFeatures(ent.features);
            for (const perm of catalogPerms) {
                if (!allowedModules.has(perm.module as any)) {
                    throw new DomainError(
                        `El módulo '${perm.module}' no está contratado en el plan actual de la empresa. Actualiza tu plan para habilitar este módulo.`,
                        403,
                        { code: 'FEATURE_NOT_IN_PLAN' }
                    );
                }
            }

            // 3. Anti-escalation: non-superadmin can only grant permissions they themselves possess
            if (!callerIsSuper) {
                const callerPermissions = new Set(await getUserPermissions(currentUserId, companyId));
                const unauthorizedSlugs = uniqueSlugs.filter(slug => !callerPermissions.has(slug));
                if (unauthorizedSlugs.length > 0) {
                    throw new DomainError(
                        `No puedes otorgar permisos que no posees: ${unauthorizedSlugs.slice(0, 3).join(', ')}`,
                        403
                    );
                }
            }
        }

        const oldPerms = await db
            .select({ slug: authRolePermissions.permission_slug })
            .from(authRolePermissions)
            .where(and(
                eq(authRolePermissions.role_id, roleId),
                eq(authRolePermissions.company_id, companyId),
            ));
        const previousSlugs = oldPerms.map(p => p.slug);

        await db.transaction(async (tx) => {
            await tx.delete(authRolePermissions).where(and(
                eq(authRolePermissions.role_id, roleId),
                eq(authRolePermissions.company_id, companyId),
            ));

            if (uniqueSlugs.length > 0) {
                await tx.insert(authRolePermissions).values(
                    uniqueSlugs.map(slug => ({
                        role_id: roleId,
                        permission_slug: slug,
                        company_id: companyId,
                    }))
                );
            }
        });

        const affectedUsers = await db
            .select({ userId: authUserRoles.user_id })
            .from(authUserRoles)
            .where(and(
                eq(authUserRoles.role_id, roleId),
                eq(authUserRoles.company_id, companyId),
            ));

        return { role: targetRole, oldPermSlugs: previousSlugs, usersWithRole: affectedUsers };
    });

    await Promise.all(usersWithRole.map(({ userId }) => invalidateUserRbacCache(userId, role.company_id)));

    for (const { userId } of usersWithRole) {
        broadcastToUser(userId, RealtimeEvents.USER.RBAC_CHANGED, { userId });
    }

    if (currentUserId) logAudit(currentUserId, 'UPDATE', 'auth_role_permissions', roleId, { permissionSlugs: uniqueSlugs }, { permissionSlugs: oldPermSlugs });

    return { success: true };
}
