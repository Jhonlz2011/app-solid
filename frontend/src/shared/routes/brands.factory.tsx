import { createRoute, lazyRouteComponent, redirect } from '@tanstack/solid-router';

const LazyBrandNewRoute = lazyRouteComponent(() => import('@modules/brands/components/BrandNewSheet'));
const LazyBrandEditRoute = lazyRouteComponent(() => import('@modules/brands/components/BrandEditSheet'));

/**
 * Creates deep nested modal routes for Brands.
 */
export const createBrandModals = (parentRoute: any, basePath = '', fallbackRedirect: any = { to: '/brands' }) => {
    const prefix = basePath ? `${basePath}/` : '';

    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}new`,
        component: LazyBrandNewRoute,
    });

    const baseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}$brandId`,
    });

    const indexRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `/`,
        beforeLoad: () => { throw redirect(fallbackRedirect); }
    });

    const editRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `edit`,
        component: LazyBrandEditRoute,
    });

    return [
        newRoute,
        baseRoute.addChildren([
            indexRoute,
            editRoute,
        ])
    ];
};
