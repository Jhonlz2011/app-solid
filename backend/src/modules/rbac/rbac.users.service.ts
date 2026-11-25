import { db, adminDb, withTenant, type Tx } from '../../core/db';
import { v7 as uuidv7 } from 'uuid';
import { createHash, randomBytes } from 'node:crypto';
import { authUsers, authUserRoles, authRoles, authRolePermissions, entities, auditLogs, sessions, member, companies, verification, account } from '@app/schema/tables';
import { eq, ne, sql, count, and, inArray, ilike, like, gt, or, asc, desc, type SQL } from '@app/schema';
import { cacheService } from '../../core/cache';
import { DomainError } from '../../core/errors';
import { broadcastToTenant, broadcastToUser } from '../../core/sse/events';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { SYSTEM_ROLES } from '@app/schema/enums';
import { emailService } from '../../core/email';
import { auth, resolveTenantUrl } from '../../config/better-auth';
import {
    invalidateUserRbacCache,
    invalidateUserFacetsCache,
    revokeAllUserSessions,
    revokeTenantUserSessions,
    isUserSuperadmin,
    assertNotSuperadmin,
    assertCanManageRole,
    assertCanManageTargetUser,
    getUserPermissions,
} from './rbac.permission.service';
import { logAudit } from './rbac.roles.service';
import {
    canCreateUser,
    getCompanySeatUsage,
    getTenantEntitlements,
    isExclusiveAccountantRole,
} from '../saas/entitlements.service';
import { hashPassword } from '../../core/security';
import type { RbacUserCreateType } from '@app/schema/backend';
import { createCredentialIdentity, replaceCredentialPassword } from '../auth/identity.service';

export interface UsersListFilters {
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    isActive?: string[];
    roles?: string[];
}

type TenantMembership = {
    organizationId: string;
    status: string;
};

async function getTenantOrganizationId(companyId: number): Promise<string> {
    const [company] = await adminDb
        .select({ organizationId: companies.organization_id })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

    if (!company?.organizationId) {
        throw new DomainError('La empresa no tiene una organización válida', 409);
    }

    return company.organizationId;
}

async function requireTenantMembership(
    userId: string | number,
    companyId: number,
    options: { active?: boolean } = {},
): Promise<TenantMembership> {
    const organizationId = await getTenantOrganizationId(companyId);
    const [membership] = await adminDb
        .select({ organizationId: member.organizationId, status: member.status })
        .from(member)
        .where(and(
            eq(member.userId, String(userId)),
            eq(member.organizationId, organizationId),
        ))
        .limit(1);

    if (!membership) {
        throw new DomainError('El usuario no pertenece a esta empresa', 404);
    }
    if (options.active !== false && membership.status !== 'ACTIVE') {
        throw new DomainError('La membresía del usuario no está activa', 403, { code: 'MEMBERSHIP_SUSPENDED' });
    }

    return membership;
}

function hashInvitationToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
}

async function assertEntityBelongsToCompany(
    entityId: string | null | undefined,
    companyId: number,
): Promise<void> {
    if (!entityId) return;
    const [entity] = await adminDb
        .select({ id: entities.id })
        .from(entities)
        .where(and(
            eq(entities.id, entityId),
            eq(entities.company_id, companyId),
        ))
        .limit(1);

    if (!entity) {
        throw new DomainError('La entidad especificada no existe o no pertenece a esta empresa', 404);
    }
}

async function assertRolesBelongToTenant(roleIds: number[], companyId: number) {
    const uniqueRoleIds = [...new Set(roleIds)];
    if (uniqueRoleIds.length === 0) return [];

    const roles = await adminDb
        .select({
            id: authRoles.id,
            name: authRoles.name,
            is_system: authRoles.is_system,
            priority: authRoles.priority,
        })
        .from(authRoles)
        .where(and(
            eq(authRoles.company_id, companyId),
            inArray(authRoles.id, uniqueRoleIds),
        ));

    if (roles.length !== uniqueRoleIds.length) {
        throw new DomainError('Uno o más roles no pertenecen a la empresa actual', 403);
    }
    return roles;
}

/**
 * Verifies role hierarchy and anti-escalation before assigning roles to a user.
 * - Non-superadmin cannot assign system roles or roles with priority >= their own.
 * - Non-superadmin cannot assign a role containing permissions they do not possess.
 */
async function assertCallerCanAssignRoles(
    callerUserId: string | number,
    roleIds: number[],
    companyId: number,
): Promise<void> {
    const roles = await assertRolesBelongToTenant(roleIds, companyId);
    if (roles.length === 0) return;

    const callerIsSuper = await isUserSuperadmin(callerUserId, companyId);
    if (callerIsSuper) return;

    for (const role of roles) {
        await assertCanManageRole(callerUserId, role, companyId, 'asignar');
    }

    const callerPermissions = new Set(await getUserPermissions(callerUserId, companyId));
    const rolePermRows = await adminDb
        .selectDistinct({ slug: authRolePermissions.permission_slug })
        .from(authRolePermissions)
        .where(and(
            eq(authRolePermissions.company_id, companyId),
            inArray(authRolePermissions.role_id, roles.map(r => r.id)),
        ));

    const missingPerms = rolePermRows.map(r => r.slug).filter(slug => !callerPermissions.has(slug));
    if (missingPerms.length > 0) {
        throw new DomainError(
            'No puedes asignar un rol que contiene permisos superiores a los tuyos',
            403
        );
    }
}

/**
 * Light check to see if an email is already registered in Zelys or a member of the current company.
 * Never leaks PII (username/name) of global users who are not already members of this tenant.
 */
export async function checkUserEmail(email: string, companyId: number) {
    const organizationId = await getTenantOrganizationId(companyId);
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await adminDb.query.authUsers.findFirst({
        where: eq(authUsers.email, normalizedEmail),
        columns: { id: true, username: true, displayUsername: true, name: true },
    });

    if (!existingUser) {
        return { exists: false, isAlreadyMember: false };
    }

    const memberRow = await adminDb
        .select({ id: member.id })
        .from(member)
        .where(and(
            eq(member.userId, existingUser.id),
            eq(member.organizationId, organizationId)
        ))
        .limit(1);
    const isAlreadyMember = memberRow.length > 0;

    if (!isAlreadyMember) {
        return {
            exists: true,
            isAlreadyMember: false,
        };
    }

    return {
        exists: true,
        username: existingUser.username,
        displayUsername: existingUser.displayUsername || undefined,
        name: existingUser.name || undefined,
        isAlreadyMember: true,
    };
}

// Allowed columns for sorting (whitelist prevents SQL injection)
export const USERS_SORT_WHITELIST: Record<string, any> = {
    username: authUsers.username,
    email: authUsers.email,
    created_at: authUsers.createdAt,
    is_active: authUsers.is_active,
};

/**
 * Get paginated users with their roles.
 */
