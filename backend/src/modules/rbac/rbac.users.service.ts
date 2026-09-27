import { db, adminDb } from '../../core/db';
import { v7 as uuidv7 } from 'uuid';
import { authUsers, authUserRoles, authRoles, entities, auditLogs, sessions, member, companies, verification } from '@app/schema/tables';
import { eq, ne,sql, count, and, inArray, ilike, like, gt, or, asc, desc, type SQL } from '@app/schema';
import { cacheService } from '../../core/cache';
import { DomainError } from '../../core/errors';
import { broadcastToTenant, broadcastToUser } from '../../core/sse/events';
import { RealtimeEvents, getTenantRoom } from '@app/schema/realtime-events';
import { SYSTEM_ROLES } from '@app/schema/enums';
import { emailService } from '../../core/email';
import { auth, resolveTenantUrl } from '../../config/better-auth';
import {
    invalidateUserRbacCache,
    revokeAllUserSessions,
    isUserSuperadmin,
    assertNotSuperadmin,
    getUserRoles,
} from './rbac.permission.service';
import { logAudit } from './rbac.roles.service';
import { canCreateUser } from '../saas/entitlements.service';
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

async function assertRolesBelongToTenant(roleIds: number[], companyId: number): Promise<void> {
    const uniqueRoleIds = [...new Set(roleIds)];
    if (uniqueRoleIds.length === 0) return;

    const roles = await adminDb
        .select({ id: authRoles.id })
        .from(authRoles)
        .where(and(
            eq(authRoles.company_id, companyId),
            inArray(authRoles.id, uniqueRoleIds),
        ));

    if (roles.length !== uniqueRoleIds.length) {
        throw new DomainError('Uno o más roles no pertenecen a la empresa actual', 403);
    }
}

/**
 * Light check to see if an email is already registered in Zelys or a member of the current company
 */
