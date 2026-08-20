import { Elysia } from 'elysia';
import { authGuard } from '../../plugins/auth-guard';
import { ForbiddenError } from '../../core/errors';
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
     * Get full menu tree for current user (filtered by permissions)
     */
    .get('/tree', async ({ currentUserId, currentCompanyId }) => {
        return getMenuForUser(currentUserId, currentCompanyId);
    })
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
    )
    /**
     * Invalidate menu cache (admin only) — fuerza recarga desde DB en el próximo request
     */
    .post('/refresh-cache', async ({ currentRoles }) => {
        assertAdmin(currentRoles);
        const { cacheService } = await import('../../core/cache');
        await cacheService.invalidate('menus:*');
        return { success: true, message: 'Caché de menús invalidado. Se recargará en el próximo request.' };
    });

