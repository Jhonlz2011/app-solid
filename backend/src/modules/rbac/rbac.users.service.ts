import { db, adminDb } from '../../core/db';
import { v7 as uuidv7 } from 'uuid';
import { authUsers, authUserRoles, authRoles, entities, auditLogs, sessions, account, member, companies } from '@app/schema/tables';
import { eq, ne,sql, count, and, inArray, ilike, or, asc, desc, type SQL } from '@app/schema';
import { cacheService } from '../../core/cache';
import { DomainError } from '../../core/errors';
import { broadcast } from '../../core/sse/events';
import { RealtimeEvents, getTenantRoom } from '@app/schema/realtime-events';
import { SYSTEM_ROLES } from '@app/schema/enums';
import { emailService } from '../../core/email';
import { resolveTenantUrl } from '../../config/better-auth';
import {
    invalidateUserRbacCache,
    revokeAllUserSessions,
    isUserSuperadmin,
    assertNotSuperadmin,
    getUserRoles,
} from './rbac.permission.service';
import { logAudit } from './rbac.roles.service';
import { hashPassword } from '../../core/security';

export interface UsersListFilters {
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    isActive?: string[];
    roles?: string[];
}

/**
 * Light check to see if an email is already registered in Zelys or a member of the current company
 */
export async function checkUserEmail(email: string, companyId?: number) {
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
export async function getAllUsersWithRoles(filters: UsersListFilters = {}, companyId?: number) {
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
            .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
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
            isActive: user.isActive,
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
export async function getUserFacets(filters: { search?: string; isActive?: string[]; roles?: string[] }, companyId?: number) {
    const cacheKey = `rbac:facets:users:${companyId}:${JSON.stringify(filters)}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const results: Record<string, { value: string; count: number }[]> = {};

        const activeConditions: SQL[] = [];
        if (companyId) {
            const memberSub = adminDb.select({ userId: member.userId })
                .from(member)
                .innerJoin(companies, eq(companies.organization_id, member.organizationId))
                .where(eq(companies.id, companyId));
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

        const rolesConditions: SQL[] = [];
        if (companyId) {
            const memberSub = adminDb.select({ userId: member.userId })
                .from(member)
                .innerJoin(companies, eq(companies.organization_id, member.organizationId))
                .where(eq(companies.id, companyId));
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
export async function getUserById(id: string | number, companyId?: number) {
    const idStr = String(id);

    // Verify membership if companyId is provided
    if (companyId) {
        const memberSub = adminDb.select({ userId: member.userId })
            .from(member)
            .innerJoin(companies, eq(companies.organization_id, member.organizationId))
            .where(and(eq(companies.id, companyId), eq(member.userId, idStr)));
        const [hasMembership] = await memberSub.limit(1);
        if (!hasMembership) throw new DomainError('Usuario no encontrado', 404);
    }

    const user = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, idStr),
        columns: {
            id: true,
            username: true,
            name: true,
            email: true,
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

    const roleConditions = [eq(authUserRoles.user_id, idStr)];
    if (companyId) {
        roleConditions.push(eq(authUserRoles.company_id, companyId));
    }

    const roles = await db
        .select({ id: authRoles.id, name: authRoles.name, description: authRoles.description })
        .from(authUserRoles)
        .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
        .where(and(...roleConditions));

    return {
        id: user.id,
        username: user.username || user.name,
        email: user.email,
        isActive: user.is_active,
        lastLogin: user.last_login,
        entityId,
        entity: entityData,
        roles,
    };
}

/**
 * Get roles for a specific user scoped to a company
 */
export async function getUserRolesById(userId: string | number, companyId?: number) {
    const userIdStr = String(userId);
    const conditions = [eq(authUserRoles.user_id, userIdStr)];
    if (companyId) {
        conditions.push(eq(authUserRoles.company_id, companyId));
    }

    const roles = await db
        .select({
            id: authRoles.id,
            name: authRoles.name,
            description: authRoles.description,
        })
        .from(authUserRoles)
        .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
        .where(and(...conditions));

    return roles;
}

/**
 * Assign roles to a user
 */
export async function assignUserRoles(userId: string | number, roleIds: number[], currentUserId: string | number, companyId?: number) {
    const userIdStr = String(userId);
    const user = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, userIdStr),
    });

    if (!user) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    const effectiveCompanyId = companyId || user.company_id!;

    const oldRoles = await db
        .select({ id: authUserRoles.role_id })
        .from(authUserRoles)
        .where(and(eq(authUserRoles.user_id, userIdStr), eq(authUserRoles.company_id, effectiveCompanyId)));
    const oldRoleIds = oldRoles.map(r => r.id);

    // Superadmin protection: exactly 1 superadmin per company (the owner)
    const isTargetSuperadmin = await isUserSuperadmin(userIdStr, effectiveCompanyId);
    const superadminRole = await db.query.authRoles.findFirst({
        where: and(eq(authRoles.company_id, effectiveCompanyId), eq(authRoles.name, SYSTEM_ROLES.SUPERADMIN)),
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
        const currentRoles = await getUserRoles(currentUserId, effectiveCompanyId);
        if (!currentRoles.includes(SYSTEM_ROLES.SUPERADMIN)) {
            const systemRoles = await db.select({ id: authRoles.id })
                .from(authRoles)
                .where(and(
                    inArray(authRoles.id, finalRoleIds),
                    eq(authRoles.company_id, effectiveCompanyId),
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
                eq(authUserRoles.company_id, effectiveCompanyId)
            )
        );

        if (finalRoleIds.length > 0) {
            await tx.insert(authUserRoles).values(
                finalRoleIds.map(roleId => ({
                    user_id: userIdStr,
                    role_id: roleId,
                    company_id: effectiveCompanyId,
                }))
            );
        }
    });

    await invalidateUserRbacCache(userIdStr, effectiveCompanyId);
    broadcast(RealtimeEvents.USER.RBAC_CHANGED, { userId: userIdStr }, `user:${userIdStr}`);
    const targetRoom = getTenantRoom(effectiveCompanyId, RealtimeEvents.ROOMS.USERS);
    broadcast(RealtimeEvents.USER.UPDATED, { id: userIdStr }, targetRoom);

    logAudit(currentUserId, 'UPDATE', 'auth_user_roles', userIdStr, { roleIds: finalRoleIds }, { roleIds: oldRoleIds });

    return { success: true };
}

/**
 * Create a new user (admin function with Better-Auth credential account creation & organization member sync)
 */
export async function createUser(data: { email: string; roleIds?: number[]; entityId?: string | null; username?: string; password?: string }, currentUserId?: string | number, companyId?: number) {
    const normalizedEmail = data.email.trim().toLowerCase();
    const baseUsername = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    const normalizedUsername = (data.username?.trim() || baseUsername).toLowerCase();
    const displayName = data.username?.trim() || data.email.split('@')[0];

    // 1. Validar que el username sea único globalmente (only if no existing user with this email)
    const existingGlobalUser = await adminDb.query.authUsers.findFirst({
        where: eq(authUsers.email, normalizedEmail),
        columns: { id: true },
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

    const rawPassword = data.password?.trim() || (Math.random().toString(36).slice(-10) + 'A1!');
    const password_hash = await hashPassword(rawPassword);

    const newUser = await db.transaction(async (tx) => {
        // ──────────────────────────────────────────────────────────────────
        // CHECK: Does a user with this email already exist globally?
        // If so, reuse that user record — add org membership + roles.
        // ──────────────────────────────────────────────────────────────────
        const existingUser = await tx.query.authUsers.findFirst({
            where: eq(authUsers.email, normalizedEmail),
            columns: { id: true, username: true, email: true, company_id: true },
        });

        if (existingUser) {
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
                        userId: existingUser.id,
                        role: 'member',
                        entityId: data.entityId || null,
                    }).onConflictDoNothing();
                }
            }

            // Ensure the existing user has a credential account for password login
            const existingCredential = await tx.query.account.findFirst({
                where: and(
                    eq(account.userId, existingUser.id),
                    eq(account.providerId, 'credential'),
                ),
            });
            if (!existingCredential) {
                await tx.insert(account).values({
                    id: uuidv7(),
                    accountId: existingUser.id,
                    providerId: 'credential',
                    userId: existingUser.id,
                    password: password_hash,
                });
            }

            // Assign roles to the existing user for this company
            if (data.roleIds && data.roleIds.length > 0) {
                await tx.insert(authUserRoles).values(
                    data.roleIds.map(roleId => ({
                        user_id: existingUser.id,
                        role_id: roleId,
                        company_id: companyId!,
                    }))
                );
            }

            return { id: existingUser.id, username: existingUser.username, email: existingUser.email };
        }

        // ──────────────────────────────────────────────────────────────────
        // No existing user — create brand new user + account + membership
        // ──────────────────────────────────────────────────────────────────
        const userId = uuidv7();
        const accountId = uuidv7();
        const memberId = uuidv7();

        const [user] = await tx
            .insert(authUsers)
            .values({
                id: userId,
                name: displayName,
                username: normalizedUsername,
                displayUsername: displayName,
                email: normalizedEmail,
                company_id: companyId!,
                is_active: true,
                emailVerified: true, // Pre-verified by tenant admin
            })
            .returning({ id: authUsers.id, username: authUsers.username, email: authUsers.email });

        await tx.insert(account).values({
            id: accountId,
            accountId: user.id,
            providerId: 'credential',
            userId: user.id,
            password: password_hash,
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
                    company_id: companyId!,
                }))
            );
        }

        return user;
    });

    const targetRoom = companyId ? getTenantRoom(companyId, RealtimeEvents.ROOMS.USERS) : RealtimeEvents.ROOMS.USERS;
    broadcast(RealtimeEvents.USER.CREATED, { id: newUser.id }, targetRoom);

    if (currentUserId) logAudit(currentUserId, 'INSERT', 'user', newUser.id, { username: displayName, email: normalizedEmail, roleIds: data.roleIds, entityId: data.entityId });

    // ──────────────────────────────────────────────────────────────────────────
    // Send Organization Invitation Email (Asynchronous - Non Blocking)
    // ──────────────────────────────────────────────────────────────────────────
    if (companyId) {
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
                    const loginUrl = `${resolveTenantUrl(comp.slug)}/login?email=${encodeURIComponent(normalizedEmail)}`;

                    let roleNames: string[] = [];
                    if (data.roleIds && data.roleIds.length > 0) {
                        const assignedRoles = await adminDb
                            .select({ name: authRoles.name })
                            .from(authRoles)
                            .where(inArray(authRoles.id, data.roleIds));
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

                    await emailService.sendOrganizationInvitationEmail(normalizedEmail, {
                        companyName,
                        loginUrl,
                        roleNames,
                        userName: displayName,
                        inviterName,
                        isNewUser: !existingGlobalUser,
                    });
                }
            } catch (err) {
                console.error('[RBAC] Error sending organization invitation email:', err);
            }
        })();
    }

    return newUser;
}

/**
 * Get all users with a specific role scoped to a company
 */
export async function getUsersByRole(roleId: number, companyId?: number) {
    const conditions = [eq(authUserRoles.role_id, roleId)];
    if (companyId) conditions.push(eq(authUserRoles.company_id, companyId));

    const usersInRole = await db
        .select({
            id: authUsers.id,
            username: authUsers.username,
            name: authUsers.name,
            email: authUsers.email,
            isActive: authUsers.is_active,
        })
        .from(authUserRoles)
        .innerJoin(authUsers, eq(authUserRoles.user_id, authUsers.id))
        .where(and(...conditions));

    return usersInRole.map(u => ({ ...u, username: u.username || u.name }));
}

/**
 * Remove a user from a specific role scoped to a company
 */
export async function removeUserFromRole(userId: string | number, roleId: number, companyId?: number) {
    const userIdStr = String(userId);
    
    // Superadmin protection: owner cannot be removed from superadmin
    const roleWhere = companyId
        ? and(eq(authRoles.id, roleId), eq(authRoles.company_id, companyId))
        : eq(authRoles.id, roleId);
    const role = await db.query.authRoles.findFirst({ where: roleWhere });
    if (role?.name === SYSTEM_ROLES.SUPERADMIN) {
        throw new DomainError('No se puede remover el rol superadmin del propietario de la empresa', 403);
    }

    const deleteConditions = [
        eq(authUserRoles.user_id, userIdStr),
        eq(authUserRoles.role_id, roleId),
    ];
    if (companyId) deleteConditions.push(eq(authUserRoles.company_id, companyId));

    await db
        .delete(authUserRoles)
        .where(and(...deleteConditions))
        .returning();

    const effectiveCompanyId = companyId || (await db.query.authUsers.findFirst({ where: eq(authUsers.id, userIdStr) }))?.company_id;
    await invalidateUserRbacCache(userIdStr, effectiveCompanyId);
    const targetRoom = effectiveCompanyId ? getTenantRoom(effectiveCompanyId, RealtimeEvents.ROOMS.USERS) : RealtimeEvents.ROOMS.USERS;
    broadcast(RealtimeEvents.USER.UPDATED, { id: userIdStr }, targetRoom);

    return { success: true };
}

/**
 * Update user details (scoped to company context: roles, entity link, and status)
 */
export async function updateUser(
    userId: string | number,
    data: { roleIds?: number[]; entityId?: string | null; isActive?: boolean; username?: string; email?: string },
    currentUserId?: string | number,
    companyId?: number
) {
    const userIdStr = String(userId);

    const user = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, userIdStr),
        columns: { id: true, username: true, email: true, is_active: true, company_id: true },
    });

    if (!user) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    const effectiveCompanyId = companyId || user.company_id!;

    // Resolve company organization ID
    let companyOrgId: string | null = null;
    if (effectiveCompanyId) {
        const [companyRow] = await adminDb
            .select({ orgId: companies.organization_id })
            .from(companies)
            .where(eq(companies.id, effectiveCompanyId))
            .limit(1);
        companyOrgId = companyRow?.orgId ?? null;
    }

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
        if (data.roleIds !== undefined && effectiveCompanyId) {
            await assignUserRoles(userIdStr, data.roleIds, currentUserId || userIdStr, effectiveCompanyId);
        }

        // 3. Update status
        if (data.isActive !== undefined) {
            await tx.update(authUsers)
                .set({ is_active: data.isActive })
                .where(eq(authUsers.id, userIdStr));
        }
    });

    await invalidateUserRbacCache(userIdStr, effectiveCompanyId);
    const targetRoom = effectiveCompanyId ? getTenantRoom(effectiveCompanyId, RealtimeEvents.ROOMS.USERS) : RealtimeEvents.ROOMS.USERS;
    broadcast(RealtimeEvents.USER.UPDATED, { userId: userIdStr }, targetRoom);

    if (currentUserId) {
        logAudit(currentUserId, 'UPDATE', 'user', userIdStr, data, {
            username: user.username,
            email: user.email,
            is_active: user.is_active,
        });
    }

    return {
        id: user.id,
        username: user.username,
        email: user.email,
        isActive: data.isActive !== undefined ? data.isActive : user.is_active,
        company_id: effectiveCompanyId,
    };
}

/**
 * Deactivate a user (soft-delete scoped to tenant context)
 */
export async function deactivateUser(userId: string | number, currentUserId: string | number, companyId?: number) {
    const userIdStr = String(userId);
    const currentUserIdStr = String(currentUserId);
    if (userIdStr === currentUserIdStr) {
        throw new DomainError('No puedes desactivar tu propia cuenta', 403);
    }

    const targetUser = await db.query.authUsers.findFirst({ where: eq(authUsers.id, userIdStr) });
    if (!targetUser) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    const effectiveCompanyId = companyId || targetUser.company_id!;
    await assertNotSuperadmin(userIdStr, effectiveCompanyId, 'desactivar');

    const [updated] = await db
        .update(authUsers)
        .set({ is_active: false })
        .where(eq(authUsers.id, userIdStr))
        .returning();

    await invalidateUserRbacCache(userIdStr, effectiveCompanyId);
    broadcast(RealtimeEvents.USER.SESSION_REVOKED, { userId: userIdStr }, `user:${userIdStr}`);
    const targetRoom = effectiveCompanyId ? getTenantRoom(effectiveCompanyId, RealtimeEvents.ROOMS.USERS) : RealtimeEvents.ROOMS.USERS;
    broadcast(RealtimeEvents.USER.UPDATED, { userId: userIdStr }, targetRoom);

    logAudit(currentUserId, 'UPDATE', 'user', userIdStr, { is_active: false }, { is_active: true });

    return { success: true };
}

/**
 * Restore a deactivated user
 */
export async function restoreUser(userId: string | number, currentUserId: string | number, companyId?: number) {
    const userIdStr = String(userId);
    const currentUserIdStr = String(currentUserId);
    if (userIdStr === currentUserIdStr) {
        throw new DomainError('No puedes restaurar tu propia cuenta', 403);
    }

    const targetUser = await db.query.authUsers.findFirst({ where: eq(authUsers.id, userIdStr) });
    if (!targetUser) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    const effectiveCompanyId = companyId || targetUser.company_id!;

    const [updated] = await db
        .update(authUsers)
        .set({ is_active: true })
        .where(eq(authUsers.id, userIdStr))
        .returning();

    if (!updated) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    await invalidateUserRbacCache(userIdStr, effectiveCompanyId);
    const targetRoom = effectiveCompanyId ? getTenantRoom(effectiveCompanyId, RealtimeEvents.ROOMS.USERS) : RealtimeEvents.ROOMS.USERS;
    broadcast(RealtimeEvents.USER.UPDATED, { userId: userIdStr }, targetRoom);

    logAudit(currentUserId, 'UPDATE', 'user', userIdStr, { is_active: true }, { is_active: false });

    return { success: true };
}

/**
 * Remove a user from the company (removes tenant membership and roles; only purges global account if 0 other memberships remain)
 */
export async function hardDeleteUser(userId: string | number, currentUserId: string | number, companyId?: number) {
    const userIdStr = String(userId);
    const currentUserIdStr = String(currentUserId);
    if (userIdStr === currentUserIdStr) {
        throw new DomainError('No puedes remover tu propia cuenta', 403);
    }

    const targetUser = await db.query.authUsers.findFirst({ where: eq(authUsers.id, userIdStr) });
    if (!targetUser) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    const effectiveCompanyId = companyId || targetUser.company_id!;
    await assertNotSuperadmin(userIdStr, effectiveCompanyId, 'remover');

    // Resolve company organization ID
    let companyOrgId: string | null = null;
    if (effectiveCompanyId) {
        const [companyRow] = await adminDb
            .select({ orgId: companies.organization_id })
            .from(companies)
            .where(eq(companies.id, effectiveCompanyId))
            .limit(1);
        companyOrgId = companyRow?.orgId ?? null;
    }

    await db.transaction(async (tx) => {
        // 1. Remove roles assigned in THIS company
        await tx.delete(authUserRoles).where(
            and(
                eq(authUserRoles.user_id, userIdStr),
                eq(authUserRoles.company_id, effectiveCompanyId)
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

    await invalidateUserRbacCache(userIdStr, effectiveCompanyId);
    const targetRoom = effectiveCompanyId ? getTenantRoom(effectiveCompanyId, RealtimeEvents.ROOMS.USERS) : RealtimeEvents.ROOMS.USERS;
    broadcast(RealtimeEvents.USER.DELETED, { userId: userIdStr }, targetRoom);

    logAudit(currentUserId, 'DELETE', 'user', userIdStr, undefined, { username: targetUser.username, email: targetUser.email });

    return { success: true };
}

/**
 * Pre-flight check for hard delete
 */
export async function checkUserReferences(userId: string | number) {
    const userIdStr = String(userId);
    const user = await db.query.authUsers.findFirst({ where: eq(authUsers.id, userIdStr) });
    if (!user) throw new DomainError('Usuario no encontrado', 404);

    const isSuper = await isUserSuperadmin(userIdStr, user.company_id);

    const [rolesResult, sessionsResult] = await Promise.all([
        db.select({ count: count() }).from(authUserRoles).where(eq(authUserRoles.user_id, userIdStr)),
        db.select({ count: count() }).from(sessions).where(eq(sessions.userId, userIdStr)),
    ]);

    const rolesCount = Number(rolesResult[0]?.count ?? 0);
    const activeSessionsCount = Number(sessionsResult[0]?.count ?? 0);
    const total = rolesCount + activeSessionsCount;

    return { roles: rolesCount, activeSessions: activeSessionsCount, total, canDelete: !isSuper };
}

/**
 * Get paginated audit log for a specific user
 */
export async function getUserAuditLog(userId: string | number, page: number = 1, limit: number = 20) {
    const userIdStr = String(userId);
    const offset = (page - 1) * limit;
    const condition = eq(auditLogs.userId, userIdStr);

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
 * Admin password reset with Better-Auth credentials update
 */
export async function adminResetPassword(
    adminUserId: string | number,
    targetUserId: string | number,
    newPassword: string,
) {
    const adminUserIdStr = String(adminUserId);
    const targetUserIdStr = String(targetUserId);
    if (adminUserIdStr === targetUserIdStr) {
        throw new DomainError('Usa el cambio de contraseña personal para tu propia cuenta', 400);
    }

    const user = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, targetUserIdStr),
    });
    if (!user) throw new DomainError('Usuario no encontrado', 404);

    const newHash = await hashPassword(newPassword);
    
    // Update Better-Auth account table
    await db.update(account)
        .set({ password: newHash })
        .where(and(eq(account.userId, targetUserIdStr), eq(account.providerId, 'credential')));

    await revokeAllUserSessions(targetUserIdStr);

    logAudit(adminUserId, 'UPDATE', 'user', targetUserIdStr, { field: 'password', action: 'admin_reset' });

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
    const targetRoom = getTenantRoom(companyId, RealtimeEvents.ROOMS.USERS);
    broadcast(RealtimeEvents.USER.UPDATED, { userId: userIdStr }, targetRoom);

    return { id: userIdStr, entityId };
}

/**
 * Batch deactivate multiple users
 */
export async function batchDeleteUsers(userIds: (string)[], currentUserId: string) {
    const currentUserIdStr = String(currentUserId);
    const idsStr = userIds.map(id => String(id));
    if (idsStr.includes(currentUserIdStr)) {
        throw new DomainError('No puedes desactivar tu propia cuenta', 403);
    }

    const safeIds: string[] = [];
    const errors: { userId: string; success: false; error: string }[] = [];

    for (const userId of idsStr) {
        try {
            await assertNotSuperadmin(userId, undefined, 'desactivar');
            safeIds.push(userId);
        } catch (error: any) {
            errors.push({ userId, success: false, error: error.message });
        }
    }

    if (safeIds.length > 0) {
        await db.update(authUsers)
            .set({ is_active: false })
            .where(inArray(authUsers.id, safeIds));

        await Promise.all(safeIds.map(id => invalidateUserRbacCache(id)));
        broadcast(RealtimeEvents.USER.UPDATED, { userIds: safeIds }, RealtimeEvents.ROOMS.USERS);

        for (const id of safeIds) logAudit(currentUserId, 'UPDATE', 'user', id, { is_active: false }, { is_active: true });
    }

    return [
        ...safeIds.map(userId => ({ userId, success: true as const })),
        ...errors,
    ];
}

/**
 * Batch restore multiple users
 */
export async function batchRestoreUsers(userIds: (string)[], currentUserId: string) {
    const currentUserIdStr = String(currentUserId);
    const idsStr = userIds.map(id => String(id));
    const safeIds = idsStr.filter(id => id !== currentUserIdStr);
    const errors: { userId: string; success: false; error: string }[] = [];

    if (idsStr.includes(currentUserIdStr)) {
        errors.push({ userId: currentUserId, success: false, error: 'No puedes restaurar tu propia cuenta' });
    }

    if (safeIds.length > 0) {
        await db.update(authUsers)
            .set({ is_active: true })
            .where(inArray(authUsers.id, safeIds));

        await Promise.all(safeIds.map(id => invalidateUserRbacCache(id)));
        broadcast(RealtimeEvents.USER.UPDATED, { userIds: safeIds }, RealtimeEvents.ROOMS.USERS);

        for (const id of safeIds) logAudit(currentUserId, 'UPDATE', 'user', id, { is_active: true }, { is_active: false });
    }

    return [
        ...safeIds.map(userId => ({ userId, success: true as const })),
        ...errors,
    ];
}