export async function getAllUsersWithRoles(filters: UsersListFilters = {}, companyId: number) {
    await getTenantOrganizationId(companyId);
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 15));
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (companyId) {
        // Filter by org membership (not denormalized company_id).
        // With user reuse across tenants, a user's company_id may point to their
        // original tenant, but they can be a member of multiple organizations.
        const memberSubquery = adminDb
            .select({ userId: member.userId })
            .from(member)
            .innerJoin(companies, eq(companies.organization_id, member.organizationId))
            .where(eq(companies.id, companyId));
        conditions.push(inArray(authUsers.id, memberSubquery));
    }
    if (filters.search) {
        const term = `%${filters.search}%`;
        const searchCond = or(ilike(authUsers.username, term), ilike(authUsers.email, term), ilike(authUsers.name, term));
        if (searchCond) conditions.push(searchCond);
    }
    if (filters.isActive && filters.isActive.length > 0) {
        const boolValues = filters.isActive.map(v => v === 'true');
        if (boolValues.length === 1) {
            const statusSubquery = adminDb
                .select({ userId: member.userId })
                .from(member)
                .innerJoin(companies, eq(companies.organization_id, member.organizationId))
                .where(and(
                    eq(companies.id, companyId),
                    boolValues[0] ? eq(member.status, 'ACTIVE') : ne(member.status, 'ACTIVE'),
                ));
            conditions.push(inArray(authUsers.id, statusSubquery));
        }
    }
    
    if (filters.roles && filters.roles.length > 0) {
        const rolesSubquery = db
            .select({ userId: authUserRoles.user_id })
            .from(authUserRoles)
            .innerJoin(authRoles, and(
                eq(authUserRoles.role_id, authRoles.id),
                eq(authUserRoles.company_id, authRoles.company_id),
            ))
            .where(and(
                eq(authUserRoles.company_id, companyId),
                inArray(authRoles.name, filters.roles),
            ));
            
        conditions.push(inArray(authUsers.id, rolesSubquery));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sortCol = filters.sortBy && USERS_SORT_WHITELIST[filters.sortBy]
        ? USERS_SORT_WHITELIST[filters.sortBy]
        : authUsers.username;
    const orderFn = filters.sortOrder === 'desc' ? desc : asc;

    // Resolve organization_id for the company to join member → entity
    let companyOrgId: string | null = null;
    if (companyId) {
        const [companyRow] = await adminDb
            .select({ orgId: companies.organization_id })
            .from(companies)
            .where(eq(companies.id, companyId))
            .limit(1);
        companyOrgId = companyRow?.orgId ?? null;
    }

    const [totalResult, users] = await withTenant(async () => Promise.all([
        db.select({ count: count() }).from(authUsers).where(where),
        db.select({
            id: authUsers.id,
            username: authUsers.username,
            name: authUsers.name,
            email: authUsers.email,
            image: authUsers.image,
            isActive: authUsers.is_active,
            membershipStatus: member.status,
            lastLogin: authUsers.last_login,
            entityId: entities.id,
            entityName: entities.business_name,
            entityTaxId: entities.tax_id,
            entityIsClient: entities.is_client,
            entityIsSupplier: entities.is_supplier,
            entityIsEmployee: entities.is_employee,
        })
        .from(authUsers)
        .leftJoin(
            member,
            companyOrgId
                ? and(eq(member.userId, authUsers.id), eq(member.organizationId, companyOrgId))
                : eq(member.userId, authUsers.id)
        )
        .leftJoin(entities, and(eq(entities.id, member.entityId), eq(entities.company_id, companyId)))
        .where(where)
        .orderBy(orderFn(sortCol))
        .limit(limit)
        .offset(offset),
    ]));

    const total = Number(totalResult[0]?.count ?? 0);
    const pageCount = Math.ceil(total / limit);

    const userIds = users.map(u => u.id);
    let roleMap = new Map<string, { id: number; name: string }[]>();

    if (userIds.length > 0) {
        const roleConditions = [inArray(authUserRoles.user_id, userIds)];
        if (companyId) {
            roleConditions.push(eq(authUserRoles.company_id, companyId));
        }

        const userRoles = await withTenant(async () => db
            .select({
                userId: authUserRoles.user_id,
                roleId: authRoles.id,
                roleName: authRoles.name,
            })
            .from(authUserRoles)
            .innerJoin(authRoles, and(
                eq(authUserRoles.role_id, authRoles.id),
                eq(authUserRoles.company_id, authRoles.company_id),
            ))
            .where(and(...roleConditions)));

        for (const ur of userRoles) {
            if (!roleMap.has(ur.userId)) roleMap.set(ur.userId, []);
            roleMap.get(ur.userId)!.push({ id: ur.roleId, name: ur.roleName });
        }
    }

    return {
        data: users.map(user => ({
            id: user.id,
            username: user.username || user.name,
            email: user.email,
            image: user.image ?? null,
            isActive: user.isActive && user.membershipStatus === 'ACTIVE',
            membershipStatus: user.membershipStatus,
            lastLogin: user.lastLogin,
            entityId: user.entityId,
            entity: user.entityId ? {
                id: user.entityId,
                businessName: user.entityName || '',
                taxId: user.entityTaxId || '',
                isClient: user.entityIsClient ?? false,
                isSupplier: user.entityIsSupplier ?? false,
                isEmployee: user.entityIsEmployee ?? false,
            } : null,
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
export async function getUserFacets(filters: { search?: string; isActive?: string[]; roles?: string[] }, companyId: number) {
    await getTenantOrganizationId(companyId);
    const cacheKey = `rbac:facets:users:${companyId}:${JSON.stringify(filters)}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const results: Record<string, { value: string; count: number }[]> = {};

        const activeConditions: SQL[] = [];
        if (companyId) {
            const memberSub = adminDb.select({ userId: member.userId })
                .from(member)
                .innerJoin(companies, eq(companies.organization_id, member.organizationId))
                .where(and(eq(companies.id, companyId), eq(member.status, 'ACTIVE')));
            activeConditions.push(inArray(authUsers.id, memberSub));
        }
        if (filters.search) {
            const term = `%${filters.search}%`;
            const searchCond = or(ilike(authUsers.username, term), ilike(authUsers.email, term), ilike(authUsers.name, term));
            if (searchCond) activeConditions.push(searchCond);
        }
        if (filters.roles && filters.roles.length > 0) {
            const rolesSubquery = db
                .select({ userId: authUserRoles.user_id })
                .from(authUserRoles)
                .innerJoin(authRoles, and(
                    eq(authUserRoles.role_id, authRoles.id),
                    eq(authUserRoles.company_id, authRoles.company_id),
                ))
                .where(and(
                    eq(authUserRoles.company_id, companyId),
                    inArray(authRoles.name, filters.roles),
                ));
            activeConditions.push(inArray(authUsers.id, rolesSubquery));
        }
        const activeWhere = activeConditions.length > 0 ? and(...activeConditions) : undefined;

        const activeRows = await withTenant(async () => db
            .select({
                value: sql<string>`CAST(${authUsers.is_active} AS TEXT)`,
                count: count(),
            })
            .from(authUsers)
            .where(activeWhere)
            .groupBy(authUsers.is_active)
            .orderBy(desc(count())));

        results['isActive'] = activeRows.filter(r => r.value !== null).map(r => ({ value: r.value, count: Number(r.count) }));

        const rolesConditions: SQL[] = [];
        if (companyId) {
            const memberSub = adminDb.select({ userId: member.userId })
                .from(member)
                .innerJoin(companies, eq(companies.organization_id, member.organizationId))
                .where(and(eq(companies.id, companyId), eq(member.status, 'ACTIVE')));
            rolesConditions.push(inArray(authUsers.id, memberSub));
        }
        if (filters.search) {
            const term = `%${filters.search}%`;
            const searchCond = or(ilike(authUsers.username, term), ilike(authUsers.email, term), ilike(authUsers.name, term));
            if (searchCond) rolesConditions.push(searchCond);
        }
        if (filters.isActive && filters.isActive.length > 0) {
            const boolValues = filters.isActive.map(v => v === 'true');
            if (boolValues.length === 1) {
                rolesConditions.push(eq(authUsers.is_active, boolValues[0]));
            }
        }
        const rolesWhere = rolesConditions.length > 0 ? and(...rolesConditions) : undefined;

        const rolesRows = await withTenant(async () => db
            .select({
                value: authRoles.name,
                count: sql<number>`count(DISTINCT ${authUsers.id})`.mapWith(Number),
            })
            .from(authUsers)
            .innerJoin(authUserRoles, and(
                eq(authUsers.id, authUserRoles.user_id),
                eq(authUserRoles.company_id, companyId),
            ))
            .innerJoin(authRoles, and(
                eq(authUserRoles.role_id, authRoles.id),
                eq(authUserRoles.company_id, authRoles.company_id),
            ))
            .where(rolesWhere)
            .groupBy(authRoles.name)
            .orderBy(desc(sql`count(DISTINCT ${authUsers.id})`)));

        results['roles'] = rolesRows.filter(r => r.value !== null);

        return results;
    }, 120);
}

/**
 * Get a single user by ID with their roles
 */
export async function getUserById(id: string | number, companyId: number) {
    const idStr = String(id);
    const membership = await requireTenantMembership(idStr, companyId, { active: false });

    const user = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, idStr),
        columns: {
            id: true,
            username: true,
            name: true,
            email: true,
            image: true,
            is_active: true,
            last_login: true,
        },
    });

    if (!user) throw new DomainError('Usuario no encontrado', 404);

    // Resolve entity from member table (per-org)
    let entityData: { id: string; businessName: string; taxId: string; isClient: boolean; isSupplier: boolean; isEmployee: boolean } | null = null;
    let entityId: string | null = null;

    if (companyId) {
        const [memberRow] = await adminDb
            .select({
                entityId: entities.id,
                entityBusinessName: entities.business_name,
                entityTaxId: entities.tax_id,
                entityIsClient: entities.is_client,
                entityIsSupplier: entities.is_supplier,
                entityIsEmployee: entities.is_employee,
            })
            .from(member)
            .innerJoin(companies, eq(companies.organization_id, member.organizationId))
            .leftJoin(entities, and(eq(entities.id, member.entityId), eq(entities.company_id, companyId)))
            .where(and(eq(member.userId, idStr), eq(companies.id, companyId)))
            .limit(1);

        if (memberRow?.entityId) {
            entityId = memberRow.entityId;
            entityData = {
                id: memberRow.entityId,
                businessName: memberRow.entityBusinessName || '',
                taxId: memberRow.entityTaxId || '',
                isClient: memberRow.entityIsClient ?? false,
                isSupplier: memberRow.entityIsSupplier ?? false,
                isEmployee: memberRow.entityIsEmployee ?? false,
            };
        }
    }

    const roleConditions = [eq(authUserRoles.user_id, idStr), eq(authUserRoles.company_id, companyId)];

    const roles = await withTenant(async () => db
        .select({ id: authRoles.id, name: authRoles.name, description: authRoles.description })
        .from(authUserRoles)
        .innerJoin(authRoles, and(
            eq(authUserRoles.role_id, authRoles.id),
            eq(authUserRoles.company_id, authRoles.company_id),
        ))
        .where(and(...roleConditions)));

    // Check if user belongs to more than 1 organization (multi-tenant global user)
    const [membershipCountRow] = await adminDb
        .select({ count: count() })
        .from(member)
        .where(eq(member.userId, idStr));
    const isGlobalUser = Number(membershipCountRow?.count ?? 0) > 1;

    return {
        id: user.id,
        username: user.username || user.name,
        email: user.email,
        image: user.image ?? null,
        isActive: user.is_active && membership.status === 'ACTIVE',
        membershipStatus: membership.status,
        lastLogin: user.last_login,
        entityId,
        entity: entityData,
        roles,
        isGlobalUser,
    };
}

/**
 * Get roles for a specific user scoped to a company
 */
export async function getUserRolesById(userId: string | number, companyId: number) {
    const userIdStr = String(userId);
    await requireTenantMembership(userIdStr, companyId, { active: false });
    const conditions = [eq(authUserRoles.user_id, userIdStr), eq(authUserRoles.company_id, companyId)];

    return withTenant(async () => db
        .select({
            id: authRoles.id,
            name: authRoles.name,
            description: authRoles.description,
        })
        .from(authUserRoles)
        .innerJoin(authRoles, and(
            eq(authUserRoles.role_id, authRoles.id),
            eq(authUserRoles.company_id, authRoles.company_id),
        ))
        .where(and(...conditions)));
}

/**
 * Assign roles to a user (with hierarchy, anti-escalation, seat quota transition, and min-1-role checks).
 * When `options.tx` is supplied (e.g. from `updateUser`), runs atomically inside the caller's transaction
 * to avoid nested transaction self-deadlocks on `pg_advisory_xact_lock`.
 */
export async function assignUserRoles(
    userId: string | number,
    roleIds: number[],
    currentUserId: string | number,
    companyId: number,
    options: { tx?: Tx; skipSeatQuotaCheck?: boolean } = {},
) {
    const userIdStr = String(userId);
    const uniqueRoleIds = [...new Set(roleIds)];
    if (uniqueRoleIds.length === 0) {
        throw new DomainError('El usuario debe tener al menos un rol asignado', 400);
    }

    const user = await adminDb.query.authUsers.findFirst({
        where: eq(authUsers.id, userIdStr),
    });

    if (!user) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    let organizationId: string;
    if (options.tx) {
        organizationId = await getTenantOrganizationId(companyId);
    } else {
        await requireTenantMembership(currentUserId, companyId);
        const membership = await requireTenantMembership(userIdStr, companyId);
        organizationId = membership.organizationId;
        await assertCanManageTargetUser(currentUserId, userIdStr, companyId, 'modificar roles de');
    }

    const oldRoles = await withTenant(async () => db
        .select({ id: authUserRoles.role_id })
        .from(authUserRoles)
        .where(and(eq(authUserRoles.user_id, userIdStr), eq(authUserRoles.company_id, companyId))));
    const oldRoleIds = oldRoles.map(r => r.id);

    // Superadmin protection: exactly 1 superadmin per company (the owner)
    const isTargetSuperadmin = await isUserSuperadmin(userIdStr, companyId);
    const superadminRole = await adminDb.query.authRoles.findFirst({
        where: and(eq(authRoles.company_id, companyId), eq(authRoles.name, SYSTEM_ROLES.SUPERADMIN)),
    });

    const finalRoleIds = [...uniqueRoleIds];
    if (superadminRole) {
        if (isTargetSuperadmin) {
            // The owner can never lose their superadmin role
            if (!finalRoleIds.includes(superadminRole.id)) {
                finalRoleIds.push(superadminRole.id);
            }
        } else {
            // No other user can be granted the superadmin role
            if (finalRoleIds.includes(superadminRole.id)) {
                throw new DomainError('El rol superadmin es exclusivo del propietario de la empresa y no puede ser asignado', 403);
            }
        }
    }

    await assertCallerCanAssignRoles(currentUserId, finalRoleIds, companyId);

    const persistRoles = async (tx: Tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${companyId})`);

        // If this user currently occupies the free exclusive accountant seat and is
        // changing to any non-exclusive role set (e.g. adding admin or switching to vendedor),
        // enforce regular user seat quota atomically before mutating roles.
        if (!options.skipSeatQuotaCheck) {
            const usage = await getCompanySeatUsage(companyId, organizationId, tx);
            if (
                usage.freeAccountantUserId === userIdStr
                && !isExclusiveAccountantRole(finalRoleIds, usage.accountantRoleId)
            ) {
                const check = await canCreateUser(companyId, usage.regularActiveUsers, false);
                if (!check.allowed) {
                    throw new DomainError(
                        check.reason || 'Límite de usuarios alcanzado para tu plan actual. Actualiza tu plan para cambiar el rol de este usuario.',
                        403,
                        { code: 'PLAN_LIMIT_EXCEEDED' }
                    );
                }
            }
        }

        // Delete only the roles assigned in THIS company, preserving roles in other tenants
        await tx.delete(authUserRoles).where(
            and(
                eq(authUserRoles.user_id, userIdStr),
                eq(authUserRoles.company_id, companyId)
            )
        );

        if (finalRoleIds.length > 0) {
            await tx.insert(authUserRoles).values(
                finalRoleIds.map(roleId => ({
                    user_id: userIdStr,
                    role_id: roleId,
                    company_id: companyId,
                }))
            );
        }
    };

    if (options.tx) {
        await persistRoles(options.tx);
        return { success: true };
    }

    await withTenant(async () => {
        await db.transaction(persistRoles);
    });

    await Promise.all([
        invalidateUserRbacCache(userIdStr, companyId),
        invalidateUserFacetsCache(companyId),
    ]);
    broadcastToUser(userIdStr, RealtimeEvents.USER.RBAC_CHANGED, { userId: userIdStr });
    broadcastToTenant(companyId, RealtimeEvents.USER.UPDATED, { id: userIdStr }, RealtimeEvents.ROOMS.USERS);

    logAudit(currentUserId, 'UPDATE', 'auth_user_roles', userIdStr, { roleIds: finalRoleIds }, { roleIds: oldRoleIds });

    return { success: true };
}

/**
 * Validates tenant seat quota before user creation or activation.
 * At most 1 active user whose ONLY role is 'contador' occupies the free accountant seat
 * (when included in the plan) and does not consume regular user quotas.
 */
export async function checkCompanySeatQuota(
    companyId: number,
    roleIds?: number[],
    dbClient: typeof adminDb | Tx = adminDb,
): Promise<void> {
    const [companyOrg] = await dbClient
        .select({ organization_id: companies.organization_id })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

    const [ent, usage] = await Promise.all([
        getTenantEntitlements(companyId),
        getCompanySeatUsage(companyId, companyOrg?.organization_id, dbClient),
    ]);

    const uniqueRoleIds = roleIds ? [...new Set(roleIds)] : [];
    const usesFreeAccountant = Boolean(
        ent.hasFreeAccountantSeat
        && !usage.accountantAssigned
        && isExclusiveAccountantRole(uniqueRoleIds, usage.accountantRoleId)
    );

    const check = await canCreateUser(companyId, usage.regularActiveUsers, usesFreeAccountant);
    if (!check.allowed) {
        throw new DomainError(
            check.reason || 'Límite de usuarios alcanzado para tu plan actual. Actualiza tu plan para agregar más usuarios.',
            403,
            { code: 'PLAN_LIMIT_EXCEEDED' }
        );
    }
}

/**
 * Create a new user through secure invitation only. Tenant administrators never
 * choose or receive a password for another user.
 */
export async function createUser(
    data: RbacUserCreateType,
    currentUserId: string | number,
    companyId: number
) {
    await requireTenantMembership(currentUserId, companyId);
    const organizationId = await getTenantOrganizationId(companyId);

    const uniqueRoleIds = [...new Set(data.roleIds ?? [])];
    if (uniqueRoleIds.length === 0) {
        throw new DomainError('Debes asignar al menos un rol al usuario', 400);
    }

    const normalizedEmail = data.email.trim().toLowerCase();
    const baseUsername = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    const normalizedUsername = (data.username?.trim() || baseUsername).toLowerCase();
    const displayName = data.username?.trim() || data.email.split('@')[0];
    if (data.mode !== undefined && data.mode !== 'invite') {
        throw new DomainError('La creación de usuarios se realiza únicamente mediante invitación segura', 400);
    }

    // 1. Validar que el rol superadmin nunca se asigne y que el llamador pueda asignar los roles
    const superadminRole = await adminDb.query.authRoles.findFirst({
        where: and(eq(authRoles.company_id, companyId), eq(authRoles.name, SYSTEM_ROLES.SUPERADMIN)),
    });
    if (superadminRole && uniqueRoleIds.includes(superadminRole.id)) {
        throw new DomainError('El rol superadmin es exclusivo del propietario de la empresa y no puede ser asignado', 403);
    }
    await assertCallerCanAssignRoles(currentUserId, uniqueRoleIds, companyId);

    // 2. Validar pertenencia de entityId a la empresa actual (cierre de IDOR)
    await assertEntityBelongsToCompany(data.entityId, companyId);

    // 3. Validar usuario global y unicidad de username / membresía en esta empresa
    const existingGlobalUser = await adminDb.query.authUsers.findFirst({
        where: eq(authUsers.email, normalizedEmail),
        columns: { id: true, username: true, email: true, name: true },
    });

    if (!existingGlobalUser) {
        const existingUsername = await adminDb.query.authUsers.findFirst({
            where: eq(authUsers.username, normalizedUsername),
        });

        if (existingUsername) {
            throw new DomainError('Ya existe un usuario con ese nombre de usuario', 409);
        }
    }

    const existingMember = await adminDb
        .select({ id: member.id })
        .from(member)
        .innerJoin(authUsers, eq(authUsers.id, member.userId))
        .where(and(
            eq(authUsers.email, normalizedEmail),
            eq(member.organizationId, organizationId)
        ))
        .limit(1);

    if (existingMember.length > 0) {
        throw new DomainError('Ya existe un usuario con ese email en esta empresa', 409);
    }

    // 4. Generate cryptographic 256-bit invitation token and store only its SHA-256 hash inside the transaction
    const rawActivationToken = randomBytes(32).toString('hex');
    const tokenHash = hashInvitationToken(rawActivationToken);
    const invitationExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const newUser = await withTenant(async () => db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${companyId})`);

        // Quota enforcement inside advisory lock: prevents concurrent invite race conditions
        await checkCompanySeatQuota(companyId, uniqueRoleIds, tx);

        if (existingGlobalUser) {
            // Existing Zelys user: create PENDING membership requiring explicit invitation acceptance.
            // Never auto-activate without user consent and never mutate their global profile.
            const memberId = uuidv7();

            await tx.insert(member).values({
                id: memberId,
                organizationId,
                userId: existingGlobalUser.id,
                role: 'member',
                status: 'PENDING',
                entityId: data.entityId || null,
            }).onConflictDoNothing();

            await tx.insert(authUserRoles).values(
                uniqueRoleIds.map(roleId => ({
                    user_id: existingGlobalUser.id,
                    role_id: roleId,
                    company_id: companyId,
                }))
            ).onConflictDoNothing();

            await tx.insert(verification).values({
                id: uuidv7(),
                identifier: `invitation:${normalizedEmail}:${organizationId}`,
                value: tokenHash,
                expiresAt: invitationExpiresAt,
            });

            return { id: existingGlobalUser.id, username: existingGlobalUser.username, email: existingGlobalUser.email };
        }

        // New user: create identity without credentials and PENDING membership.
        // The invitation acceptance flow creates the credential and activates the membership.
        const userId = uuidv7();
        const memberId = uuidv7();

        const user = await createCredentialIdentity(tx, {
            id: userId,
            name: displayName,
            username: normalizedUsername,
            displayUsername: displayName,
            email: normalizedEmail,
            companyId,
            emailVerified: false,
        });

        await tx.insert(member).values({
            id: memberId,
            organizationId,
            userId: user.id,
            role: 'member',
            status: 'PENDING',
            entityId: data.entityId || null,
        }).onConflictDoNothing();

        await tx.insert(authUserRoles).values(
            uniqueRoleIds.map(roleId => ({
                user_id: user.id,
                role_id: roleId,
                company_id: companyId,
            }))
        ).onConflictDoNothing();

        await tx.insert(verification).values({
            id: uuidv7(),
            identifier: `invitation:${normalizedEmail}:${organizationId}`,
            value: tokenHash,
            expiresAt: invitationExpiresAt,
        });

        return user;
    }));

    await Promise.all([
        cacheService.invalidate(`tenant:member:${companyId}:${newUser.id}`),
        invalidateUserFacetsCache(companyId),
    ]);
    broadcastToTenant(companyId, RealtimeEvents.USER.CREATED, { id: newUser.id }, RealtimeEvents.ROOMS.USERS);

    if (currentUserId) {
        logAudit(currentUserId, 'INSERT', 'user', newUser.id, {
            username: existingGlobalUser ? existingGlobalUser.username : displayName,
            email: normalizedEmail,
            roleIds: uniqueRoleIds,
            entityId: data.entityId ?? null,
            membershipStatus: 'PENDING',
            existingGlobalUser: Boolean(existingGlobalUser),
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Send Invitation Email (Both new & existing global users must explicitly accept)
    // ──────────────────────────────────────────────────────────────────────────
    if (data.sendEmail !== false) {
        (async () => {
            try {
                const [comp] = await adminDb
                    .select({
                        business_name: companies.business_name,
                        trade_name: companies.trade_name,
                        slug: companies.slug,
                    })
                    .from(companies)
                    .where(eq(companies.id, companyId))
                    .limit(1);

                if (comp) {
                    const companyName = comp.trade_name || comp.business_name;

                    const assignedRoles = await adminDb
                        .select({ name: authRoles.name })
                        .from(authRoles)
                        .where(and(
                            inArray(authRoles.id, uniqueRoleIds),
                            eq(authRoles.company_id, companyId),
                        ));
                    const roleNames = assignedRoles.map(r => r.name);

                    let inviterName: string | undefined;
                    if (currentUserId) {
                        const inviter = await adminDb.query.authUsers.findFirst({
                            where: eq(authUsers.id, String(currentUserId)),
                            columns: { name: true, displayUsername: true, username: true },
                        });
                        inviterName = inviter?.name || inviter?.displayUsername || inviter?.username;
                    }

                    const existingFlag = existingGlobalUser ? '&existing=1' : '';
                    const inviteUrl = `${resolveTenantUrl(comp.slug)}/accept-invitation?token=${rawActivationToken}&email=${encodeURIComponent(normalizedEmail)}${existingFlag}`;

                    await emailService.sendOrganizationInvitationEmail(normalizedEmail, {
                        companyName,
                        inviteUrl,
                        roleNames,
                        userName: existingGlobalUser?.name || displayName,
                        inviterName,
                    });
                }
            } catch (err) {
                console.error('[RBAC] Error sending organization user invitation email:', err);
            }
        })();
    }

    return newUser;
}

/**
 * Accept user invitation: verifies SHA-256 hashed activation token, checks seat quota atomically,
 * sets initial password for new users (without trimming) or activates consent-based membership for existing users.
 */
export async function acceptUserInvitation(data: { token: string; email: string; password?: string }) {
    const normalizedEmail = data.email.trim().toLowerCase();
    const invitationPrefix = `invitation:${normalizedEmail}:`;
    const tokenHash = hashInvitationToken(data.token.trim());

    const result = await adminDb.transaction(async (tx) => {
        // Delete-and-return is the atomic one-use claim. If any subsequent
        // validation fails, the transaction rolls back and the invitation
        // remains available for a legitimate retry.
        const [tokenRecord] = await tx
            .delete(verification)
            .where(and(
                like(verification.identifier, `${invitationPrefix}%`),
                eq(verification.value, tokenHash),
                gt(verification.expiresAt, new Date()),
            ))
            .returning({ id: verification.id, identifier: verification.identifier });

        if (!tokenRecord) {
            throw new DomainError('El enlace de invitación es inválido o expiró', 400);
        }

        const invitedOrganizationId = tokenRecord.identifier.slice(invitationPrefix.length);
        if (!invitedOrganizationId) {
            throw new DomainError('La invitación no está vinculada a una organización válida', 400);
        }

        const [company] = await tx
            .select({ id: companies.id, isActive: companies.is_active })
            .from(companies)
            .where(eq(companies.organization_id, invitedOrganizationId))
            .limit(1);
        if (!company || !company.isActive) {
            throw new DomainError('La empresa asociada a esta invitación no está disponible', 403);
        }

        await tx.execute(sql`SELECT pg_advisory_xact_lock(${company.id})`);

        const targetUser = await tx.query.authUsers.findFirst({
            where: eq(authUsers.email, normalizedEmail),
            columns: { id: true, emailVerified: true, is_active: true },
        });
        if (!targetUser) throw new DomainError('Usuario no encontrado', 404);
        if (targetUser.is_active === false) {
            throw new DomainError('Esta cuenta se encuentra desactivada', 403);
        }

        const [invitedMembership] = await tx
            .select({ id: member.id, status: member.status })
            .from(member)
            .where(and(
                eq(member.userId, targetUser.id),
                eq(member.organizationId, invitedOrganizationId),
            ))
            .limit(1);
        if (!invitedMembership) {
            throw new DomainError('La invitación no pertenece a este usuario', 403);
        }
        if (invitedMembership.status !== 'PENDING') {
            throw new DomainError('Esta invitación ya fue procesada o la membresía fue revocada', 409);
        }

        // Check if this user already has a verified identity or login account (existing global user)
        const [existingAccount] = await tx
            .select({ id: account.id })
            .from(account)
            .where(eq(account.userId, targetUser.id))
            .limit(1);
        const isExistingUser = Boolean(targetUser.emailVerified || existingAccount);

        // Enforce tenant seat quota right before activating the membership
        const assignedRoles = await tx
            .select({ roleId: authUserRoles.role_id })
            .from(authUserRoles)
            .where(and(
                eq(authUserRoles.user_id, targetUser.id),
                eq(authUserRoles.company_id, company.id),
            ));
        await checkCompanySeatQuota(company.id, assignedRoles.map(r => r.roleId), tx);

        if (!isExistingUser) {
            // Preserve exact password bytes (never .trim() passwords)
            if (typeof data.password !== 'string' || data.password.length < 8) {
                throw new DomainError('Debes definir una contraseña de al menos 8 caracteres', 400);
            }
            const newPasswordHash = await hashPassword(data.password);
            await replaceCredentialPassword(tx, targetUser.id, newPasswordHash);

            await tx.update(authUsers)
                .set({ emailVerified: true, is_active: true, updatedAt: new Date() })
                .where(eq(authUsers.id, targetUser.id));
        }

        // Activate tenant membership
        await tx.update(member)
            .set({ status: 'ACTIVE', suspendedAt: null, suspendedBy: null })
            .where(eq(member.id, invitedMembership.id));

        return {
            organizationId: invitedOrganizationId,
            companyId: company.id,
            userId: targetUser.id,
            isExistingUser,
        };
    });

    await Promise.all([
        invalidateUserRbacCache(result.userId, result.companyId),
        cacheService.invalidate(`tenant:member:${result.companyId}:${result.userId}`),
        invalidateUserFacetsCache(result.companyId),
    ]);
    broadcastToTenant(result.companyId, RealtimeEvents.USER.UPDATED, { userId: result.userId }, RealtimeEvents.ROOMS.USERS);

    return {
        success: true,
        email: normalizedEmail,
        organizationId: result.organizationId,
        requiresLogin: true,
        isExistingUser: result.isExistingUser,
    };
}

/**
 * Get all users with a specific role scoped to a company
 */
export async function getUsersByRole(roleId: number, companyId: number) {
    const conditions = [eq(authUserRoles.role_id, roleId), eq(authUserRoles.company_id, companyId)];
    await getTenantOrganizationId(companyId);

    const usersInRole = await withTenant(async () => db
        .select({
            id: authUsers.id,
            username: authUsers.username,
            name: authUsers.name,
            email: authUsers.email,
            image: authUsers.image,
            isActive: authUsers.is_active,
        })
        .from(authUserRoles)
        .innerJoin(authUsers, eq(authUserRoles.user_id, authUsers.id))
        .where(and(...conditions)));

    return usersInRole.map(u => ({ ...u, username: u.username || u.name, image: u.image ?? null }));
}

/**
 * Remove a user from a specific role scoped to a company
 */
export async function removeUserFromRole(
    userId: string | number,
    roleId: number,
    currentUserId: string | number,
    companyId: number,
) {
    const userIdStr = String(userId);
    const currentUserIdStr = String(currentUserId);
    if (userIdStr === currentUserIdStr) {
        throw new DomainError('No puedes remover tus propios roles', 403);
    }

    await requireTenantMembership(currentUserIdStr, companyId);
    await requireTenantMembership(userIdStr, companyId, { active: false });
    await assertCanManageTargetUser(currentUserIdStr, userIdStr, companyId, 'remover roles de');

    await withTenant(async () => {
        const role = await db.query.authRoles.findFirst({
            where: and(eq(authRoles.id, roleId), eq(authRoles.company_id, companyId)),
        });
        if (!role) {
            throw new DomainError('Rol no encontrado', 404);
        }
        if (role.name === SYSTEM_ROLES.SUPERADMIN) {
            throw new DomainError('No se puede remover el rol superadmin del propietario de la empresa', 403);
        }

        await assertCanManageRole(currentUserIdStr, role, companyId, 'remover');

        const currentUserRoles = await db
            .select({ roleId: authUserRoles.role_id })
            .from(authUserRoles)
            .where(and(
                eq(authUserRoles.user_id, userIdStr),
                eq(authUserRoles.company_id, companyId),
            ));

        if (currentUserRoles.length <= 1 && currentUserRoles.some(r => r.roleId === roleId)) {
            throw new DomainError('No se puede dejar al usuario sin roles asignados en la empresa', 400);
        }

        await db
            .delete(authUserRoles)
            .where(and(
                eq(authUserRoles.user_id, userIdStr),
                eq(authUserRoles.role_id, roleId),
                eq(authUserRoles.company_id, companyId),
            ))
            .returning();
    });

    await Promise.all([
        invalidateUserRbacCache(userIdStr, companyId),
        invalidateUserFacetsCache(companyId),
    ]);
    broadcastToUser(userIdStr, RealtimeEvents.USER.RBAC_CHANGED, { userId: userIdStr });
    broadcastToTenant(companyId, RealtimeEvents.USER.UPDATED, { id: userIdStr }, RealtimeEvents.ROOMS.USERS);

    logAudit(currentUserIdStr, 'DELETE', 'auth_user_roles', userIdStr, { removedRoleId: roleId, companyId });

    return { success: true };
}

/**
 * Update user details (scoped to company context: roles, entity link, and status)
 */
export async function updateUser(
    userId: string | number,
    data: { roleIds?: number[]; entityId?: string | null; isActive?: boolean; username?: string; email?: string },
    currentUserId: string | number,
    companyId: number
) {
    const userIdStr = String(userId);
    const currentUserIdStr = String(currentUserId);

    const user = await adminDb.query.authUsers.findFirst({
        where: eq(authUsers.id, userIdStr),
        columns: { id: true, username: true, email: true, is_active: true },
    });

    if (!user) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    await requireTenantMembership(currentUserIdStr, companyId);
    const membership = await requireTenantMembership(userIdStr, companyId, { active: false });
    await assertCanManageTargetUser(currentUserIdStr, userIdStr, companyId, 'modificar');

    if (data.entityId !== undefined) {
        await assertEntityBelongsToCompany(data.entityId, companyId);
    }

    const companyOrgId = await getTenantOrganizationId(companyId);

    await withTenant(async () => db.transaction(async (tx) => {
        // 1. Update entity link in member table (scoped to this tenant)
        if (data.entityId !== undefined && companyOrgId) {
            await tx.update(member)
                .set({ entityId: data.entityId || null })
                .where(and(
                    eq(member.userId, userIdStr),
                    eq(member.organizationId, companyOrgId)
                ));
        }

        // 2. If reactivating membership, check seat quota and activate BEFORE assigning roles
        // so assignUserRoles sees an ACTIVE membership.
        const isReactivating = data.isActive === true && membership.status !== 'ACTIVE';
        if (isReactivating) {
            await tx.execute(sql`SELECT pg_advisory_xact_lock(${companyId})`);
            const userRolesRows = await tx
                .select({ roleId: authUserRoles.role_id })
                .from(authUserRoles)
                .where(and(
                    eq(authUserRoles.user_id, userIdStr),
                    eq(authUserRoles.company_id, companyId)
                ));
            const roleIds = data.roleIds ?? userRolesRows.map(r => r.roleId);
            await checkCompanySeatQuota(companyId, roleIds, tx);

            await tx.update(member)
                .set({
                    status: 'ACTIVE',
                    suspendedAt: null,
                    suspendedBy: null,
                })
                .where(and(
                    eq(member.userId, userIdStr),
                    eq(member.organizationId, companyOrgId),
                ));
        }

        // 3. Update roles in auth_user_roles (scoped to this company, sharing the same tx)
        if (data.roleIds !== undefined) {
            await assignUserRoles(userIdStr, data.roleIds, currentUserIdStr, companyId, {
                tx,
                skipSeatQuotaCheck: isReactivating,
            });
        }

        // 4. If deactivating membership, validate and suspend
        if (data.isActive === false) {
            if (userIdStr === currentUserIdStr) {
                throw new DomainError('No puedes desactivar tu propia cuenta', 403);
            }
            await assertNotSuperadmin(userIdStr, companyId, 'desactivar');

            await tx.update(member)
                .set({
                    status: 'SUSPENDED',
                    suspendedAt: new Date(),
                    suspendedBy: currentUserIdStr,
                })
                .where(and(
                    eq(member.userId, userIdStr),
                    eq(member.organizationId, companyOrgId),
                ));
        }
    }));

    if (data.isActive === false) {
        await revokeTenantUserSessions(userIdStr, companyId);
    }

    await Promise.all([
        invalidateUserRbacCache(userIdStr, companyId),
        cacheService.invalidate(`tenant:member:${companyId}:${userIdStr}`),
        invalidateUserFacetsCache(companyId),
    ]);
    if (data.roleIds !== undefined) {
        broadcastToUser(userIdStr, RealtimeEvents.USER.RBAC_CHANGED, { userId: userIdStr });
    }
    broadcastToTenant(companyId, RealtimeEvents.USER.UPDATED, { userId: userIdStr }, RealtimeEvents.ROOMS.USERS);

    if (currentUserId) {
        logAudit(currentUserId, 'UPDATE', 'user', userIdStr, data, {
            username: user.username,
            email: user.email,
            is_active: user.is_active,
            membership_status: membership.status,
        });
    }

    return {
        id: user.id,
        username: user.username,
        email: user.email,
        isActive: data.isActive !== undefined ? data.isActive : membership.status === 'ACTIVE',
        membershipStatus: data.isActive === undefined ? membership.status : data.isActive ? 'ACTIVE' : 'SUSPENDED',
        company_id: companyId,
    };
}

/**
 * Deactivate a user (soft-delete scoped to tenant context)
 */
export async function deactivateUser(userId: string | number, currentUserId: string | number, companyId: number) {
    const userIdStr = String(userId);
    const currentUserIdStr = String(currentUserId);
    if (userIdStr === currentUserIdStr) {
        throw new DomainError('No puedes desactivar tu propia cuenta', 403);
    }

    const targetUser = await adminDb.query.authUsers.findFirst({ where: eq(authUsers.id, userIdStr) });
    if (!targetUser) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    await requireTenantMembership(currentUserIdStr, companyId);
    const membership = await requireTenantMembership(userIdStr, companyId, { active: false });
    await assertNotSuperadmin(userIdStr, companyId, 'desactivar');
    await assertCanManageTargetUser(currentUserIdStr, userIdStr, companyId, 'desactivar');

    const [updated] = await adminDb
        .update(member)
        .set({ status: 'SUSPENDED', suspendedAt: new Date(), suspendedBy: currentUserIdStr })
        .where(and(
            eq(member.userId, userIdStr),
            eq(member.organizationId, membership.organizationId),
        ))
        .returning();

    if (!updated) throw new DomainError('Membresía no encontrada', 404);

    await revokeTenantUserSessions(userIdStr, companyId);
    await Promise.all([
        invalidateUserRbacCache(userIdStr, companyId),
        cacheService.invalidate(`tenant:member:${companyId}:${userIdStr}`),
        invalidateUserFacetsCache(companyId),
    ]);
    broadcastToUser(userIdStr, RealtimeEvents.USER.SESSION_REVOKED, { userId: userIdStr });
    broadcastToTenant(companyId, RealtimeEvents.USER.UPDATED, { userId: userIdStr }, RealtimeEvents.ROOMS.USERS);

    logAudit(currentUserId, 'UPDATE', 'member', userIdStr, { status: 'SUSPENDED' }, { status: membership.status });

    return { success: true };
}

/**
 * Restore a deactivated user
 */
export async function restoreUser(userId: string | number, currentUserId: string | number, companyId: number) {
    const userIdStr = String(userId);
    const currentUserIdStr = String(currentUserId);
    if (userIdStr === currentUserIdStr) {
        throw new DomainError('No puedes restaurar tu propia cuenta', 403);
    }

    const targetUser = await adminDb.query.authUsers.findFirst({ where: eq(authUsers.id, userIdStr) });
    if (!targetUser) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    await requireTenantMembership(currentUserIdStr, companyId);
    const membership = await requireTenantMembership(userIdStr, companyId, { active: false });
    await assertCanManageTargetUser(currentUserIdStr, userIdStr, companyId, 'restaurar');

    if (membership.status === 'PENDING') {
        throw new DomainError('El usuario tiene una invitación pendiente de aceptación', 409);
    }

    await adminDb.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${companyId})`);

        const userRolesRows = await tx
            .select({ roleId: authUserRoles.role_id })
            .from(authUserRoles)
            .where(and(
                eq(authUserRoles.user_id, userIdStr),
                eq(authUserRoles.company_id, companyId)
            ));
        await checkCompanySeatQuota(companyId, userRolesRows.map(r => r.roleId), tx);

        const [updated] = await tx
            .update(member)
            .set({ status: 'ACTIVE', suspendedAt: null, suspendedBy: null })
            .where(and(
                eq(member.userId, userIdStr),
                eq(member.organizationId, membership.organizationId),
            ))
            .returning();

        if (!updated) {
            throw new DomainError('Usuario no encontrado', 404);
        }
    });

    await Promise.all([
        invalidateUserRbacCache(userIdStr, companyId),
        cacheService.invalidate(`tenant:member:${companyId}:${userIdStr}`),
        invalidateUserFacetsCache(companyId),
    ]);
    broadcastToTenant(companyId, RealtimeEvents.USER.UPDATED, { userId: userIdStr }, RealtimeEvents.ROOMS.USERS);

    logAudit(currentUserId, 'UPDATE', 'member', userIdStr, { status: 'ACTIVE' }, { status: membership.status });

    return { success: true };
}

