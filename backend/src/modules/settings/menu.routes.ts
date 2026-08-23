import { Elysia } from 'elysia';
import { tenantGuard } from '../../plugins/tenant-guard';
import { rbac } from '../../plugins/rbac';
import {
    getMenuForUser,
    getFullMenuTree,
    getAllMenuItems,
    updateMenuItem,
    reorderMenuItems
} from './menu.service';
import { MenuItemUpdateBodySchema, MenuItemReorderBodySchema, IdParamSchema } from '@app/schema/backend';

export const modulesRoutes = new Elysia({ prefix: '/modules' })
    .use(tenantGuard)
    .use(rbac)
    /**
     * Get full menu tree for current user (filtered by user's assigned permissions)
     */
    .get('/tree', async ({ currentUserId, currentCompanyId }) => {
        return getMenuForUser(currentUserId, currentCompanyId);
    })
    // ============================================
    // MENU MANAGEMENT ENDPOINTS (RBAC-protected)
    // ============================================
    /**
     * Get full menu tree (admin / system management, no filtering)
     */
    .get('/tree-full', async () => {
        return getFullMenuTree();
    }, {
        permission: 'menu.read',
    })
    /**
     * Get all menu items as flat list
     */
    .get('/items', async () => {
        return getAllMenuItems();
    }, {
        permission: 'menu.read',
    })
    /**
     * Update a menu item
     */
    .put(
        '/:id',
        async ({ params, body }) => {
            const [updated] = await updateMenuItem(Number(params.id), body);
            return updated;
        },
        {
            params: IdParamSchema,
            body: MenuItemUpdateBodySchema,
            permission: 'menu.update',
        }
    )
    /**
     * Reorder menu items
     */
    .put(
        '/reorder',
        async ({ body }) => {
            const results = await reorderMenuItems(body.items);
            return { updated: results.length };
        },
        {
            body: MenuItemReorderBodySchema,
            permission: 'menu.update',
        }
    )
    /**
     * Invalidate menu cache — forces DB reload on next request
     */
    .post('/refresh-cache', async () => {
        const { cacheService } = await import('../../core/cache');
        await cacheService.invalidate('menus:*');
        return { success: true, message: 'Caché de menús invalidado. Se recargará en el próximo request.' };
    }, {
        permission: 'menu.update',
    });

