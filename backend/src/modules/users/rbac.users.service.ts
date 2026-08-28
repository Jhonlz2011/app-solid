import { db, adminDb } from '../../core/db';
import { v7 as uuidv7 } from 'uuid';
import { authUsers, authUserRoles, authRoles, entities, auditLogs, sessions, account, member, companies } from '@app/schema/tables';
import { eq, ne,sql, count, and, inArray, ilike, or, asc, desc, type SQL } from '@app/schema';
import { cacheService } from '../../core/cache';
import { DomainError } from '../../core/errors';
import { broadcast } from '../../core/sse/events';
import { RealtimeEvents, getTenantRoom } from '@app/schema/realtime-events';
import { SYSTEM_ROLES } from '@app/schema/enums';
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
            username: user.username || user.name,
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

    const roles = await db
        .select({ id: authRoles.id, name: authRoles.name, description: authRoles.description })
        .from(authUserRoles)
        .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
        .where(eq(authUserRoles.user_id, idStr));

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
 * Get roles for a specific user
 */
export async function getUserRolesById(userId: string | number) {
    const userIdStr = String(userId);
    const roles = await db
        .select({
            id: authRoles.id,
            name: authRoles.name,
            description: authRoles.description,
        })
        .from(authUserRoles)
        .innerJoin(authRoles, eq(authUserRoles.role_id, authRoles.id))
        .where(eq(authUserRoles.user_id, userIdStr));

    return roles;
}

/**
 * Assign roles to a user
 */
export async function assignUserRoles(userId: string | number, roleIds: number[], currentUserId: string | number) {
    const userIdStr = String(userId);
    const user = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, userIdStr),
    });

    if (!user) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    const oldRoles = await db.select({ id: authUserRoles.role_id }).from(authUserRoles).where(eq(authUserRoles.user_id, userIdStr));
    const oldRoleIds = oldRoles.map(r => r.id);

    // Superadmin protection: exactly 1 superadmin per company (the owner)
    const isTargetSuperadmin = await isUserSuperadmin(userIdStr, user.company_id);
    const superadminRole = await db.query.authRoles.findFirst({
        where: and(eq(authRoles.company_id, user.company_id!), eq(authRoles.name, SYSTEM_ROLES.SUPERADMIN)),
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
        const currentRoles = await getUserRoles(currentUserId, user.company_id);
        if (!currentRoles.includes(SYSTEM_ROLES.SUPERADMIN)) {
            const systemRoles = await db.select({ id: authRoles.id })
                .from(authRoles)
                .where(and(
                    inArray(authRoles.id, finalRoleIds),
                    eq(authRoles.is_system, true)
                ));
            if (systemRoles.length > 0) {
                throw new DomainError('Solo superadmin puede asignar roles de sistema', 403);
            }
        }
    }

    await db.transaction(async (tx) => {
        await tx.delete(authUserRoles).where(eq(authUserRoles.user_id, userIdStr));

        if (finalRoleIds.length > 0) {
            await tx.insert(authUserRoles).values(
                finalRoleIds.map(roleId => ({
                    user_id: userIdStr,
                    role_id: roleId,
                    company_id: user.company_id!,
                }))
            );
        }
    });

    await invalidateUserRbacCache(userIdStr, user.company_id);
    broadcast(RealtimeEvents.USER.RBAC_CHANGED, { userId: userIdStr }, `user:${userIdStr}`);
    const targetRoom = user.company_id ? getTenantRoom(user.company_id, RealtimeEvents.ROOMS.USERS) : RealtimeEvents.ROOMS.USERS;
    broadcast(RealtimeEvents.USER.UPDATED, { id: userIdStr }, targetRoom);

    logAudit(currentUserId, 'UPDATE', 'auth_user_roles', userIdStr, { roleIds: finalRoleIds }, { roleIds: oldRoleIds });

    return { success: true };
}

/**
 * Create a new user (admin function with Better-Auth credential account creation & organization member sync)
 */
