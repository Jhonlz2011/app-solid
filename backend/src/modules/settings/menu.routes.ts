import { Elysia, t } from 'elysia';
import { authGuard } from '../../plugins/auth-guard';
import { ForbiddenError } from '../../core/errors';
import { getAllowedModules } from '../users';
import { SYSTEM_ROLES } from '@app/schema/enums';
import {
    getMenuForUser,
    getFullMenuTree,
    getAllMenuItems,
    updateMenuItem,
    reorderMenuItems
} from './menu.service';
import { MenuItemUpdateSchema, MenuItemReorderSchema, IdParamSchema } from '@app/schema/backend';

function assertAdmin(roles?: string[]) {
    if (!roles?.includes(SYSTEM_ROLES.SUPERADMIN)) {
        throw new ForbiddenError('Acceso denegado: se requiere rol de administrador');
    }
}

export const modulesRoutes = new Elysia({ prefix: '/modules' })
    .use(authGuard)
    /**
     * Get allowed modules for current user
     * Returns array of module keys the user can access
     */
    .get('/', async ({ currentUserId }) => {
        return getAllowedModules(currentUserId);
    })
    /**
     * Get full menu tree for current user (filtered by permissions)
     */
    .get('/tree', async ({ currentUserId }) => {
        return getMenuForUser(currentUserId);
    })
    /**
     * Get current user's permissions
     */
    .get('/permissions', ({ currentRoles, currentPermissions }) => {
        if (currentRoles?.includes(SYSTEM_ROLES.SUPERADMIN)) {
            return ['*'];
        }
        return currentPermissions || [];
    })
    /**
     * Get current user's roles
     */
    .get('/roles', ({ currentRoles }) => {
        return { roles: currentRoles || [] };
    })
    /**
     * Check if user has specific permission
     */
    .get(
        '/check/:permission',
        ({ currentRoles, currentPermissions, params }) => {
            if (currentRoles?.includes(SYSTEM_ROLES.SUPERADMIN)) {
                return { hasPermission: true, permission: params.permission };
            }
            const hasPermission = (currentPermissions || []).includes(params.permission);
            return { hasPermission, permission: params.permission };
        },
        {
            params: t.Object({ permission: t.String() }),
        }
    )
    // ============================================
    // MENU MANAGEMENT ENDPOINTS (Admin only)
    // ============================================
    /**
     * Get full menu tree (admin only, no filtering)
     */
    .get('/tree-full', async ({ currentRoles }) => {
        assertAdmin(currentRoles);
        return getFullMenuTree();
    })
    /**
     * Get all menu items as flat list (admin only)
     */
    .get('/items', async ({ currentRoles }) => {
        assertAdmin(currentRoles);
        return getAllMenuItems();
    })
    /**
     * Update a menu item (admin only)
     */
    .put(
        '/:id',
        async ({ currentRoles, params, body }) => {
            assertAdmin(currentRoles);
            const [updated] = await updateMenuItem(Number(params.id), body);
            return updated;
        },
        {
            params: IdParamSchema,
            body: MenuItemUpdateSchema,
        }
    )
    /**
     * Reorder menu items (admin only)
     */
    .put(
        '/reorder',
        async ({ currentRoles, body }) => {
            assertAdmin(currentRoles);
            const results = await reorderMenuItems(body.items);
            return { updated: results.length };
        },
        {
            body: MenuItemReorderSchema,
        }
    );
