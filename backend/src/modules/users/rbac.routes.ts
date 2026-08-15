import { Elysia, t } from 'elysia';
import { authGuard } from '../../plugins/auth-guard';
import { rbac } from '../../plugins/rbac';
import {
    getAllRoles,
    getAllPermissions,
    getAllUsersWithRoles,
    createRole,
    updateRole,
    deleteRole,
    getRolePermissions,
    updateRolePermissions,
    assignUserRoles,
    getUserRolesById,
    createUser,
    getUsersByRole,
    removeUserFromRole,
    updateUser,
    deactivateUser,
    hardDeleteUser,
    restoreUser,
    checkUserReferences,
    batchDeleteUsers,
    batchRestoreUsers,
    getUserById,
    getRoleById,
    getUserFacets,
    getUserAuditLog,
    adminResetPassword,
    setUserEntity,
} from './rbac.service';
import { getActiveSessions, revokeSession } from '../auth';
import {
    RoleBodySchema,
    RolePermissionsUpdateSchema,
    RbacUserCreateSchema,
    RbacUserUpdateSchema,
    RbacUserResetPasswordSchema,
    RbacUserAssignEntitySchema,
    UserRolesAssignSchema,
    UserSessionItemSchema,
    UserReferencesResponseSchema,
    BatchResultItemSchema,
    UserAuditLogQuerySchema,
    UserFacetsQuerySchema,
    UserListQuerySchema,
    AuditLogResponseSchema,
    IdParamSchema,
    BulkIdsBodySchema,
} from '@app/schema/backend';