/**
 * Remove a user from the company (removes tenant membership and roles; only purges global account if 0 other memberships remain)
 */
export async function hardDeleteUser(userId: string | number, currentUserId: string | number, companyId: number) {
    const userIdStr = String(userId);
    const currentUserIdStr = String(currentUserId);
    if (userIdStr === currentUserIdStr) {
        throw new DomainError('No puedes remover tu propia cuenta', 403);
    }

    const targetUser = await adminDb.query.authUsers.findFirst({ where: eq(authUsers.id, userIdStr) });
    if (!targetUser) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    await requireTenantMembership(currentUserIdStr, companyId);
    await requireTenantMembership(userIdStr, companyId, { active: false });
    await assertNotSuperadmin(userIdStr, companyId, 'remover');
    await assertCanManageTargetUser(currentUserIdStr, userIdStr, companyId, 'remover');

    const companyOrgId = await getTenantOrganizationId(companyId);

    let purgedGlobalAccount = false;
    await withTenant(async () => db.transaction(async (tx) => {
        // 1. Remove roles assigned in THIS company
        await tx.delete(authUserRoles).where(
            and(
                eq(authUserRoles.user_id, userIdStr),
                eq(authUserRoles.company_id, companyId)
            )
        );

        // 2. Remove membership in THIS company's organization
        if (companyOrgId) {
            await tx.delete(member).where(
                and(
                    eq(member.userId, userIdStr),
                    eq(member.organizationId, companyOrgId)
                )
            );
        }

        // 3. Check if user belongs to ANY other organizations
        const otherMemberships = await tx.select({ id: member.id })
            .from(member)
            .where(eq(member.userId, userIdStr));

        if (otherMemberships.length === 0) {
            purgedGlobalAccount = true;
            await tx.delete(authUsers).where(eq(authUsers.id, userIdStr));
        }
    }));

    if (purgedGlobalAccount) {
        await revokeAllUserSessions(userIdStr);
    } else {
        await revokeTenantUserSessions(userIdStr, companyId);
    }

    await Promise.all([
        invalidateUserRbacCache(userIdStr, companyId),
        cacheService.invalidate(`tenant:member:${companyId}:${userIdStr}`),
        invalidateUserFacetsCache(companyId),
    ]);
    broadcastToTenant(companyId, RealtimeEvents.USER.DELETED, { userId: userIdStr }, RealtimeEvents.ROOMS.USERS);

    logAudit(currentUserId, 'DELETE', 'user', userIdStr, undefined, { username: targetUser.username, email: targetUser.email });

    return { success: true };
}

