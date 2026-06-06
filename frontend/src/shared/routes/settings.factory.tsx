import { createRoute, lazyRouteComponent, redirect } from '@tanstack/solid-router';

const LazyWarehouseNewRoute = lazyRouteComponent(() => import('@modules/settings/components/warehouses/WarehouseNewSheet'));
const LazyWarehouseEditRoute = lazyRouteComponent(() => import('@modules/settings/components/warehouses/WarehouseEditSheet'));

/**
 * Creates deep nested modal routes for Warehouses.
 */
export const createWarehouseModals = (parentRoute: any, basePath = '', fallbackRedirect: any = { to: '/settings/warehouses' }) => {
    const prefix = basePath ? `${basePath}/` : '';

    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}new`,
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canAdd('inventory')) {
                throw redirect(fallbackRedirect);
            }
        },
        component: LazyWarehouseNewRoute,
    });

    const baseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}$warehouseId`,
    });

    const indexRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `/`,
        beforeLoad: () => { throw redirect(fallbackRedirect); }
    });

    const editRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `edit`,
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canEdit('inventory')) {
                throw redirect(fallbackRedirect);
            }
        },
        component: LazyWarehouseEditRoute,
    });

    return [
        newRoute,
        baseRoute.addChildren([
            indexRoute,
            editRoute,
        ])
    ];
};