export async function checkUserEmail(email: string, companyId: number) {
    await getTenantOrganizationId(companyId);
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await adminDb.query.authUsers.findFirst({
        where: eq(authUsers.email, normalizedEmail),
        columns: { id: true, username: true, displayUsername: true, name: true },
    });

    if (!existingUser) {
        return { exists: false, isAlreadyMember: false };
    }

    let isAlreadyMember = false;
    if (companyId) {
        const [companyOrg] = await adminDb
            .select({ organization_id: companies.organization_id })
            .from(companies)
            .where(eq(companies.id, companyId))
            .limit(1);

        if (companyOrg?.organization_id) {
            const memberRow = await adminDb
                .select({ id: member.id })
                .from(member)
                .where(and(
                    eq(member.userId, existingUser.id),
                    eq(member.organizationId, companyOrg.organization_id)
                ))
                .limit(1);
            isAlreadyMember = memberRow.length > 0;
        }
    }

    return {
        exists: true,
        username: existingUser.username,
        displayUsername: existingUser.displayUsername || undefined,
        name: existingUser.name || undefined,
        isAlreadyMember,
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

    const [totalResult, users] = await Promise.all([
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
        .leftJoin(entities, eq(entities.id, member.entityId))
        .where(where)
        .orderBy(orderFn(sortCol))
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const pageCount = Math.ceil(total / limit);

    const userIds = users.map(u => u.id);
    let roleMap = new Map<string, { id: number; name: string }[]>();

    if (userIds.length > 0) {
        const roleConditions = [inArray(authUserRoles.user_id, userIds)];
        if (companyId) {
            roleConditions.push(eq(authUserRoles.company_id, companyId));
        }

        const userRoles = await db
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
            .where(and(...roleConditions));

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

        const rolesRows = await db
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
            .orderBy(desc(sql`count(DISTINCT ${authUsers.id})`));

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
                entityId: member.entityId,
                entityBusinessName: entities.business_name,
                entityTaxId: entities.tax_id,
                entityIsClient: entities.is_client,
                entityIsSupplier: entities.is_supplier,
                entityIsEmployee: entities.is_employee,
            })
            .from(member)
            .innerJoin(companies, eq(companies.organization_id, member.organizationId))
            .leftJoin(entities, eq(entities.id, member.entityId))
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

    const roles = await db
        .select({ id: authRoles.id, name: authRoles.name, description: authRoles.description })
        .from(authUserRoles)
        .innerJoin(authRoles, and(
            eq(authUserRoles.role_id, authRoles.id),
            eq(authUserRoles.company_id, authRoles.company_id),
        ))
        .where(and(...roleConditions));

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

    const roles = await db
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
        .where(and(...conditions));

    return roles;
}

/**
 * Assign roles to a user
 */
export async function assignUserRoles(userId: string | number, roleIds: number[], currentUserId: string | number, companyId: number) {
    const userIdStr = String(userId);
    const user = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, userIdStr),
    });

    if (!user) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    await requireTenantMembership(userIdStr, companyId);
    await assertRolesBelongToTenant(roleIds, companyId);

    const oldRoles = await db
        .select({ id: authUserRoles.role_id })
        .from(authUserRoles)
        .where(and(eq(authUserRoles.user_id, userIdStr), eq(authUserRoles.company_id, companyId)));
    const oldRoleIds = oldRoles.map(r => r.id);

    // Superadmin protection: exactly 1 superadmin per company (the owner)
    const isTargetSuperadmin = await isUserSuperadmin(userIdStr, companyId);
    const superadminRole = await db.query.authRoles.findFirst({
        where: and(eq(authRoles.company_id, companyId), eq(authRoles.name, SYSTEM_ROLES.SUPERADMIN)),
    });

    let finalRoleIds = [...roleIds];
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

    if (finalRoleIds.length > 0) {
        await requireTenantMembership(currentUserId, companyId);
        const currentRoles = await getUserRoles(currentUserId, companyId);
        if (!currentRoles.includes(SYSTEM_ROLES.SUPERADMIN)) {
            const systemRoles = await db.select({ id: authRoles.id })
                .from(authRoles)
                .where(and(
                    inArray(authRoles.id, finalRoleIds),
                    eq(authRoles.company_id, companyId),
                    eq(authRoles.is_system, true)
                ));
            if (systemRoles.length > 0) {
                throw new DomainError('Solo superadmin puede asignar roles de sistema', 403);
            }
        }
    }

    await db.transaction(async (tx) => {
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
    });

    await invalidateUserRbacCache(userIdStr, companyId);
    broadcastToUser(userIdStr, RealtimeEvents.USER.RBAC_CHANGED, { userId: userIdStr });
    broadcastToTenant(companyId, RealtimeEvents.USER.UPDATED, { id: userIdStr }, RealtimeEvents.ROOMS.USERS);

    logAudit(currentUserId, 'UPDATE', 'auth_user_roles', userIdStr, { roleIds: finalRoleIds }, { roleIds: oldRoleIds });

    return { success: true };
}

/**
 * Validates tenant seat quota before user creation or activation.
 * The external accountant role occupies a dedicated free seat and does not consume regular user quotas.
 */
