import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { getAllowedModules, getUserPermissions, getUserRoles } from '../services/rbac.service';

export const modulesRoutes = new Elysia({ prefix: '/modules' })
    .use(authGuard)
    /**
     * Get allowed modules for current user
     * Returns array of module keys the user can access
     */
    .get('/', async ({ currentUserId }) => {
        const allowedModules = await getAllowedModules(currentUserId);
        return allowedModules;
    })
    /**
     * Get full menu tree for current user
     */
    .get('/tree', async ({ currentUserId }) => {
        const { getMenuForUser } = await import('../services/menu.service');
        return getMenuForUser(currentUserId);
    })
    /**
     * Get current user's permissions
     */
    .get('/permissions', async ({ currentUserId }) => {
        const roles = await getUserRoles(currentUserId);
        // Admin gets wildcard
        if (roles.includes('admin') || roles.includes('superadmin')) {
            return ['*'];
        }
        const permissions = await getUserPermissions(currentUserId);
        return permissions;
    })
    /**
     * Get current user's roles
     */
    .get('/roles', async ({ currentUserId }) => {
        const roles = await getUserRoles(currentUserId);
        return { roles };
    })
    /**
     * Check if user has specific permission
     */
    .get(
        '/check/:permission',
        async ({ currentUserId, params }) => {
            const permissions = await getUserPermissions(currentUserId);
            const hasPermission = permissions.includes(params.permission);
            return { hasPermission, permission: params.permission };
        },
        {
            params: t.Object({ permission: t.String() }),
        }
    );
