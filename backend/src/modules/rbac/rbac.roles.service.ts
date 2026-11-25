import { adminDb, withTenantContext, type Tx } from '../../core/db';
import { authRoles, authRolePermissions, authPermissions, authUserRoles, auditLogs } from '@app/schema/tables';
import { eq, and, inArray, sql, asc, desc } from '@app/schema';
import { DomainError } from '../../core/errors';
import { broadcastToTenant, broadcastToUser } from '../../core/sse';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { SYSTEM_ROLES } from '@app/schema/enums';
import { getRbacPermissionDescription } from '@app/schema/utils';
import { cacheService } from '../../core/cache';
import {
    invalidateUserRbacCache,
    invalidateUserFacetsCache,
    invalidateRolesListCache,
    assertCanManageRole,
    isUserSuperadmin,
    getUserPermissions,
} from './rbac.permission.service';
import { getTenantEntitlements, hasUsableSubscription } from '../saas/entitlements.service';
import { resolveAllowedModulesFromFeatures } from '@app/schema/backend';

const GLOBAL_PERMISSIONS_CACHE_KEY = 'rbac:permissions:global:v1';

/**
 * Log an audit entry — fire-and-forget via adminDb with explicit companyId
 * (never relies on AsyncLocalStorage propagation across Elysia derive hooks).
 */
export function logAudit(
    userId: string | number,
    action: 'INSERT' | 'UPDATE' | 'DELETE',
    tableName: string,
    recordId: string | number,
    newData?: Record<string, unknown>,
    oldData?: Record<string, unknown>,
    companyId?: number | null,
): void {
    adminDb.insert(auditLogs).values({
        company_id: companyId ?? null,
        tableName,
        recordId: String(recordId),
        action,
        userId: String(userId),
        oldData: oldData ?? null,
        newData: newData ?? null,
    }).catch(error => console.error('Audit log error:', error));
}

/**
 * Shared transactional permission validator & writer for a role.
 * Enforces immutability of superadmin, non-destructive rule on contador,
 * active subscription, plan module entitlements, and caller anti-escalation.
 */