export async function checkCompanySeatQuota(companyId: number, roleIds?: number[]): Promise<void> {
    const [companyOrg] = await adminDb
        .select({ organization_id: companies.organization_id })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

    // 1. Check if user is being assigned accountant role
    let isAccountant = false;
    if (roleIds && roleIds.length > 0 && companyOrg?.organization_id) {
        const accountantRole = await db.query.authRoles.findFirst({
            where: and(eq(authRoles.company_id, companyId), eq(authRoles.name, SYSTEM_ROLES.CONTADOR)),
        });
        if (accountantRole && roleIds.includes(accountantRole.id)) {
            isAccountant = true;
            // Check if another active accountant already exists in this tenant
            const [existingAccountant] = await adminDb
                .select({ count: sql<number>`count(*)::int` })
                .from(authUserRoles)
                .innerJoin(authUsers, eq(authUsers.id, authUserRoles.user_id))
                .innerJoin(member, and(
                    eq(member.userId, authUserRoles.user_id),
                    eq(member.organizationId, companyOrg.organization_id),
                ))
                .where(and(
                    eq(authUserRoles.company_id, companyId),
                    eq(authUserRoles.role_id, accountantRole.id),
                    eq(authUsers.is_active, true),
                    eq(member.status, 'ACTIVE'),
                ));
            if ((existingAccountant?.count ?? 0) > 0) {
                // Already used the free accountant seat -> falls back to standard user seat
                isAccountant = false;
            }
        }
    }

    // 2. Count active users in company
    let currentActiveUsers = 1;
    if (companyOrg?.organization_id) {
        const [countRow] = await adminDb
            .select({ count: sql<number>`count(distinct ${member.userId})::int` })
            .from(member)
            .innerJoin(authUsers, eq(authUsers.id, member.userId))
            .where(and(
                eq(member.organizationId, companyOrg.organization_id),
                eq(authUsers.is_active, true),
                eq(member.status, 'ACTIVE')
            ));
        currentActiveUsers = countRow?.count ?? 1;
    }

    // 3. Check entitlements
    const check = await canCreateUser(companyId, currentActiveUsers, isAccountant);
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
    await assertRolesBelongToTenant(data.roleIds ?? [], companyId);
    const normalizedEmail = data.email.trim().toLowerCase();
    const baseUsername = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    const normalizedUsername = (data.username?.trim() || baseUsername).toLowerCase();
    const displayName = data.username?.trim() || data.email.split('@')[0];
    if (data.mode !== undefined && data.mode !== 'invite') {
        throw new DomainError('La creación de usuarios se realiza únicamente mediante invitación segura', 400);
    }

    // 1. Validar que el username sea único globalmente (only if no existing user with this email)
    const existingGlobalUser = await adminDb.query.authUsers.findFirst({
        where: eq(authUsers.email, normalizedEmail),
        columns: { id: true, username: true, email: true },
    });

    if (!existingGlobalUser) {
        const existingUsername = await adminDb.query.authUsers.findFirst({
            where: eq(authUsers.username, normalizedUsername),
        });

        if (existingUsername) {
            throw new DomainError('Ya existe un usuario con ese nombre de usuario', 409);
        }
    }

    // 2. Validar que el email no tenga ya membresía en esta empresa (via org member table)
    if (companyId) {
        const [companyOrg] = await adminDb
            .select({ organization_id: companies.organization_id })
            .from(companies)
            .where(eq(companies.id, companyId))
            .limit(1);

        if (companyOrg?.organization_id) {
            const existingMember = await adminDb
                .select({ id: member.id })
                .from(member)
                .innerJoin(authUsers, eq(authUsers.id, member.userId))
                .where(and(
                    eq(authUsers.email, normalizedEmail),
                    eq(member.organizationId, companyOrg.organization_id)
                ))
                .limit(1);

            if (existingMember.length > 0) {
                throw new DomainError('Ya existe un usuario con ese email en esta empresa', 409);
            }
        }
    }

    // 3. Superadmin protection: prevent creating a second superadmin
    if (data.roleIds && data.roleIds.length > 0 && companyId) {
        const superadminRole = await db.query.authRoles.findFirst({
            where: and(eq(authRoles.company_id, companyId), eq(authRoles.name, SYSTEM_ROLES.SUPERADMIN)),
        });
        if (superadminRole && data.roleIds.includes(superadminRole.id)) {
            throw new DomainError('El rol superadmin es exclusivo del propietario de la empresa y no puede ser asignado', 403);
        }
    }

    // 4. Quota enforcement: check if tenant has available seats in their SaaS plan
    if (companyId) {
        await checkCompanySeatQuota(companyId, data.roleIds);
    }

    const newUser = await db.transaction(async (tx) => {
        // ──────────────────────────────────────────────────────────────────
        // CHECK: Does a user with this email already exist globally?
        // If so, reuse that user record — add org membership + roles.
        // ──────────────────────────────────────────────────────────────────
        if (existingGlobalUser) {
            const memberId = uuidv7();

            // Add org membership for the existing user in THIS tenant
            if (companyId) {
                const [company] = await tx
                    .select({ organization_id: companies.organization_id })
                    .from(companies)
                    .where(eq(companies.id, companyId))
                    .limit(1);

                if (company?.organization_id) {
                    await tx.insert(member).values({
                        id: memberId,
                        organizationId: company.organization_id,
                        userId: existingGlobalUser.id,
                        role: 'member',
                        entityId: data.entityId || null,
                    }).onConflictDoNothing();
                }
            }

            // Assign roles to the existing user for this company
            if (data.roleIds && data.roleIds.length > 0) {
                await tx.insert(authUserRoles).values(
                    data.roleIds.map(roleId => ({
                        user_id: existingGlobalUser.id,
                        role_id: roleId,
                        company_id: companyId,
                    }))
                );
            }

            return { id: existingGlobalUser.id, username: existingGlobalUser.username, email: existingGlobalUser.email };
        }

        // ──────────────────────────────────────────────────────────────────
        // No existing user — create the identity without credentials. The
        // invitation acceptance flow creates the credential after token proof.
        // ──────────────────────────────────────────────────────────────────
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

        // Better-Auth organization membership sync
        if (companyId) {
            const [company] = await tx
                .select({ organization_id: companies.organization_id })
                .from(companies)
                .where(eq(companies.id, companyId))
                .limit(1);

            if (company?.organization_id) {
                await tx.insert(member).values({
                    id: memberId,
                    organizationId: company.organization_id,
                    userId: user.id,
                    role: 'member',
                    entityId: data.entityId || null,
                }).onConflictDoNothing();
            }
        }

        if (data.roleIds && data.roleIds.length > 0) {
            await tx.insert(authUserRoles).values(
                data.roleIds.map(roleId => ({
                    user_id: user.id,
                    role_id: roleId,
                    company_id: companyId,
                }))
            );
        }

        return user;
    });

    if (companyId) {
        await cacheService.invalidate(`tenant:member:${companyId}:${newUser.id}`);
        broadcastToTenant(companyId, RealtimeEvents.USER.CREATED, { id: newUser.id }, RealtimeEvents.ROOMS.USERS);
    }

    if (currentUserId) logAudit(currentUserId, 'INSERT', 'user', newUser.id, { username: displayName, email: normalizedEmail, roleIds: data.roleIds, entityId: data.entityId });

    // ──────────────────────────────────────────────────────────────────────────
    // Send Context-Aware Email Notification (Asynchronous - Non Blocking)
    // ──────────────────────────────────────────────────────────────────────────
    if (companyId && data.sendEmail !== false) {
        (async () => {
            try {
                const [comp] = await adminDb
                    .select({
                        business_name: companies.business_name,
                        trade_name: companies.trade_name,
                        slug: companies.slug,
                        organizationId: companies.organization_id,
                    })
                    .from(companies)
                    .where(eq(companies.id, companyId))
                    .limit(1);

                if (comp) {
                    const companyName = comp.trade_name || comp.business_name;
                    const loginUrl = `${resolveTenantUrl(comp.slug)}/login?email=${encodeURIComponent(normalizedEmail)}`;

                    let roleNames: string[] = [];
                    if (data.roleIds && data.roleIds.length > 0) {
                        const assignedRoles = await adminDb
                            .select({ name: authRoles.name })
                            .from(authRoles)
                            .where(and(
                                inArray(authRoles.id, data.roleIds),
                                eq(authRoles.company_id, companyId),
                            ));
                        roleNames = assignedRoles.map(r => r.name);
                    }

                    let inviterName: string | undefined;
                    if (currentUserId) {
                        const inviter = await adminDb.query.authUsers.findFirst({
                            where: eq(authUsers.id, String(currentUserId)),
                            columns: { name: true, displayUsername: true, username: true },
                        });
                        inviterName = inviter?.name || inviter?.displayUsername || inviter?.username;
                    }

                    if (existingGlobalUser) {
                        // Invitación a Usuario Existente en Zelys
                        await emailService.sendOrganizationMemberAddedEmail(normalizedEmail, {
                            companyName,
                            loginUrl,
                            roleNames,
                            userName: displayName,
                            inviterName,
                        });
                    } else {
                        // Invitación a Usuario Nuevo (generar token seguro de 72h)
                        const activationToken = uuidv7().replace(/-/g, '') + uuidv7().replace(/-/g, '');
                        const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

                        await adminDb.insert(verification).values({
                            id: uuidv7(),
                            identifier: `invitation:${normalizedEmail}:${comp.organizationId}`,
                            value: activationToken,
                            expiresAt,
                        });

                        const inviteUrl = `${resolveTenantUrl(comp.slug)}/accept-invitation?token=${activationToken}&email=${encodeURIComponent(normalizedEmail)}`;

                        await emailService.sendOrganizationInvitationEmail(normalizedEmail, {
                            companyName,
                            inviteUrl,
                            roleNames,
                            userName: displayName,
                            inviterName,
                        });
                    }
                }
            } catch (err) {
                console.error('[RBAC] Error sending organization user onboarding email:', err);
            }
        })();
    }

    return newUser;
}

