import { createRoute, lazyRouteComponent, redirect } from '@tanstack/solid-router';

const LazyUomNewRoute = lazyRouteComponent(() => import('@modules/uom/components/UomNewSheet'));
const LazyUomEditRoute = lazyRouteComponent(() => import('@modules/uom/components/UomEditSheet'));

/**
 * Creates deep nested modal routes for UOM.
 */
export const createUomModals = (parentRoute: any, basePath = '', fallbackRedirect: any = { to: '/uom' }) => {
    const prefix = basePath ? `${basePath}/` : '';

    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}new`,
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canAdd('uom')) {
                throw redirect(fallbackRedirect);
            }
        },
        component: LazyUomNewRoute,
    });

    const baseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}$uomId`,
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
            if (!useAuth().canEdit('uom')) {
                throw redirect(fallbackRedirect);
            }
        },
        component: LazyUomEditRoute,
    });

    return [
        newRoute,
        baseRoute.addChildren([
            indexRoute,
            editRoute,
        ])
    ];
};
