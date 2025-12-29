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
    deleteUser,
} from '../services/rbac.service';

export const rbacRoutes = new Elysia({ prefix: '/rbac' })
    .use(authGuard)
    .use(rbac)
    // Roles CRUD
    .get('/roles', async () => {
        return await getAllRoles();
    }, { permission: 'roles.read' })

    .post('/roles', async ({ body }) => {
        return await createRole(body.name, body.description);
    }, {
        permission: 'roles.add',
        body: t.Object({
            name: t.String({ minLength: 2 }),
            description: t.Optional(t.String()),
        }),
    })

    .put('/roles/:id', async ({ params, body }) => {
        return await updateRole(Number(params.id), body.name, body.description);
    }, {
        permission: 'roles.edit',
        body: t.Object({
            name: t.String({ minLength: 2 }),
            description: t.Optional(t.String()),
        }),
    })

    .delete('/roles/:id', async ({ params }) => {
        return await deleteRole(Number(params.id));
    }, { permission: 'roles.delete' })

    // Role permissions
    .get('/roles/:id/permissions', async ({ params }) => {
        return await getRolePermissions(Number(params.id));
    }, { permission: 'roles.read' })

    .put('/roles/:id/permissions', async ({ params, body }) => {
        return await updateRolePermissions(Number(params.id), body.permissionIds);
    }, {
        permission: 'permissions.edit',
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
    }, { permission: 'roles.edit' })

    // Permissions (read-only)
    .get('/permissions', async () => {
        return await getAllPermissions();
    }, { permission: 'permissions.read' })

    // Users with roles
    .get('/users', async () => {
        return await getAllUsersWithRoles();
    }, { permission: 'users.read' })

    .post('/users', async ({ body }) => {
        return await createUser(body);
    }, {
        permission: 'users.add',
        body: t.Object({
            username: t.String({ minLength: 2 }),
            email: t.String({ format: 'email' }),
            password: t.String({ minLength: 8 }),
            roleIds: t.Optional(t.Array(t.Number())),
        }),
    })

    .put('/users/:id', async ({ params, body }) => {
        return await updateUser(Number(params.id), body);
    }, {
        permission: 'users.edit',
        body: t.Object({
            username: t.Optional(t.String({ minLength: 2 })),
            email: t.Optional(t.String({ format: 'email' })),
            isActive: t.Optional(t.Boolean()),
        }),
    })

    .delete('/users/:id', async ({ params }) => {
        return await deleteUser(Number(params.id));
    }, { permission: 'users.delete' })

    .get('/users/:id/roles', async ({ params }) => {
        return await getUserRolesById(Number(params.id));
    }, { permission: 'users.read' })

    .put('/users/:id/roles', async ({ params, body }) => {
        return await assignUserRoles(Number(params.id), body.roleIds);
    }, {
        permission: 'users.edit',
        body: t.Object({
            roleIds: t.Array(t.Number()),
        }),
    });