export const rbacRoutes = new Elysia({ prefix: '/rbac' })
    .use(authGuard)
    .use(rbac)
    .get('/roles', async ({ currentCompanyId }) => {
        return await getAllRoles(currentCompanyId);
    }, { permission: 'roles.read' })

    .post('/roles', async ({ body, currentUserId, currentCompanyId }) => {
        return await createRole(body.name, body.description ?? null, currentUserId, currentCompanyId);
    }, {
        permission: 'roles.create',
        body: RoleBodySchema,
    })

    .put('/roles/:id', async ({ params, body, currentUserId }) => {
        return await updateRole(Number(params.id), body.name, body.description ?? null, currentUserId);
    }, {
        permission: 'roles.update',
        params: IdParamSchema,
        body: RoleBodySchema,
    })

    .delete('/roles/:id', async ({ params, currentUserId }) => {
        return await deleteRole(Number(params.id), currentUserId);
    }, {
        permission: 'roles.delete',
        params: IdParamSchema,
    })

    // Single role by ID (with is_system, permissionCount, userCount)
    .get('/roles/:id', async ({ params }) => {
        return await getRoleById(Number(params.id));
    }, {
        permission: 'roles.read',
        params: IdParamSchema,
    })

    .get('/roles/:id/permissions', async ({ params }) => {
        return await getRolePermissions(Number(params.id));
    }, {
        permission: 'roles.read',
        params: IdParamSchema,
    })

    .put('/roles/:id/permissions', async ({ params, body, currentUserId }) => {
        return await updateRolePermissions(Number(params.id), body.permissionIds, currentUserId);
    }, {
        permission: 'permissions.update',
        params: IdParamSchema,
        body: RolePermissionsUpdateSchema,
    })

    // Role users
    .get('/roles/:id/users', async ({ params }) => {
        return await getUsersByRole(Number(params.id));
    }, {
        permission: 'roles.read',
        params: IdParamSchema,
    })

    .delete('/roles/:id/users/:userId', async ({ params }) => {
        return await removeUserFromRole(Number(params.userId), Number(params.id));
    }, {
        permission: 'roles.update',
        params: t.Object({ id: t.Numeric(), userId: t.Numeric() }),
    })

    // Permissions (read-only)
    .get('/permissions', async () => {
        return await getAllPermissions();
    }, { permission: 'permissions.read' })

    // Parse arrays
    .get('/users/facets', async ({ query, currentCompanyId }) => {
        const parseArray = (val?: string) => val?.split(',').filter(Boolean);
        return await getUserFacets({
            search: query.search,
            isActive: parseArray(query.isActive),
            roles: parseArray(query.roles),
        }, currentCompanyId);
    }, {
        permission: 'users.read',
        query: UserFacetsQuerySchema,
    })

    // Users with roles (paginated)
    .get('/users', async ({ query, currentCompanyId }) => {
        const parseArray = (val?: string) => val?.split(',').filter(Boolean);
        return await getAllUsersWithRoles({
            search: query.search,
            page: query.page ? Number(query.page) : undefined,
            limit: query.limit ? Number(query.limit) : undefined,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder as 'asc' | 'desc' | undefined,
            isActive: parseArray(query.isActive),
            roles: parseArray(query.roles),
        }, currentCompanyId);
    }, {
        permission: 'users.read',
        query: UserListQuerySchema,
    })

    // Single user by ID
    .get('/users/:id', async ({ params, currentCompanyId }) => {
        return await getUserById(Number(params.id), currentCompanyId);
    }, {
        permission: 'users.read',
        params: IdParamSchema,
    })

    .post('/users', async ({ body, currentUserId, currentCompanyId }) => {
        return await createUser(body, currentUserId, currentCompanyId);
    }, {
        permission: 'users.create',
        body: RbacUserCreateSchema,
    })

    .put('/users/:id', async ({ params, body, currentUserId }) => {
        return await updateUser(Number(params.id), body, currentUserId);
    }, {
        permission: 'users.update',
        params: IdParamSchema,
        body: RbacUserUpdateSchema,
    })

    // Soft-delete (deactivate) — preserves roles
    .patch('/users/:id/deactivate', async ({ params, currentUserId }) => {
        return await deactivateUser(Number(params.id), currentUserId);
    }, {
        permission: 'users.delete',
        params: IdParamSchema,
        response: t.Object({ success: t.Boolean() }),
    })

    // Hard-delete (destroy) — permanently removes user
    .delete('/users/:id', async ({ params, currentUserId }) => {
        return await hardDeleteUser(Number(params.id), currentUserId);
    }, {
        permission: 'users.destroy',
        params: IdParamSchema,
        response: t.Object({ success: t.Boolean() }),
    })

    // Restore a deactivated user
    .patch('/users/:id/restore', async ({ params, currentUserId }) => {
        return await restoreUser(Number(params.id), currentUserId);
    }, {
        permission: 'users.restore',
        params: IdParamSchema,
        response: t.Object({ success: t.Boolean() }),
    })

    // Pre-flight hard-delete reference check
    .get('/users/:id/can-delete', async ({ params }) => {
        return await checkUserReferences(Number(params.id));
    }, {
        permission: 'users.destroy',
        params: IdParamSchema,
        response: UserReferencesResponseSchema,
    })

    .get('/users/:id/roles', async ({ params }) => {
        return await getUserRolesById(Number(params.id));
    }, {
        permission: 'users.read',
        params: IdParamSchema,
    })

    .put('/users/:id/roles', async ({ params, body, currentUserId }) => {
        return await assignUserRoles(Number(params.id), body.roleIds, currentUserId);
    }, {
        permission: 'users.update',
        params: IdParamSchema,
        body: UserRolesAssignSchema,
    })

    // =========================================================================
    // User Sessions, Audit, Password Reset, Entity
    // =========================================================================

    // Admin: view sessions for a specific user
    .get('/users/:id/sessions', async ({ params, currentSessionId }) => {
        return await getActiveSessions(Number(params.id), currentSessionId);
    }, {
        permission: 'users.read',
        params: IdParamSchema,
        response: t.Array(UserSessionItemSchema),
    })

    // Admin: revoke a specific session for a user
    .delete('/users/:id/sessions/:sessionId', async ({ params }) => {
        return await revokeSession(params.sessionId, Number(params.id));
    }, {
        permission: 'users.update',
        params: t.Object({ id: t.Numeric(), sessionId: t.String() }),
        response: t.Object({ success: t.Boolean() }),
    })

    // Paginated audit log for a user
    .get('/users/:id/audit-log', async ({ params, query }) => {
        return await getUserAuditLog(
            Number(params.id),
            query.page ? Number(query.page) : 1,
            query.limit ? Number(query.limit) : 20,
        );
    }, {
        permission: 'users.read',
        params: IdParamSchema,
        query: UserAuditLogQuerySchema,
        response: AuditLogResponseSchema,
    })

    // Admin password reset (no current password required)
    .post('/users/:id/reset-password', async ({ params, body, currentUserId }) => {
        return await adminResetPassword(currentUserId, Number(params.id), body.newPassword);
    }, {
        permission: 'users.update',
        params: IdParamSchema,
        body: RbacUserResetPasswordSchema,
        response: t.Object({ success: t.Boolean() }),
    })

    // Assign/unassign entity to user
    .patch('/users/:id/entity', async ({ params, body, currentUserId }) => {
        return await setUserEntity(Number(params.id), body.entityId, currentUserId);
    }, {
        permission: 'users.update',
        params: IdParamSchema,
        body: RbacUserAssignEntitySchema,
        response: t.Object({
            id: t.Number(),
            entityId: t.Union([t.Number(), t.Null()]),
        }),
    })

    // =========================================================================
    // Batch Operations
    // =========================================================================
    // Bulk soft-delete (deactivate)
    .post('/users/bulk/delete', async ({ body, currentUserId }) => {
        return await batchDeleteUsers(body.ids, currentUserId);
    }, {
        permission: 'users.delete',
        body: BulkIdsBodySchema,
        response: t.Array(BatchResultItemSchema),
    })

    // Bulk restore
    .patch('/users/bulk/restore', async ({ body, currentUserId }) => {
        return await batchRestoreUsers(body.ids, currentUserId);
    }, {
        permission: 'users.restore',
        body: BulkIdsBodySchema,
        response: t.Array(BatchResultItemSchema),
    });
