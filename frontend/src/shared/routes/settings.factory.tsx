import { createRoute, lazyRouteComponent, redirect } from '@tanstack/solid-router';

// --- Lazy Loaders for Families ---
const LazyFamilyNewRoute = lazyRouteComponent(() => import('@modules/settings/components/families/FamilyNewSheet'));
const LazyFamilyEditRoute = lazyRouteComponent(() => import('@modules/settings/components/families/FamilyEditSheet'));

/**
 * Creates deep nested modal routes for Families.
 */
export const createFamilyModals = (parentRoute: any, basePath = '', fallbackRedirect: any = { to: '/settings/families' }) => {
    const prefix = basePath ? `${basePath}/` : '';

    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}new`,
        component: LazyFamilyNewRoute,
    });

    const baseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}$familyId`,
    });

    const indexRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `/`,
        beforeLoad: () => { throw redirect(fallbackRedirect); }
    });

    const editRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `edit`,
        component: LazyFamilyEditRoute,
    });

    return [
        newRoute,
        baseRoute.addChildren([
            indexRoute,
            editRoute,
        ])
    ];
};

// --- Lazy Loaders for Warehouses ---
const LazyWarehouseNewRoute = lazyRouteComponent(() => import('@modules/settings/components/warehouses/WarehouseNewSheet'));
const LazyWarehouseEditRoute = lazyRouteComponent(() => import('@modules/settings/components/warehouses/WarehouseEditSheet'));

// --- Lazy Loaders for Locations ---
const LazyLocationNewRoute = lazyRouteComponent(() => import('@modules/settings/components/locations/LocationNewSheet'));
const LazyLocationEditRoute = lazyRouteComponent(() => import('@modules/settings/components/locations/LocationEditSheet'));

/**
 * Creates deep nested modal routes for Warehouses.
 */
export const createWarehouseModals = (parentRoute: any) => {
    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'new',
        component: LazyWarehouseNewRoute,
    });

    const baseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: '$warehouseId',
    });

    const indexRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `/`,
        beforeLoad: () => { throw redirect({ to: '/settings/warehouses' }); }
    });

    const editRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: 'edit',
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

/**
 * Creates deep nested modal routes for Locations inside a warehouse.
 */
export const createLocationModals = (parentRoute: any) => {
    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: 'new',
        component: LazyLocationNewRoute,
    });

    const baseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: '$locationId',
    });

    const editRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: 'edit',
        component: LazyLocationEditRoute,
    });

    return [
        newRoute,
        baseRoute.addChildren([editRoute])
    ];
};
