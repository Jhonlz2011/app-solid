import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { rbac } from '../plugins/rbac';
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
} from '../services/rbac.service';
import { getActiveSessions, revokeSession } from '../services/auth.service';

export const rbacRoutes = new Elysia({ prefix: '/rbac' })
    .use(authGuard)
    .use(rbac)
    .get('/roles', async ({ currentCompanyId }) => {
        return await getAllRoles(currentCompanyId);
    }, { permission: 'roles.read' })

    .post('/roles', async ({ body, currentUserId, currentCompanyId }) => {
        return await createRole(body.name, body.description, currentUserId, currentCompanyId);
    }, {
        permission: 'roles.create',
        body: t.Object({
            name: t.String({ minLength: 2 }),
            description: t.Optional(t.String()),
        }),
    })

    .put('/roles/:id', async ({ params, body, currentUserId }) => {
        return await updateRole(Number(params.id), body.name, body.description, currentUserId);
    }, {
        permission: 'roles.update',
        body: t.Object({
            name: t.String({ minLength: 2 }),
            description: t.Optional(t.String()),
        }),
    })

    .delete('/roles/:id', async ({ params, currentUserId }) => {
        return await deleteRole(Number(params.id), currentUserId);
    }, { permission: 'roles.delete' })

    // Single role by ID (with is_system, permissionCount, userCount)
    .get('/roles/:id', async ({ params }) => {
        return await getRoleById(Number(params.id));
    }, { permission: 'roles.read' })

    .get('/roles/:id/permissions', async ({ params }) => {
        return await getRolePermissions(Number(params.id));
    }, { permission: 'roles.read' })

    .put('/roles/:id/permissions', async ({ params, body, currentUserId }) => {
        return await updateRolePermissions(Number(params.id), body.permissionIds, currentUserId);
    }, {
        permission: 'permissions.update',
        body: t.Object({
            permissionIds: t.Array(t.Number()),
        }),
    })

    // Role users (NEW)
    .get('/roles/:id/users', async ({ params }) => {
        return await getUsersByRole(Number(params.id));
    }, { permission: 'roles.read' })

    .delete('/roles/:id/users/:userId', async ({ params }) => {
        return await removeUserFromRole(Number(params.userId), Number(params.id));
    }, { permission: 'roles.update' })

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
        query: t.Object({
            search: t.Optional(t.String()),
            isActive: t.Optional(t.String()),
            roles: t.Optional(t.String()),
        }),
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
        query: t.Object({
            search: t.Optional(t.String()),
            page: t.Optional(t.Numeric()),
            limit: t.Optional(t.Numeric()),
            sortBy: t.Optional(t.String()),
            sortOrder: t.Optional(t.String()),
            isActive: t.Optional(t.String()),
            roles: t.Optional(t.String()),
        }),
    })

    // Single user by ID
    .get('/users/:id', async ({ params, currentCompanyId }) => {
        return await getUserById(Number(params.id), currentCompanyId);
    }, { permission: 'users.read' })

    .post('/users', async ({ body, currentUserId, currentCompanyId }) => {
        return await createUser(body, currentUserId, currentCompanyId);
    }, {
        permission: 'users.create',
        body: t.Object({
            username: t.String({ minLength: 2 }),
            email: t.String({ format: 'email' }),
            password: t.String({ minLength: 8 }),
            roleIds: t.Optional(t.Array(t.Number())),
        }),
    })

    .put('/users/:id', async ({ params, body, currentUserId }) => {
        return await updateUser(Number(params.id), body, currentUserId);
    }, {
        permission: 'users.update',
        body: t.Object({
            username: t.Optional(t.String({ minLength: 2 })),
            email: t.Optional(t.String({ format: 'email' })),
            isActive: t.Optional(t.Boolean()),
        }),
    })

    // Soft-delete (deactivate) — preserves roles
    .patch('/users/:id/deactivate', async ({ params, currentUserId }) => {
        return await deactivateUser(Number(params.id), currentUserId);
    }, {
        permission: 'users.delete',
        response: t.Object({ success: t.Boolean() }),
    })

    // Hard-delete (destroy) — permanently removes user
    .delete('/users/:id', async ({ params, currentUserId }) => {
        return await hardDeleteUser(Number(params.id), currentUserId);
    }, {
        permission: 'users.destroy',
        response: t.Object({ success: t.Boolean() }),
    })

    // Restore a deactivated user
    .patch('/users/:id/restore', async ({ params, currentUserId }) => {
        return await restoreUser(Number(params.id), currentUserId);
    }, {
        permission: 'users.restore',
        response: t.Object({ success: t.Boolean() }),
    })

    // Pre-flight hard-delete reference check
    .get('/users/:id/can-delete', async ({ params }) => {
        return await checkUserReferences(Number(params.id));
    }, {
        permission: 'users.destroy',
        response: t.Object({
            roles: t.Number(),
            activeSessions: t.Number(),
            total: t.Number(),
            canDelete: t.Boolean(),
        }),
    })

    .get('/users/:id/roles', async ({ params }) => {
        return await getUserRolesById(Number(params.id));
    }, { permission: 'users.read' })

    .put('/users/:id/roles', async ({ params, body, currentUserId }) => {
        return await assignUserRoles(Number(params.id), body.roleIds, currentUserId);
    }, {
        permission: 'users.update',
        body: t.Object({
            roleIds: t.Array(t.Number()),
        }),
    })

    // =========================================================================
    // User Sessions, Audit, Password Reset, Entity
    // =========================================================================

    // Admin: view sessions for a specific user
    .get('/users/:id/sessions', async ({ params, currentSessionId }) => {
        return await getActiveSessions(Number(params.id), currentSessionId);
    }, {
        permission: 'users.read',
        response: t.Array(t.Object({
            id: t.String(),
            user_agent: t.Union([t.String(), t.Null()]),
            ip_address: t.Union([t.String(), t.Null()]),
            location: t.Union([t.String(), t.Null()]),
            created_at: t.Date(),
            is_current: t.Boolean(),
        })),
    })

    // Admin: revoke a specific session for a user
    .delete('/users/:id/sessions/:sessionId', async ({ params }) => {
        return await revokeSession(params.sessionId, Number(params.id));
    }, {
        permission: 'users.update',
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
        query: t.Object({
            page: t.Optional(t.Numeric()),
            limit: t.Optional(t.Numeric()),
        }),
        response: t.Object({
            data: t.Array(t.Object({
                id: t.String(),
                tableName: t.String(),
                recordId: t.String(),
                action: t.String(),
                oldData: t.Any(),
                newData: t.Any(),
                ipAddress: t.Union([t.String(), t.Null()]),
                createdAt: t.Date(),
                userId: t.Union([t.Number(), t.Null()]),
                performedByUsername: t.Union([t.String(), t.Null()]),
            })),
            meta: t.Object({
                total: t.Number(),
                page: t.Number(),
                pageCount: t.Number(),
                hasNextPage: t.Boolean(),
                hasPrevPage: t.Boolean(),
            }),
        }),
    })

    // Admin password reset (no current password required)
    .post('/users/:id/reset-password', async ({ params, body, currentUserId }) => {
        return await adminResetPassword(currentUserId, Number(params.id), body.newPassword);
    }, {
        permission: 'users.update',
        body: t.Object({
            newPassword: t.String({ minLength: 8 }),
        }),
        response: t.Object({ success: t.Boolean() }),
    })

    // Assign/unassign entity to user
    .patch('/users/:id/entity', async ({ params, body, currentUserId }) => {
        return await setUserEntity(Number(params.id), body.entityId, currentUserId);
    }, {
        permission: 'users.update',
        body: t.Object({
            entityId: t.Union([t.Number(), t.Null()]),
        }),
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
        body: t.Object({
            ids: t.Array(t.Number()),
        }),
        response: t.Array(t.Object({
            userId: t.Number(),
            success: t.Boolean(),
            error: t.Optional(t.String()),
        })),
    })

    // Bulk restore
    .patch('/users/bulk/restore', async ({ body, currentUserId }) => {
        return await batchRestoreUsers(body.ids, currentUserId);
    }, {
        permission: 'users.restore',
        body: t.Object({
            ids: t.Array(t.Number()),
        }),
        response: t.Array(t.Object({
            userId: t.Number(),
            success: t.Boolean(),
            error: t.Optional(t.String()),
        })),
    })



