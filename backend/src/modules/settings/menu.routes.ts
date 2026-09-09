import { Elysia } from 'elysia';
import { tenantGuard } from '../../plugins/tenant-guard';
import { rbac } from '../../plugins/rbac';
import {
    getMenuForUser,
    getFullMenuTree,
    getTenantMenuItems,
    updateTenantMenuItem,
    reorderTenantMenuItems,
    resetTenantMenuToDefault,
} from './menu.service';
import { MenuItemUpdateBodySchema, MenuItemReorderBodySchema, IdParamSchema } from '@app/schema/backend';
import { DomainError } from '../../core/errors';

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
    .get('/tree-full', async ({ currentCompanyId }) => {
        return getFullMenuTree(currentCompanyId);
    }, {
        permission: 'menu.read',
    })
    /**
     * Get all menu items as flat list scoped to tenant
     */
    .get('/items', async ({ currentCompanyId }) => {
        return getTenantMenuItems(currentCompanyId);
    }, {
        permission: 'menu.read',
    })
    /**
     * Update a menu item
     */
    .put(
        '/:id',
        async ({ params, body, currentCompanyId }) => {
            const [updated] = await updateTenantMenuItem(Number(params.id), currentCompanyId, body);
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
        async ({ body, currentCompanyId }) => {
            const results = await reorderTenantMenuItems(currentCompanyId, body.items);
            return { updated: results.length };
        },
        {
            body: MenuItemReorderBodySchema,
            permission: 'menu.update',
        }
    )
    /**
     * Reset menu back to default template
     */
    .post(
        '/reset-defaults',
        async ({ currentCompanyId }) => {
            if (!currentCompanyId) {
                throw new DomainError('Empresa requerida para restaurar el menú.', 400);
            }
            await resetTenantMenuToDefault(currentCompanyId);
            return { success: true, message: 'Menú restaurado exitosamente a los valores por defecto.' };
        },
        {
            permission: 'menu.update',
        }
    )
    /**
     * Invalidate menu cache — forces DB reload on next request
     */
    .post('/refresh-cache', async ({ currentCompanyId }) => {
        const { cacheService } = await import('../../core/cache');
        await cacheService.invalidate('menus:*');
        await cacheService.invalidate('aliases:*');
        if (currentCompanyId) {
            await cacheService.invalidate(`menus:${currentCompanyId}`);
            await cacheService.invalidate(`aliases:${currentCompanyId}`);
        }
        return { success: true, message: 'Caché de menús invalidado. Se recargará en el próximo request.' };
    }, {
        permission: 'menu.update',
    });