/**
 * Pre-flight check for hard delete
 */
export async function checkUserReferences(userId: string | number, companyId: number) {
    const userIdStr = String(userId);
    const user = await adminDb.query.authUsers.findFirst({ where: eq(authUsers.id, userIdStr) });
    if (!user) throw new DomainError('Usuario no encontrado', 404);
    await requireTenantMembership(userIdStr, companyId, { active: false });

    const isSuper = await isUserSuperadmin(userIdStr, companyId);
    const orgId = await getTenantOrganizationId(companyId);

    const [rolesResult, sessionsResult] = await withTenant(async () => Promise.all([
        db.select({ count: count() }).from(authUserRoles).where(and(
            eq(authUserRoles.user_id, userIdStr),
            eq(authUserRoles.company_id, companyId),
        )),
        adminDb.select({ count: count() })
            .from(sessions)
            .where(and(
                eq(sessions.userId, userIdStr),
                eq(sessions.activeOrganizationId, orgId),
            )),
    ]));

    const rolesCount = Number(rolesResult[0]?.count ?? 0);
    const activeSessionsCount = Number(sessionsResult[0]?.count ?? 0);
    const total = rolesCount + activeSessionsCount;

    return { roles: rolesCount, activeSessions: activeSessionsCount, total, canDelete: !isSuper };
}