export async function createUser(data: { username: string; email: string; password: string; roleIds?: number[] }, currentUserId?: string | number, companyId?: number) {
    const normalizedEmail = data.email.trim().toLowerCase();
    const normalizedUsername = data.username.trim().toLowerCase();
    const displayName = data.username.trim();

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

    // 3. Comprobar si el email ya fue verificado globalmente en cualquier otra cuenta previa
    const globallyVerifiedUser = await adminDb.query.authUsers.findFirst({
        where: and(
            eq(authUsers.email, normalizedEmail),
            eq(authUsers.emailVerified, true)
        ),
    });
    const isAlreadyVerified = Boolean(globallyVerifiedUser);

    // Superadmin protection: prevent creating a second superadmin
    if (data.roleIds && data.roleIds.length > 0 && companyId) {
        const superadminRole = await db.query.authRoles.findFirst({
            where: and(eq(authRoles.company_id, companyId), eq(authRoles.name, SYSTEM_ROLES.SUPERADMIN)),
        });
        if (superadminRole && data.roleIds.includes(superadminRole.id)) {
            throw new DomainError('El rol superadmin es exclusivo del propietario de la empresa y no puede ser asignado', 403);
        }
    }

    const password_hash = await hashPassword(data.password);

    const newUser = await db.transaction(async (tx) => {
        // ──────────────────────────────────────────────────────────────────
        // CHECK: Does a user with this email already exist globally?
        // (e.g. registered via OAuth in another tenant, or via another tenant's admin)
        // If so, reuse that user record — just add org membership + roles.
        // This prevents duplicate user records and enables cross-tenant OAuth.
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
                    }).onConflictDoNothing();
                }
            }

            // Ensure the existing user has a credential account for this tenant's password login
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
        // No existing user — create a brand new user + account + membership
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
                emailVerified: isAlreadyVerified,
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

    if (currentUserId) logAudit(currentUserId, 'INSERT', 'user', newUser.id, { username: displayName, email: normalizedEmail, roleIds: data.roleIds });

    return newUser;
}

/**
 * Get all users with a specific role
 */
export async function getUsersByRole(roleId: number) {
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
        .where(eq(authUserRoles.role_id, roleId));

    return usersInRole.map(u => ({ ...u, username: u.username || u.name }));
}

/**
 * Remove a user from a specific role
 */
export async function removeUserFromRole(userId: string | number, roleId: number) {
    const userIdStr = String(userId);
    
    // Superadmin protection: owner cannot be removed from superadmin
    const role = await db.query.authRoles.findFirst({ where: eq(authRoles.id, roleId) });
    if (role?.name === SYSTEM_ROLES.SUPERADMIN) {
        throw new DomainError('No se puede remover el rol superadmin del propietario de la empresa', 403);
    }

    const deleted = await db
        .delete(authUserRoles)
        .where(and(
            eq(authUserRoles.user_id, userIdStr),
            eq(authUserRoles.role_id, roleId)
        ))
        .returning();

    const user = await db.query.authUsers.findFirst({ where: eq(authUsers.id, userIdStr) });
    await invalidateUserRbacCache(userIdStr, user?.company_id);
    const targetRoom = user?.company_id ? getTenantRoom(user.company_id, RealtimeEvents.ROOMS.USERS) : RealtimeEvents.ROOMS.USERS;
    broadcast(RealtimeEvents.USER.UPDATED, { id: userIdStr }, targetRoom);

    return { success: true };
}

/**
 * Update user details
 */
export async function updateUser(userId: string | number, data: { username?: string; email?: string; isActive?: boolean }, currentUserId?: string | number, companyId?: number) {
    const userIdStr = String(userId);
    const updateData: Partial<{ username: string; name: string; email: string; is_active: boolean; emailVerified: boolean }> = {};

    if (data.username !== undefined) {
        const normalizedUsername = data.username.trim().toLowerCase();
        // Validar unicidad global del username
        const existingUsername = await adminDb.query.authUsers.findFirst({
            where: and(
                eq(authUsers.username, normalizedUsername),
                ne(authUsers.id, userIdStr)
            ),
        });

        if (existingUsername) {
            throw new DomainError('Ya existe un usuario con ese nombre de usuario', 409);
        }

        updateData.username = normalizedUsername;
        updateData.name = data.username.trim();
    }

    if (data.email !== undefined) {
        const normalizedEmail = data.email.trim().toLowerCase();
        const existingEmail = await adminDb.query.authUsers.findFirst({
            where: and(
                eq(authUsers.email, normalizedEmail),
                ne(authUsers.id, userIdStr)
            ),
        });

        if (existingEmail) {
            throw new DomainError('Ya existe un usuario con ese email', 409);
        }

        // Comprobar si el nuevo email ya fue verificado globalmente
        const globallyVerifiedUser = await adminDb.query.authUsers.findFirst({
            where: and(
                eq(authUsers.email, normalizedEmail),
                eq(authUsers.emailVerified, true)
            ),
        });

        updateData.email = normalizedEmail;
        updateData.emailVerified = Boolean(globallyVerifiedUser);
    }

    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const oldUser = currentUserId ? await db.query.authUsers.findFirst({
        where: eq(authUsers.id, userIdStr),
        columns: { username: true, email: true, is_active: true, company_id: true },
    }) : undefined;

    const [updated] = await db
        .update(authUsers)
        .set(updateData)
        .where(eq(authUsers.id, userIdStr))
        .returning({ id: authUsers.id, username: authUsers.username, email: authUsers.email, isActive: authUsers.is_active, company_id: authUsers.company_id });

    if (!updated) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    const targetRoom = updated?.company_id ? getTenantRoom(updated.company_id, RealtimeEvents.ROOMS.USERS) : RealtimeEvents.ROOMS.USERS;
    broadcast(RealtimeEvents.USER.UPDATED, { userId: userIdStr }, targetRoom);

    if (currentUserId) logAudit(currentUserId, 'UPDATE', 'user', userIdStr, updateData, oldUser ? { username: oldUser.username, email: oldUser.email, is_active: oldUser.is_active } : undefined);

    return updated;
}