/**
 * Accept user invitation: verifies secure activation token and sets initial password
 */
export async function acceptUserInvitation(data: { token: string; email: string; password: string }) {
    const normalizedEmail = data.email.trim().toLowerCase();
    const invitationPrefix = `invitation:${normalizedEmail}:`;
    const newPasswordHash = await hashPassword(data.password.trim());

    const organizationId = await adminDb.transaction(async (tx) => {
        // Delete-and-return is the atomic one-use claim. If any subsequent
        // validation fails, the transaction rolls back and the invitation
        // remains available for a legitimate retry.
        const [tokenRecord] = await tx
            .delete(verification)
            .where(and(
                like(verification.identifier, `${invitationPrefix}%`),
                eq(verification.value, data.token),
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

        const targetUser = await tx.query.authUsers.findFirst({
            where: eq(authUsers.email, normalizedEmail),
            columns: { id: true },
        });
        if (!targetUser) throw new DomainError('Usuario no encontrado', 404);

        const [invitedMembership] = await tx
            .select({ id: member.id })
            .from(member)
            .where(and(
                eq(member.userId, targetUser.id),
                eq(member.organizationId, invitedOrganizationId),
            ))
            .limit(1);
        if (!invitedMembership) {
            throw new DomainError('La invitación no pertenece a este usuario', 403);
        }

        await replaceCredentialPassword(tx, targetUser.id, newPasswordHash);

        // Mark email as verified and user active
        await tx.update(authUsers)
            .set({ emailVerified: true, is_active: true, updatedAt: new Date() })
            .where(eq(authUsers.id, targetUser.id));

        return invitedOrganizationId;
    });

    return { success: true, email: normalizedEmail, organizationId };
}

/**
 * Get all users with a specific role scoped to a company
 */
export async function getUsersByRole(roleId: number, companyId: number) {
    const conditions = [eq(authUserRoles.role_id, roleId), eq(authUserRoles.company_id, companyId)];
    await getTenantOrganizationId(companyId);

    const usersInRole = await db
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
        .where(and(...conditions));

    return usersInRole.map(u => ({ ...u, username: u.username || u.name, image: u.image ?? null }));
}

/**
 * Remove a user from a specific role scoped to a company
 */
export async function removeUserFromRole(userId: string | number, roleId: number, companyId: number) {
    const userIdStr = String(userId);
    await requireTenantMembership(userIdStr, companyId, { active: false });
    
    // Superadmin protection: owner cannot be removed from superadmin
    const roleWhere = and(eq(authRoles.id, roleId), eq(authRoles.company_id, companyId));
    const role = await db.query.authRoles.findFirst({ where: roleWhere });
    if (role?.name === SYSTEM_ROLES.SUPERADMIN) {
        throw new DomainError('No se puede remover el rol superadmin del propietario de la empresa', 403);
    }

    const deleteConditions = [
        eq(authUserRoles.user_id, userIdStr),
        eq(authUserRoles.role_id, roleId),
    ];
    deleteConditions.push(eq(authUserRoles.company_id, companyId));

    await db
        .delete(authUserRoles)
        .where(and(...deleteConditions))
        .returning();

    await invalidateUserRbacCache(userIdStr, companyId);
    broadcastToUser(userIdStr, RealtimeEvents.USER.RBAC_CHANGED, { userId: userIdStr });
    broadcastToTenant(companyId, RealtimeEvents.USER.UPDATED, { id: userIdStr }, RealtimeEvents.ROOMS.USERS);

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

    const user = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, userIdStr),
        columns: { id: true, username: true, email: true, is_active: true },
    });

    if (!user) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    const membership = await requireTenantMembership(userIdStr, companyId, { active: false });

    // Resolve company organization ID
    const companyOrgId = await getTenantOrganizationId(companyId);

    await db.transaction(async (tx) => {
        // 1. Update entity link in member table (scoped to this tenant)
        if (data.entityId !== undefined && companyOrgId) {
            await tx.update(member)
                .set({ entityId: data.entityId || null })
                .where(and(
                    eq(member.userId, userIdStr),
                    eq(member.organizationId, companyOrgId)
                ));
        }

        // 2. Update roles in auth_user_roles (scoped to this company)
        if (data.roleIds !== undefined) {
            await assignUserRoles(userIdStr, data.roleIds, currentUserId, companyId);
        }

        // 3. Update status
        if (data.isActive !== undefined) {
            if (data.isActive === false) {
                if (currentUserId && userIdStr === String(currentUserId)) {
                    throw new DomainError('No puedes desactivar tu propia cuenta', 403);
                }
                await assertNotSuperadmin(userIdStr, companyId, 'desactivar');
            } else if (data.isActive === true && membership.status !== 'ACTIVE') {
                const userRolesRows = await db
                    .select({ roleId: authUserRoles.role_id })
                    .from(authUserRoles)
                    .where(and(
                        eq(authUserRoles.user_id, userIdStr),
                        eq(authUserRoles.company_id, companyId)
                    ));
                const roleIds = data.roleIds ?? userRolesRows.map(r => r.roleId);
                await checkCompanySeatQuota(companyId, roleIds);
            }
            await tx.update(member)
                .set({
                    status: data.isActive ? 'ACTIVE' : 'SUSPENDED',
                    suspendedAt: data.isActive ? null : new Date(),
                    suspendedBy: data.isActive ? null : String(currentUserId),
                })
                .where(and(
                    eq(member.userId, userIdStr),
                    eq(member.organizationId, companyOrgId),
                ));
        }
    });

    await invalidateUserRbacCache(userIdStr, companyId);
    await cacheService.invalidate(`tenant:member:${companyId}:${userIdStr}`);
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

    const targetUser = await db.query.authUsers.findFirst({ where: eq(authUsers.id, userIdStr) });
    if (!targetUser) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    const membership = await requireTenantMembership(userIdStr, companyId, { active: false });
    await assertNotSuperadmin(userIdStr, companyId, 'desactivar');

    const [updated] = await adminDb
        .update(member)
        .set({ status: 'SUSPENDED', suspendedAt: new Date(), suspendedBy: currentUserIdStr })
        .where(and(
            eq(member.userId, userIdStr),
            eq(member.organizationId, membership.organizationId),
        ))
        .returning();

    if (!updated) throw new DomainError('Membresía no encontrada', 404);
    await invalidateUserRbacCache(userIdStr, companyId);
    await cacheService.invalidate(`tenant:member:${companyId}:${userIdStr}`);
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

    const targetUser = await db.query.authUsers.findFirst({ where: eq(authUsers.id, userIdStr) });
    if (!targetUser) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    const membership = await requireTenantMembership(userIdStr, companyId, { active: false });

    {
        const userRolesRows = await db
            .select({ roleId: authUserRoles.role_id })
            .from(authUserRoles)
            .where(and(
                eq(authUserRoles.user_id, userIdStr),
                eq(authUserRoles.company_id, companyId)
            ));
        const roleIds = userRolesRows.map(r => r.roleId);
        await checkCompanySeatQuota(companyId, roleIds);
    }

    const [updated] = await adminDb
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

    await invalidateUserRbacCache(userIdStr, companyId);
    await cacheService.invalidate(`tenant:member:${companyId}:${userIdStr}`);
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

    const targetUser = await db.query.authUsers.findFirst({ where: eq(authUsers.id, userIdStr) });
    if (!targetUser) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    await requireTenantMembership(userIdStr, companyId, { active: false });
    await assertNotSuperadmin(userIdStr, companyId, 'remover');

    // Resolve company organization ID
    const companyOrgId = await getTenantOrganizationId(companyId);

    await db.transaction(async (tx) => {
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

        // If user has NO other organizations anywhere, purge global record
        if (otherMemberships.length === 0) {
            await revokeAllUserSessions(userIdStr);
            await tx.delete(authUsers).where(eq(authUsers.id, userIdStr));
        }
    });

    await invalidateUserRbacCache(userIdStr, companyId);
    await cacheService.invalidate(`tenant:member:${companyId}:${userIdStr}`);
    broadcastToTenant(companyId, RealtimeEvents.USER.DELETED, { userId: userIdStr }, RealtimeEvents.ROOMS.USERS);

    logAudit(currentUserId, 'DELETE', 'user', userIdStr, undefined, { username: targetUser.username, email: targetUser.email });

    return { success: true };
}

