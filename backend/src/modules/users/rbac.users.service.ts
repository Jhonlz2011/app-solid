import { db } from '../../core/db';
import { authUsers, authUserRoles, authRoles, entities, auditLogs, sessions, account } from '@app/schema/tables';
import { eq, sql, count, and, inArray, ilike, or, asc, desc, type SQL } from '@app/schema';
import { cacheService } from '../../core/cache';
import { DomainError } from '../../core/errors';
import { broadcast } from '../../core/sse/sse';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { SYSTEM_ROLES } from '@app/schema/enums';
import { invalidateUserRbacCache, revokeAllUserSessions, ensureNotLastSuperadmin, getUserRoles } from './rbac.permission.service';
import { logAudit } from './rbac.roles.service';

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
export const USERS_SORT_WHITELIST: Record<string, typeof authUsers.username> = {
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
    if (companyId) conditions.push(eq(authUsers.company_id, companyId));
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
        .leftJoin(entities, eq(authUsers.entity_id, entities.id))
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

        let activeConditions: any[] = [];
        if (companyId) activeConditions.push(eq(authUsers.company_id, companyId));
        if (filters.search) {
            const term = `%${filters.search}%`;
            activeConditions.push(or(ilike(authUsers.username, term), ilike(authUsers.email, term), ilike(authUsers.name, term)));
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

        let rolesConditions: any[] = [];
        if (companyId) rolesConditions.push(eq(authUsers.company_id, companyId));
        if (filters.search) {
            const term = `%${filters.search}%`;
            rolesConditions.push(or(ilike(authUsers.username, term), ilike(authUsers.email, term), ilike(authUsers.name, term)));
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
    const conditions = [eq(authUsers.id, idStr)];
    if (companyId) conditions.push(eq(authUsers.company_id, companyId));
    const user = await db.query.authUsers.findFirst({
        where: and(...conditions),
        columns: {
            id: true,
            username: true,
            name: true,
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
        .where(eq(authUserRoles.user_id, idStr));

    return {
        id: user.id,
        username: user.username || user.name,
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
        await tx.delete(authUserRoles).where(eq(authUserRoles.user_id, userIdStr));

        if (roleIds.length > 0) {
            await tx.insert(authUserRoles).values(
                roleIds.map(roleId => ({
                    user_id: userIdStr,
                    role_id: roleId,
                    company_id: user.company_id!,
                }))
            );
        }
    });

    await invalidateUserRbacCache(userIdStr);
    broadcast(RealtimeEvents.USER.RBAC_CHANGED, { userId: userIdStr }, `user:${userIdStr}`);
    broadcast(RealtimeEvents.USER.UPDATED, { id: userIdStr }, RealtimeEvents.ROOMS.USERS);

    logAudit(currentUserId, 'UPDATE', 'auth_user_roles', userIdStr, { roleIds }, { roleIds: oldRoleIds });

    return { success: true };
}

/**
 * Create a new user (admin function with Better-Auth credential account creation)
 */
export async function createUser(data: { username: string; email: string; password: string; roleIds?: number[] }, currentUserId?: string | number, companyId?: number) {
    const existing = await db.query.authUsers.findFirst({
        where: and(eq(authUsers.company_id, companyId!), eq(authUsers.email, data.email)),
    });

    if (existing) {
        throw new DomainError('Ya existe un usuario con ese email', 409);
    }

    const existingUsername = await db.query.authUsers.findFirst({
        where: and(eq(authUsers.company_id, companyId!), eq(authUsers.username, data.username)),
    });

    if (existingUsername) {
        throw new DomainError('Ya existe un usuario con ese nombre de usuario', 409);
    }

    const password_hash = await Bun.password.hash(data.password);

    const [newUser] = await db
        .insert(authUsers)
        .values({
            name: data.username,
            username: data.username,
            email: data.email,
            company_id: companyId!,
            is_active: true,
            emailVerified: false,
        })
        .returning({ id: authUsers.id, username: authUsers.username, email: authUsers.email });

    await db.insert(account).values({
        accountId: newUser.id,
        providerId: 'credential',
        userId: newUser.id,
        password: password_hash,
    });

    if (data.roleIds && data.roleIds.length > 0) {
        await db.insert(authUserRoles).values(
            data.roleIds.map(roleId => ({
                user_id: newUser.id,
                role_id: roleId,
                company_id: companyId!,
            }))
        );
    }

    broadcast(RealtimeEvents.USER.CREATED, { id: newUser.id }, RealtimeEvents.ROOMS.USERS);

    if (currentUserId) logAudit(currentUserId, 'INSERT', 'user', newUser.id, { username: data.username, email: data.email, roleIds: data.roleIds });

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
    const deleted = await db
        .delete(authUserRoles)
        .where(and(
            eq(authUserRoles.user_id, userIdStr),
            eq(authUserRoles.role_id, roleId)
        ))
        .returning();

    if (deleted.length === 0) {
        throw new DomainError('El usuario no tiene este rol', 404);
    }

    await invalidateUserRbacCache(userIdStr);
    broadcast(RealtimeEvents.USER.UPDATED, { id: userIdStr }, RealtimeEvents.ROOMS.USERS);

    return { success: true };
}

/**
 * Update user details
 */
export async function updateUser(userId: string | number, data: { username?: string; email?: string; isActive?: boolean }, currentUserId?: string | number, companyId?: number) {
    const userIdStr = String(userId);
    if (data.email) {
        const emailConds = [eq(authUsers.email, data.email), sql`${authUsers.id} != ${userIdStr}`];
        if (companyId) emailConds.push(eq(authUsers.company_id, companyId));
        const existing = await db.query.authUsers.findFirst({
            where: and(...emailConds),
        });

        if (existing) {
            throw new DomainError('Ya existe un usuario con ese email', 409);
        }
    }

    if (data.username) {
        const usernameConds = [eq(authUsers.username, data.username), sql`${authUsers.id} != ${userIdStr}`];
        if (companyId) usernameConds.push(eq(authUsers.company_id, companyId));
        const existing = await db.query.authUsers.findFirst({
            where: and(...usernameConds),
        });

        if (existing) {
            throw new DomainError('Ya existe un usuario con ese nombre de usuario', 409);
        }
    }

    const oldUser = currentUserId ? await db.query.authUsers.findFirst({
        where: eq(authUsers.id, userIdStr),
        columns: { username: true, email: true, is_active: true },
    }) : undefined;

    const updateData: Partial<{ username: string; name: string; email: string; is_active: boolean }> = {};
    if (data.username !== undefined) {
        updateData.username = data.username;
        updateData.name = data.username;
    }
    if (data.email !== undefined) updateData.email = data.email;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const [updated] = await db
        .update(authUsers)
        .set(updateData)
        .where(eq(authUsers.id, userIdStr))
        .returning({ id: authUsers.id, username: authUsers.username, email: authUsers.email, isActive: authUsers.is_active });

    if (!updated) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    broadcast(RealtimeEvents.USER.UPDATED, { userId: userIdStr }, RealtimeEvents.ROOMS.USERS);

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

    await ensureNotLastSuperadmin(userIdStr);

    const [updated] = await db
        .update(authUsers)
        .set({ is_active: false })
        .where(eq(authUsers.id, userIdStr))
        .returning();

    if (!updated) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    await invalidateUserRbacCache(userIdStr);
    broadcast(RealtimeEvents.USER.SESSION_REVOKED, { userId: userIdStr }, `user:${userIdStr}`);
    broadcast(RealtimeEvents.USER.UPDATED, { userId: userIdStr }, RealtimeEvents.ROOMS.USERS);

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

    await invalidateUserRbacCache(userIdStr);
    broadcast(RealtimeEvents.USER.UPDATED, { userId: userIdStr }, RealtimeEvents.ROOMS.USERS);

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

    await ensureNotLastSuperadmin(userIdStr);

    await db.delete(authUserRoles).where(eq(authUserRoles.user_id, userIdStr));
    await revokeAllUserSessions(userIdStr);

    const deleted = await db.delete(authUsers).where(eq(authUsers.id, userIdStr)).returning({
        id: authUsers.id, username: authUsers.username, email: authUsers.email,
    });
    if (deleted.length === 0) {
        throw new DomainError('Usuario no encontrado', 404);
    }

    await invalidateUserRbacCache(userIdStr);
    broadcast(RealtimeEvents.USER.DELETED, { userId: userIdStr }, RealtimeEvents.ROOMS.USERS);

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

    const [rolesResult, sessionsResult] = await Promise.all([
        db.select({ count: count() }).from(authUserRoles).where(eq(authUserRoles.user_id, userIdStr)),
        db.select({ count: count() }).from(sessions).where(eq(sessions.userId, userIdStr)),
    ]);

    const rolesCount = Number(rolesResult[0]?.count ?? 0);
    const activeSessionsCount = Number(sessionsResult[0]?.count ?? 0);
    const total = rolesCount + activeSessionsCount;

    return { roles: rolesCount, activeSessions: activeSessionsCount, total, canDelete: true };
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

    const newHash = await Bun.password.hash(newPassword);
    
    // Update Better-Auth account table
    await db.update(account)
        .set({ password: newHash })
        .where(and(eq(account.userId, targetUserIdStr), eq(account.providerId, 'credential')));

    await revokeAllUserSessions(targetUserIdStr);

    logAudit(adminUserId, 'UPDATE', 'user', targetUserIdStr, { field: 'password', action: 'admin_reset' });

    return { success: true };
}

/**
 * Assign or unassign an entity to a user
 */
export async function setUserEntity(
    userId: string | number,
    entityId: number | null,
    currentUserId?: string | number,
) {
    const userIdStr = String(userId);
    if (entityId !== null) {
        const entity = await db.query.entities.findFirst({
            where: eq(entities.id, entityId),
        });
        if (!entity) throw new DomainError('Entidad no encontrada', 404);
    }

    const oldUser = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, userIdStr),
        columns: { entity_id: true },
    });

    const [updated] = await db
        .update(authUsers)
        .set({ entity_id: entityId })
        .where(eq(authUsers.id, userIdStr))
        .returning({ id: authUsers.id, entityId: authUsers.entity_id });

    if (!updated) throw new DomainError('Usuario no encontrado', 404);

    if (currentUserId) logAudit(currentUserId, 'UPDATE', 'user', userIdStr, { entity_id: entityId }, { entity_id: oldUser?.entity_id ?? null });
    broadcast(RealtimeEvents.USER.UPDATED, { userId: userIdStr }, RealtimeEvents.ROOMS.USERS);

    return updated;
}

/**
 * Batch deactivate multiple users
 */
export async function batchDeleteUsers(userIds: (string | number)[], currentUserId: string | number) {
    const currentUserIdStr = String(currentUserId);
    const idsStr = userIds.map(id => String(id));
    if (idsStr.includes(currentUserIdStr)) {
        throw new DomainError('No puedes desactivar tu propia cuenta', 403);
    }

    const safeIds: string[] = [];
    const errors: { userId: string | number; success: false; error: string }[] = [];

    for (const userId of userIds) {
        try {
            await ensureNotLastSuperadmin(userId);
            safeIds.push(String(userId));
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
export async function batchRestoreUsers(userIds: (string | number)[], currentUserId: string | number) {
    const currentUserIdStr = String(currentUserId);
    const idsStr = userIds.map(id => String(id));
    const safeIds = idsStr.filter(id => id !== currentUserIdStr);
    const errors: { userId: string | number; success: false; error: string }[] = [];

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