/**
 * Deactivate a user (soft-delete)
 */
export async function deactivateUser(userId: string | number, currentUserId: string | number) {
    const userIdStr = String(userId);
    const currentUserIdStr = String(currentUserId);
    if (userIdStr === currentUserIdStr) {
        throw new DomainError('No puedes desactivar tu propia cuenta', 403);
    }

    const targetUser = await db.query.authUsers.findFirst({ where: eq(authUsers.id, userIdStr) });
    if (!targetUser) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    await assertNotSuperadmin(userIdStr, targetUser.company_id, 'desactivar');

    const [updated] = await db
        .update(authUsers)
        .set({ is_active: false })
        .where(eq(authUsers.id, userIdStr))
        .returning();

    await invalidateUserRbacCache(userIdStr, targetUser.company_id);
    broadcast(RealtimeEvents.USER.SESSION_REVOKED, { userId: userIdStr }, `user:${userIdStr}`);
    const targetRoom = updated?.company_id ? getTenantRoom(updated.company_id, RealtimeEvents.ROOMS.USERS) : RealtimeEvents.ROOMS.USERS;
    broadcast(RealtimeEvents.USER.UPDATED, { userId: userIdStr }, targetRoom);

    logAudit(currentUserId, 'UPDATE', 'user', userIdStr, { is_active: false }, { is_active: true });

    return { success: true };
}

/**
 * Restore a deactivated user
 */
export async function restoreUser(userId: string | number, currentUserId: string | number) {
    const userIdStr = String(userId);
    const currentUserIdStr = String(currentUserId);
    if (userIdStr === currentUserIdStr) {
        throw new DomainError('No puedes restaurar tu propia cuenta', 403);
    }

    const [updated] = await db
        .update(authUsers)
        .set({ is_active: true })
        .where(eq(authUsers.id, userIdStr))
        .returning();

    if (!updated) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    await invalidateUserRbacCache(userIdStr, updated?.company_id);
    const targetRoom = updated?.company_id ? getTenantRoom(updated.company_id, RealtimeEvents.ROOMS.USERS) : RealtimeEvents.ROOMS.USERS;
    broadcast(RealtimeEvents.USER.UPDATED, { userId: userIdStr }, targetRoom);

    logAudit(currentUserId, 'UPDATE', 'user', userIdStr, { is_active: true }, { is_active: false });

    return { success: true };
}

/**
 * Hard delete a user permanently
 */
export async function hardDeleteUser(userId: string | number, currentUserId: string | number) {
    const userIdStr = String(userId);
    const currentUserIdStr = String(currentUserId);
    if (userIdStr === currentUserIdStr) {
        throw new DomainError('No puedes destruir tu propia cuenta', 403);
    }

    const targetUser = await db.query.authUsers.findFirst({ where: eq(authUsers.id, userIdStr) });
    if (!targetUser) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    await assertNotSuperadmin(userIdStr, targetUser.company_id, 'eliminar');

    await db.delete(authUserRoles).where(eq(authUserRoles.user_id, userIdStr));
    await revokeAllUserSessions(userIdStr);

    const deleted = await db.delete(authUsers).where(eq(authUsers.id, userIdStr)).returning({
        id: authUsers.id, username: authUsers.username, email: authUsers.email, company_id: authUsers.company_id,
    });
    if (deleted.length === 0) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    await invalidateUserRbacCache(userIdStr, targetUser.company_id);
    const targetRoom = deleted[0]?.company_id ? getTenantRoom(deleted[0].company_id, RealtimeEvents.ROOMS.USERS) : RealtimeEvents.ROOMS.USERS;
    broadcast(RealtimeEvents.USER.DELETED, { userId: userIdStr }, targetRoom);

    logAudit(currentUserId, 'DELETE', 'user', userIdStr, undefined, { username: deleted[0].username, email: deleted[0].email });

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