/**
 * Pre-flight check for hard delete
 */
export async function checkUserReferences(userId: string | number, companyId: number) {
    const userIdStr = String(userId);
    const user = await db.query.authUsers.findFirst({ where: eq(authUsers.id, userIdStr) });
    if (!user) throw new DomainError('Usuario no encontrado', 404);
    await requireTenantMembership(userIdStr, companyId, { active: false });

    const isSuper = await isUserSuperadmin(userIdStr, companyId);

    const [rolesResult, sessionsResult] = await Promise.all([
        db.select({ count: count() }).from(authUserRoles).where(and(
            eq(authUserRoles.user_id, userIdStr),
            eq(authUserRoles.company_id, companyId),
        )),
        db.select({ count: count() })
            .from(sessions)
            .where(and(
                eq(sessions.userId, userIdStr),
                eq(sessions.activeOrganizationId, await getTenantOrganizationId(companyId)),
            )),
    ]);

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
 * Request a Better Auth password reset for a tenant member.
 * Administrators never receive or write a user's password directly.
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

    // Validate entity exists (within tenant scope via RLS)
    if (entityId !== null) {
        const entity = await db.query.entities.findFirst({
            where: eq(entities.id, entityId),
        });
        if (!entity) throw new DomainError('Entidad no encontrada', 404);
    }

    // Resolve the organization_id for this company
    const [companyRow] = await adminDb
        .select({ orgId: companies.organization_id })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

    if (!companyRow?.orgId) throw new DomainError('Empresa no encontrada', 404);

    // Find the member record for this user + organization
    const [memberRow] = await adminDb
        .select({ id: member.id, entityId: member.entityId })
        .from(member)
        .where(and(
            eq(member.userId, userIdStr),
            eq(member.organizationId, companyRow.orgId),
        ))
        .limit(1);

    if (!memberRow) throw new DomainError('El usuario no es miembro de esta organización', 404);

    const oldEntityId = memberRow.entityId;

    // Update member.entityId
    const [updated] = await adminDb
        .update(member)
        .set({ entityId })
        .where(eq(member.id, memberRow.id))
        .returning({ id: member.id, entityId: member.entityId, userId: member.userId });

    if (!updated) throw new DomainError('No se pudo actualizar la entidad', 500);

    if (currentUserId) logAudit(currentUserId, 'UPDATE', 'member', memberRow.id, { entity_id: entityId }, { entity_id: oldEntityId ?? null });
    if (companyId) {
        broadcastToTenant(companyId, RealtimeEvents.USER.UPDATED, { userId: userIdStr }, RealtimeEvents.ROOMS.USERS);
    }

    return { id: userIdStr, entityId };
}