async function validateAndReplaceRolePermissionsInTx(
    tx: Tx,
    params: {
        roleId: number;
        roleName: string;
        companyId: number;
        permissionSlugs: string[];
        currentUserId: string | number;
    },
): Promise<{ uniqueSlugs: string[]; previousSlugs: string[] }> {
    const { roleId, roleName, companyId, currentUserId } = params;
    const uniqueSlugs = [...new Set(params.permissionSlugs.map(s => s.trim()).filter(Boolean))];

    if (roleName === SYSTEM_ROLES.SUPERADMIN) {
        throw new DomainError('Los permisos del rol Super Administrador no pueden modificarse', 403);
    }

    if (roleName === SYSTEM_ROLES.CONTADOR) {
        const destructive = uniqueSlugs.filter(slug => slug.endsWith('.delete') || slug.endsWith('.destroy'));
        if (destructive.length > 0) {
            throw new DomainError(
                'El rol Contador Externo no puede recibir permisos destructivos (desactivar o eliminar permanentemente).',
                400,
                { code: 'VALIDATION_ERROR' }
            );
        }
    }

    const callerIsSuper = await isUserSuperadmin(currentUserId, companyId);
    if (!callerIsSuper) {
        // Prevent modifying permissions of any role the caller themselves holds (self-escalation)
        const [callerHoldsRole] = await tx
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
        throw new DomainError(
            'La suscripción de la empresa no se encuentra activa para modificar permisos.',
            403,
            { code: 'SUBSCRIPTION_BLOCKED' }
        );
    }

    if (uniqueSlugs.length > 0) {
        // 1. Ensure every requested permission exists in the global catalog
        const catalogPerms = await tx
            .select({ slug: authPermissions.slug, module: authPermissions.module })
            .from(authPermissions)
            .where(inArray(authPermissions.slug, uniqueSlugs));

        if (catalogPerms.length !== uniqueSlugs.length) {
            throw new DomainError('Uno o más permisos especificados no son válidos', 400, { code: 'VALIDATION_ERROR' });
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

    const oldPerms = await tx
        .select({ slug: authRolePermissions.permission_slug })
        .from(authRolePermissions)
        .where(and(
            eq(authRolePermissions.role_id, roleId),
            eq(authRolePermissions.company_id, companyId),
        ));
    const previousSlugs = oldPerms.map(p => p.slug);

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

    return { uniqueSlugs, previousSlugs };
}

/**
 * Get all roles with user and permission count in ONE single SQL query (cached in Redis 5 min),
 * ordered hierarchically (priority DESC, name ASC).
 */
export async function getAllRoles(companyId: number) {
    return cacheService.getOrSet(`rbac:roles:list:${companyId}`, async () => {
        return withTenantContext({ companyId }, async (tx) => {
            const userCountSq = tx
                .select({
                    roleId: authUserRoles.role_id,
                    userCount: sql<number>`count(*)::int`.as('user_count'),
                })
                .from(authUserRoles)
                .where(eq(authUserRoles.company_id, companyId))
                .groupBy(authUserRoles.role_id)
                .as('uc');

            const permCountSq = tx
                .select({
                    roleId: authRolePermissions.role_id,
                    permissionCount: sql<number>`count(*)::int`.as('perm_count'),
                })
                .from(authRolePermissions)
                .where(eq(authRolePermissions.company_id, companyId))
                .groupBy(authRolePermissions.role_id)
                .as('pc');

            const rows = await tx
                .select({
                    id: authRoles.id,
                    name: authRoles.name,
                    description: authRoles.description,
                    is_system: authRoles.is_system,
                    priority: sql<number>`COALESCE(${authRoles.priority}, 0)::int`,
                    userCount: sql<number>`COALESCE(${userCountSq.userCount}, 0)::int`,
                    permissionCount: sql<number>`COALESCE(${permCountSq.permissionCount}, 0)::int`,
                })
                .from(authRoles)
                .leftJoin(userCountSq, eq(authRoles.id, userCountSq.roleId))
                .leftJoin(permCountSq, eq(authRoles.id, permCountSq.roleId))
                .where(eq(authRoles.company_id, companyId))
                .orderBy(desc(authRoles.priority), asc(authRoles.name));

            return rows;
        });
    }, 300);
}

/**
 * Get single role by ID with user and permission counts
 */
export async function getRoleById(roleId: number, companyId: number) {
    return withTenantContext({ companyId }, async (tx) => {
        const [role] = await tx
            .select({
                id: authRoles.id,
                name: authRoles.name,
                description: authRoles.description,
                is_system: authRoles.is_system,
                priority: sql<number>`COALESCE(${authRoles.priority}, 0)::int`,
                createdAt: authRoles.createdAt,
            })
            .from(authRoles)
            .where(and(eq(authRoles.id, roleId), eq(authRoles.company_id, companyId)))
            .limit(1);

        if (!role) {
            throw new DomainError('Rol no encontrado', 404);
        }

        const [[userRow], [permRow]] = await Promise.all([
            tx.select({ count: sql<number>`count(*)::int` })
                .from(authUserRoles)
                .where(and(eq(authUserRoles.role_id, roleId), eq(authUserRoles.company_id, companyId))),
            tx.select({ count: sql<number>`count(*)::int` })
                .from(authRolePermissions)
                .where(and(eq(authRolePermissions.role_id, roleId), eq(authRolePermissions.company_id, companyId))),
        ]);

        return {
            ...role,
            userCount: userRow?.count ?? 0,
            permissionCount: permRow?.count ?? 0,
        };
    });
}

/**
 * Create a new role (optionally assigning permissions atomically in the same ACID transaction)
 */
export async function createRole(
    name: string,
    description: string | null | undefined,
    currentUserId: string | number,
    companyId: number,
    permissionSlugs?: string[],
) {
    const trimmedName = name.trim();
    const reservedNames = Object.values(SYSTEM_ROLES).map(r => r.toLowerCase());
    if (reservedNames.includes(trimmedName.toLowerCase())) {
        throw new DomainError(`No se puede crear un rol con el nombre reservado '${trimmedName}'`, 400);
    }

    const { role, assignedSlugs } = await withTenantContext({ companyId, userId: currentUserId }, async (tx) => {
        const existing = await tx.query.authRoles.findFirst({
            where: and(
                eq(authRoles.company_id, companyId),
                sql`lower(${authRoles.name}) = lower(${trimmedName})`,
            ),
        });

        if (existing) {
            throw new DomainError('Ya existe un rol con ese nombre', 409, { code: 'CONFLICT' });
        }

        const [created] = await tx
            .insert(authRoles)
            .values({ name: trimmedName, description: description ?? null, company_id: companyId, is_system: false, priority: 0 })
            .returning();

        let assigned: string[] = [];
        if (permissionSlugs && permissionSlugs.length > 0) {
            const permResult = await validateAndReplaceRolePermissionsInTx(tx, {
                roleId: created.id,
                roleName: created.name,
                companyId,
                permissionSlugs,
                currentUserId,
            });
            assigned = permResult.uniqueSlugs;
        }

        return { role: created, assignedSlugs: assigned };
    });

    await invalidateRolesListCache(companyId);
    broadcastToTenant(companyId, RealtimeEvents.ROLE.CREATED, { id: role.id }, RealtimeEvents.ROOMS.USERS);
    if (currentUserId) {
        logAudit(currentUserId, 'INSERT', 'auth_roles', role.id, { name: trimmedName, description, permissionSlugs: assignedSlugs }, undefined, companyId);
    }

    return {
        ...role,
        userCount: 0,
        permissionCount: assignedSlugs.length,
    };
}

/**
 * Update a role (and optionally its permissions atomically in the same transaction).
 * - `superadmin` role is completely immutable.
 * - `admin` / `contador` (`is_system: true`): only `superadmin` can edit description/permissions (cannot be renamed).
 */
export async function updateRole(
    id: number,
    name: string,
    description: string | null | undefined,
    currentUserId: string | number,
    companyId: number,
    permissionSlugs?: string[],
) {
    const { oldRole, updated, permAudit, usersWithRole } = await withTenantContext(
        { companyId, userId: currentUserId },
        async (tx) => {
            const existing = await tx.query.authRoles.findFirst({
                where: and(eq(authRoles.id, id), eq(authRoles.company_id, companyId)),
            });
            if (!existing) {
                throw new DomainError('Rol no encontrado', 404);
            }

            if (existing.name === SYSTEM_ROLES.SUPERADMIN) {
                throw new DomainError('El rol Super Administrador no puede modificarse', 403);
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

            if (!existing.is_system && trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
                const duplicate = await tx.query.authRoles.findFirst({
                    where: and(
                        eq(authRoles.company_id, companyId),
                        sql`lower(${authRoles.name}) = lower(${trimmedName})`,
                    ),
                });
                if (duplicate && duplicate.id !== id) {
                    throw new DomainError('Ya existe otro rol con ese nombre', 409, { code: 'CONFLICT' });
                }
            }

            const [row] = await tx
                .update(authRoles)
                .set({
                    name: existing.is_system ? existing.name : trimmedName,
                    description: description !== undefined ? description : existing.description,
                })
                .where(and(eq(authRoles.id, id), eq(authRoles.company_id, companyId)))
                .returning();

            let permChange: { uniqueSlugs: string[]; previousSlugs: string[] } | null = null;
            let affectedUsers: { userId: string }[] = [];

            if (permissionSlugs !== undefined) {
                permChange = await validateAndReplaceRolePermissionsInTx(tx, {
                    roleId: id,
                    roleName: existing.name,
                    companyId,
                    permissionSlugs,
                    currentUserId,
                });

                affectedUsers = await tx
                    .select({ userId: authUserRoles.user_id })
                    .from(authUserRoles)
                    .where(and(
                        eq(authUserRoles.role_id, id),
                        eq(authUserRoles.company_id, companyId),
                    ));
            }

            return { oldRole: existing, updated: row, permAudit: permChange, usersWithRole: affectedUsers };
        }
    );

    await Promise.all([
        invalidateRolesListCache(companyId),
        invalidateUserFacetsCache(companyId),
        ...usersWithRole.map(({ userId }) => invalidateUserRbacCache(userId, companyId)),
    ]);

    broadcastToTenant(companyId, RealtimeEvents.ROLE.UPDATED, { id }, RealtimeEvents.ROOMS.USERS);
    for (const { userId } of usersWithRole) {
        broadcastToUser(userId, RealtimeEvents.USER.RBAC_CHANGED, { userId });
    }

    if (currentUserId) {
        logAudit(
            currentUserId,
            'UPDATE',
            'auth_roles',
            id,
            { name: updated.name, description: updated.description, ...(permAudit ? { permissionSlugs: permAudit.uniqueSlugs } : {}) },
            { name: oldRole.name, description: oldRole.description, ...(permAudit ? { permissionSlugs: permAudit.previousSlugs } : {}) },
            companyId,
        );
    }

    return updated;
}

/**
 * Delete a role (with protection for system roles, hierarchy, and orphan-user prevention)
 */
export async function deleteRole(id: number, currentUserId: string | number, companyId: number) {
    const { role, usersWithRole } = await withTenantContext({ companyId, userId: currentUserId }, async (tx) => {
        const foundRole = await tx.query.authRoles.findFirst({
            where: and(eq(authRoles.id, id), eq(authRoles.company_id, companyId)),
        });

        if (!foundRole) {
            throw new DomainError('Rol no encontrado', 404);
        }

        if (foundRole.is_system || foundRole.name === SYSTEM_ROLES.SUPERADMIN || foundRole.name === SYSTEM_ROLES.ADMIN || foundRole.name === SYSTEM_ROLES.CONTADOR) {
            throw new DomainError('No se puede eliminar roles del sistema', 403);
        }

        await assertCanManageRole(currentUserId, foundRole, companyId, 'eliminar');

        const assignedUsers = await tx
            .select({ userId: authUserRoles.user_id })
            .from(authUserRoles)
            .where(and(
                eq(authUserRoles.role_id, id),
                eq(authUserRoles.company_id, companyId),
            ));

        // Prevent leaving any assigned user with 0 roles in this company
        if (assignedUsers.length > 0) {
            const assignedUserIds = assignedUsers.map(u => u.userId);
            const roleCounts = await tx
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

        await tx.delete(authRoles).where(and(
            eq(authRoles.id, id),
            eq(authRoles.company_id, companyId),
        ));

        return { role: foundRole, usersWithRole: assignedUsers };
    });

    await Promise.all([
        ...usersWithRole.map(({ userId }) => invalidateUserRbacCache(userId, role.company_id)),
        invalidateUserFacetsCache(companyId),
        invalidateRolesListCache(companyId),
    ]);

    broadcastToTenant(companyId, RealtimeEvents.ROLE.DELETED, { id }, RealtimeEvents.ROOMS.USERS);
    for (const { userId } of usersWithRole) {
        broadcastToUser(userId, RealtimeEvents.USER.RBAC_CHANGED, { userId });
    }

    if (currentUserId) logAudit(currentUserId, 'DELETE', 'auth_roles', id, undefined, { name: role.name, description: role.description }, companyId);

    return { success: true };
}

/**
 * Get all permissions, filtered by SaaS plan features & active subscription for a company.
 * Global catalog is cached in Redis (1h) for sub-millisecond reads.
 */
export async function getAllPermissions(companyId: number) {
    const [ent, permissions] = await Promise.all([
        getTenantEntitlements(companyId),
        cacheService.getOrSet(GLOBAL_PERMISSIONS_CACHE_KEY, async () => {
            return adminDb
                .select()
                .from(authPermissions)
                .orderBy(authPermissions.slug);
        }, 3600),
    ]);

    if (!hasUsableSubscription(ent)) {
        return { all: [], grouped: {} };
    }

    const allowedModules = resolveAllowedModulesFromFeatures(ent.features);
    const resultPermissions = permissions
        .filter(p => allowedModules.has(p.module as any))
        .map(p => ({
            ...p,
            description: p.description || getRbacPermissionDescription(p.module, p.action),
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
    return withTenantContext({ companyId }, async (tx) => {
        return tx
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
    });
}

/**
 * Update permissions for a role (with anti-escalation, system role protection, and feature entitlements)
 */
export async function updateRolePermissions(
    roleId: number,
    companyId: number,
    permissionSlugs: string[],
    currentUserId: string | number,
) {
    const { role, uniqueSlugs, previousSlugs, usersWithRole } = await withTenantContext(
        { companyId, userId: currentUserId },
        async (tx) => {
            const targetRole = await tx.query.authRoles.findFirst({
                where: and(eq(authRoles.id, roleId), eq(authRoles.company_id, companyId)),
            });

            if (!targetRole) {
                throw new DomainError('Rol no encontrado', 404);
            }

            if (targetRole.name === SYSTEM_ROLES.SUPERADMIN) {
                throw new DomainError('Los permisos del rol Super Administrador no pueden modificarse', 403);
            }

            await assertCanManageRole(currentUserId, targetRole, companyId, 'modificar permisos de');

            const permResult = await validateAndReplaceRolePermissionsInTx(tx, {
                roleId,
                roleName: targetRole.name,
                companyId,
                permissionSlugs,
                currentUserId,
            });

            const affectedUsers = await tx
                .select({ userId: authUserRoles.user_id })
                .from(authUserRoles)
                .where(and(
                    eq(authUserRoles.role_id, roleId),
                    eq(authUserRoles.company_id, companyId),
                ));

            return {
                role: targetRole,
                uniqueSlugs: permResult.uniqueSlugs,
                previousSlugs: permResult.previousSlugs,
                usersWithRole: affectedUsers,
            };
        }
    );

    await Promise.all([
        ...usersWithRole.map(({ userId }) => invalidateUserRbacCache(userId, role.company_id)),
        invalidateRolesListCache(companyId),
    ]);

    broadcastToTenant(companyId, RealtimeEvents.ROLE.UPDATED, { id: roleId }, RealtimeEvents.ROOMS.USERS);
    for (const { userId } of usersWithRole) {
        broadcastToUser(userId, RealtimeEvents.USER.RBAC_CHANGED, { userId });
    }

    if (currentUserId) {
        logAudit(currentUserId, 'UPDATE', 'auth_role_permissions', roleId, { permissionSlugs: uniqueSlugs }, { permissionSlugs: previousSlugs }, companyId);
    }

    return { success: true };
}
