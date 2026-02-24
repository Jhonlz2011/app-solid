import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { getAllowedModules, getUserPermissions, getUserRoles } from '../services/rbac.service';
import { DomainError } from '../services/errors';
import {
    getMenuForUser,
    getFullMenuTree,
    getAllMenuItems,
    updateMenuItem,
    reorderMenuItems
} from '../services/menu.service';

// Shared admin check — replaces 4 inline duplications
async function requireAdmin(currentUserId: number) {
    const roles = await getUserRoles(currentUserId);
    if (!roles.includes('admin') && !roles.includes('superadmin')) {
        throw new DomainError('Acceso denegado: se requiere rol de administrador', 403);
    }
}

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
     * Get full menu tree for current user (filtered by permissions)
     */
    .get('/tree', async ({ currentUserId }) => {
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
    )
    // ============================================
    // MENU MANAGEMENT ENDPOINTS (Admin only)
    // ============================================
    /**
     * Get full menu tree (admin only, no filtering)
     */
    .get('/tree-full', async ({ currentUserId }) => {
        await requireAdmin(currentUserId);
        return getFullMenuTree();
    })
    /**
     * Get all menu items as flat list (admin only)
     */
    .get('/items', async ({ currentUserId }) => {
        await requireAdmin(currentUserId);
        return getAllMenuItems();
    })
    /**
     * Update a menu item (admin only)
     */
    .put(
        '/:id',
        async ({ currentUserId, params, body }) => {
            await requireAdmin(currentUserId);
            const [updated] = await updateMenuItem(parseInt(params.id), body);
            return updated;
        },
        {
            params: t.Object({ id: t.String() }),
            body: t.Object({
                label: t.Optional(t.String()),
                icon: t.Optional(t.String()),
                sort_order: t.Optional(t.Number()),
            }),
        }
    )
    /**
     * Reorder menu items (admin only)
     */
    .put(
        '/reorder',
        async ({ currentUserId, body }) => {
            await requireAdmin(currentUserId);
            const results = await reorderMenuItems(body.items);
            return { updated: results.length };
        },
        {
            body: t.Object({
                items: t.Array(t.Object({
                    id: t.Number(),
                    sort_order: t.Number(),
                })),
            }),
        }
    );