/**
 * Batch deactivate multiple users
 */
export async function batchDeleteUsers(userIds: (string)[], currentUserId: string, companyId: number) {
    const currentUserIdStr = String(currentUserId);
    const idsStr = userIds.map(id => String(id));
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

        await Promise.all(safeIds.map(id => Promise.all([
            invalidateUserRbacCache(id, companyId),
            cacheService.invalidate(`tenant:member:${companyId}:${id}`),
        ])));
        broadcastToTenant(companyId, RealtimeEvents.USER.UPDATED, { userIds: safeIds }, RealtimeEvents.ROOMS.USERS);

        for (const id of safeIds) logAudit(currentUserId, 'UPDATE', 'member', id, { status: 'SUSPENDED', companyId }, { status: 'ACTIVE' });
    }

    return [
        ...safeIds.map(userId => ({ userId, success: true as const })),
        ...errors,
    ];
}

/**
 * Batch restore multiple users
 */
export async function batchRestoreUsers(userIds: (string)[], currentUserId: string, companyId: number) {
    const currentUserIdStr = String(currentUserId);
    const idsStr = userIds.map(id => String(id));
    const organizationId = await getTenantOrganizationId(companyId);
    const safeIds = idsStr.filter(id => id !== currentUserIdStr);
    const errors: { userId: string; success: false; error: string }[] = [];

    if (idsStr.includes(currentUserIdStr)) {
        errors.push({ userId: currentUserId, success: false, error: 'No puedes restaurar tu propia cuenta' });
    }

    if (safeIds.length > 0) {
        const restoreIds: string[] = [];
        for (const id of safeIds) {
            try {
                await requireTenantMembership(id, companyId, { active: false });
                await assertNotSuperadmin(id, companyId, 'restaurar');
                await checkCompanySeatQuota(companyId);
                restoreIds.push(id);
            } catch (error: any) {
                errors.push({ userId: id, success: false, error: error.message });
            }
        }

        if (restoreIds.length > 0) {
            await adminDb.update(member)
                .set({ status: 'ACTIVE', suspendedAt: null, suspendedBy: null })
                .where(and(
                    eq(member.organizationId, organizationId),
                    inArray(member.userId, restoreIds),
                ));

            await Promise.all(restoreIds.map(id => Promise.all([
                invalidateUserRbacCache(id, companyId),
                cacheService.invalidate(`tenant:member:${companyId}:${id}`),
            ])));
            broadcastToTenant(companyId, RealtimeEvents.USER.UPDATED, { userIds: restoreIds }, RealtimeEvents.ROOMS.USERS);

            for (const id of restoreIds) logAudit(currentUserId, 'UPDATE', 'member', id, { status: 'ACTIVE', companyId }, { status: 'SUSPENDED' });
        }
    }

    return [
        ...safeIds.filter(id => !errors.some(error => error.userId === id)).map(userId => ({ userId, success: true as const })),
        ...errors,
    ];
}