/**
 * Get paginated audit log for a specific user
 */
export async function getUserAuditLog(userId: string | number, companyId: number, page: number = 1, limit: number = 20) {
    const userIdStr = String(userId);
    await requireTenantMembership(userIdStr, companyId, { active: false });
    const offset = (page - 1) * limit;
    const condition = and(eq(auditLogs.userId, userIdStr), eq(auditLogs.company_id, companyId));

    const [totalResult, entries] = await withTenant(async () => Promise.all([
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
    ]));

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
 * Request a Better Auth password reset for a tenant member.
 * Administrators never receive or write a user's password directly.
 * Blocked on superadmin, peers of equal/higher rank, and multi-tenant global users.
 */
export async function adminResetPassword(
    adminUserId: string | number,
    targetUserId: string | number,
    companyId: number,
) {
    const adminUserIdStr = String(adminUserId);
    const targetUserIdStr = String(targetUserId);
    if (adminUserIdStr === targetUserIdStr) {
        throw new DomainError('Usa el cambio de contraseña personal para tu propia cuenta', 400);
    }

    await requireTenantMembership(adminUserIdStr, companyId);
    await requireTenantMembership(targetUserIdStr, companyId);
    await assertNotSuperadmin(targetUserIdStr, companyId, 'restablecer la contraseña de');
    await assertCanManageTargetUser(adminUserIdStr, targetUserIdStr, companyId, 'restablecer la contraseña de');

    const organizationId = await getTenantOrganizationId(companyId);
    const otherMemberships = await adminDb
        .select({ id: member.id })
        .from(member)
        .where(and(
            eq(member.userId, targetUserIdStr),
            ne(member.organizationId, organizationId),
        ))
        .limit(1);

    if (otherMemberships.length > 0) {
        throw new DomainError(
            'Este usuario pertenece a múltiples empresas en Zelys. Por seguridad, debe restablecer su contraseña desde la opción de recuperación personal.',
            403
        );
    }

    const user = await adminDb.query.authUsers.findFirst({
        where: eq(authUsers.id, targetUserIdStr),
    });
    if (!user) throw new DomainError('Usuario no encontrado', 404);

    await revokeAllUserSessions(targetUserIdStr);

    const response = await auth.api.requestPasswordReset({
        body: {
            email: user.email,
            redirectTo: `${resolveTenantUrl((await adminDb
                .select({ slug: companies.slug })
                .from(companies)
                .where(eq(companies.id, companyId))
                .limit(1))[0]?.slug ?? '')}/reset-password`,
        },
    });

    if (!response?.status) {
        throw new DomainError('No se pudo solicitar el restablecimiento de contraseña', 503);
    }

    logAudit(adminUserId, 'UPDATE', 'user', targetUserIdStr, { field: 'password', action: 'reset_requested', companyId });

    return { success: true };
}

/**
 * Assign or unassign an entity to a user's organization membership.
 * Updates member.entityId (per-org entity mapping), NOT user.entity_id.
 */
export async function setUserEntity(
    userId: string | number,
    entityId: string | null,
    companyId: number,
    currentUserId?: string | number,
) {
    const userIdStr = String(userId);

    if (currentUserId) {
        await requireTenantMembership(currentUserId, companyId);
        await assertCanManageTargetUser(currentUserId, userIdStr, companyId, 'asignar entidad a');
    }

    // Explicitly validate entity belongs to current company (closes cross-tenant IDOR)
    await assertEntityBelongsToCompany(entityId, companyId);

    const orgId = await getTenantOrganizationId(companyId);

    const [memberRow] = await adminDb
        .select({ id: member.id, entityId: member.entityId })
        .from(member)
        .where(and(
            eq(member.userId, userIdStr),
            eq(member.organizationId, orgId),
        ))
        .limit(1);

    if (!memberRow) throw new DomainError('El usuario no es miembro de esta organización', 404);

    const oldEntityId = memberRow.entityId;

    const [updated] = await adminDb
        .update(member)
        .set({ entityId })
        .where(eq(member.id, memberRow.id))
        .returning({ id: member.id, entityId: member.entityId, userId: member.userId });

    if (!updated) throw new DomainError('No se pudo actualizar la entidad', 500);

    if (currentUserId) logAudit(currentUserId, 'UPDATE', 'member', memberRow.id, { entity_id: entityId }, { entity_id: oldEntityId ?? null });
    broadcastToTenant(companyId, RealtimeEvents.USER.UPDATED, { userId: userIdStr }, RealtimeEvents.ROOMS.USERS);

    return { id: userIdStr, entityId };
}

/**
 * Batch deactivate multiple users (revokes tenant sessions + invalidates facets)
 */
export async function batchDeleteUsers(userIds: (string)[], currentUserId: string, companyId: number) {
    const currentUserIdStr = String(currentUserId);
    const idsStr = [...new Set(userIds.map(id => String(id)))];
    await requireTenantMembership(currentUserIdStr, companyId);
    const organizationId = await getTenantOrganizationId(companyId);
    if (idsStr.includes(currentUserIdStr)) {
        throw new DomainError('No puedes desactivar tu propia cuenta', 403);
    }

    const safeIds: string[] = [];
    const errors: { userId: string; success: false; error: string }[] = [];

    for (const userId of idsStr) {
        try {
            await requireTenantMembership(userId, companyId, { active: false });
            await assertNotSuperadmin(userId, companyId, 'desactivar');
            await assertCanManageTargetUser(currentUserIdStr, userId, companyId, 'desactivar');
            safeIds.push(userId);
        } catch (error: any) {
            errors.push({ userId, success: false, error: error.message });
        }
    }

    if (safeIds.length > 0) {
        await adminDb.update(member)
            .set({ status: 'SUSPENDED', suspendedAt: new Date(), suspendedBy: currentUserIdStr })
            .where(and(
                eq(member.organizationId, organizationId),
                inArray(member.userId, safeIds),
            ));

        await Promise.all([
            ...safeIds.map(id => Promise.all([
                revokeTenantUserSessions(id, companyId),
                invalidateUserRbacCache(id, companyId),
                cacheService.invalidate(`tenant:member:${companyId}:${id}`),
            ])),
            invalidateUserFacetsCache(companyId),
        ]);
        broadcastToTenant(companyId, RealtimeEvents.USER.UPDATED, { userIds: safeIds }, RealtimeEvents.ROOMS.USERS);

        for (const id of safeIds) logAudit(currentUserId, 'UPDATE', 'member', id, { status: 'SUSPENDED', companyId }, { status: 'ACTIVE' });
    }

    return [
        ...safeIds.map(userId => ({ userId, success: true as const })),
        ...errors,
    ];
}

/**
 * Batch restore multiple users with atomic seat quota enforcement
 */
export async function batchRestoreUsers(userIds: (string)[], currentUserId: string, companyId: number) {
    const currentUserIdStr = String(currentUserId);
    const idsStr = [...new Set(userIds.map(id => String(id)))];
    await requireTenantMembership(currentUserIdStr, companyId);
    const organizationId = await getTenantOrganizationId(companyId);
    const safeIds = idsStr.filter(id => id !== currentUserIdStr);
    const errors: { userId: string; success: false; error: string }[] = [];

    if (idsStr.includes(currentUserIdStr)) {
        errors.push({ userId: currentUserId, success: false, error: 'No puedes restaurar tu propia cuenta' });
    }

    const restoredIds: string[] = [];

    if (safeIds.length > 0) {
        await adminDb.transaction(async (tx) => {
            await tx.execute(sql`SELECT pg_advisory_xact_lock(${companyId})`);

            const [ent, seatUsage] = await Promise.all([
                getTenantEntitlements(companyId),
                getCompanySeatUsage(companyId, organizationId, tx),
            ]);
            let regularActiveCount = seatUsage.regularActiveUsers;
            let freeAccountantSeatUsed = seatUsage.accountantAssigned;

            for (const id of safeIds) {
                try {
                    const membership = await requireTenantMembership(id, companyId, { active: false });
                    if (membership.status === 'ACTIVE') {
                        continue;
                    }
                    if (membership.status === 'PENDING') {
                        throw new DomainError('El usuario tiene una invitación pendiente de aceptación', 409);
                    }
                    await assertNotSuperadmin(id, companyId, 'restaurar');
                    await assertCanManageTargetUser(currentUserIdStr, id, companyId, 'restaurar');

                    const roleRows = await tx
                        .select({ roleId: authUserRoles.role_id })
                        .from(authUserRoles)
                        .where(and(
                            eq(authUserRoles.user_id, id),
                            eq(authUserRoles.company_id, companyId),
                        ));
                    const usesFreeAccountant = Boolean(
                        ent.hasFreeAccountantSeat
                        && !freeAccountantSeatUsed
                        && isExclusiveAccountantRole(roleRows.map(r => r.roleId), seatUsage.accountantRoleId)
                    );

                    const check = await canCreateUser(companyId, regularActiveCount, usesFreeAccountant);
                    if (!check.allowed) {
                        throw new DomainError(
                            check.reason || 'Límite de usuarios alcanzado para tu plan actual.',
                            403,
                            { code: 'PLAN_LIMIT_EXCEEDED' }
                        );
                    }

                    await tx.update(member)
                        .set({ status: 'ACTIVE', suspendedAt: null, suspendedBy: null })
                        .where(and(
                            eq(member.organizationId, organizationId),
                            eq(member.userId, id),
                        ));

                    if (usesFreeAccountant) {
                        freeAccountantSeatUsed = true;
                    } else {
                        regularActiveCount += 1;
                    }
                    restoredIds.push(id);
                } catch (error: any) {
                    errors.push({ userId: id, success: false, error: error.message });
                }
            }
        });

        if (restoredIds.length > 0) {
            await Promise.all([
                ...restoredIds.map(id => Promise.all([
                    invalidateUserRbacCache(id, companyId),
                    cacheService.invalidate(`tenant:member:${companyId}:${id}`),
                ])),
                invalidateUserFacetsCache(companyId),
            ]);
            broadcastToTenant(companyId, RealtimeEvents.USER.UPDATED, { userIds: restoredIds }, RealtimeEvents.ROOMS.USERS);

            for (const id of restoredIds) logAudit(currentUserId, 'UPDATE', 'member', id, { status: 'ACTIVE', companyId }, { status: 'SUSPENDED' });
        }
    }

    return [
        ...restoredIds.map(userId => ({ userId, success: true as const })),
        ...errors,
    ];
}
