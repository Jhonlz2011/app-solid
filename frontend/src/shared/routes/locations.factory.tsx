import { createRoute, lazyRouteComponent, redirect, useNavigate } from '@tanstack/solid-router';

// --- Lazy Loaders ---
const LazyLocationShowRoute = lazyRouteComponent(() => import('@modules/locations/components/LocationShowPanel'));
const LazyLocationEditRoute = lazyRouteComponent(() => import('@modules/locations/components/LocationEditSheet'));
const LazyLocationNewRoute = lazyRouteComponent(() => import('@modules/locations/components/LocationNewSheet'));

/**
 * Creates deep nested modal routes for Locations.
 * Pattern: /locations/new, /locations/$locationId/show, /locations/$locationId/edit
 */
export const createLocationModals = (parentRoute: any, basePath = '', fallbackRedirect: any = { to: '/locations' }) => {
    const prefix = basePath ? `${basePath}/` : '';

    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}new`,
        component: LazyLocationNewRoute,
    });

    const baseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}$locationId`,
    });

    const indexRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `/`,
        beforeLoad: () => { throw redirect(fallbackRedirect); }
    });

    const showRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `show`,
        component: LazyLocationShowRoute,
    });

    const editRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `edit`,
        component: LazyLocationEditRoute,
    });

    const nestedEditRoute = createRoute({
        getParentRoute: () => showRoute,
        path: `edit`,
        component: function NestedEditWrapper() {
            const navigate = useNavigate();
            return <LazyLocationEditRoute onBack={() => navigate({ to: '..', search: true })} />;
        }
    });

    return [
        newRoute,
        baseRoute.addChildren([
            indexRoute,
            showRoute.addChildren([nestedEditRoute]),
            editRoute
        ])
    ];
};
