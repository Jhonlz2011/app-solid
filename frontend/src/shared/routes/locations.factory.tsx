import { createRoute, lazyRouteComponent, redirect, useNavigate } from '@tanstack/solid-router';

// --- Lazy Loaders ---
const LazyLocationShowRoute = lazyRouteComponent(() => import('@modules/locations/components/LocationShowPanel'));
const LazyLocationEditRoute = lazyRouteComponent(() => import('@modules/locations/components/LocationEditSheet'));
const LazyLocationNewRoute = lazyRouteComponent(() => import('@modules/locations/components/LocationNewSheet'));

/**
 * Creates deep nested modal routes for Locations.
 * Pattern: /locations/new, /locations/$locationId/show, /locations/$locationId/edit
 * Also supports nested overlays like /locations/new/$locationId/show
 */
export const createLocationModals = (parentRoute: any, basePath = '', fallbackRedirect: any = { to: '/locations' }) => {
    const prefix = basePath ? `${basePath}/` : '';

    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}new`,
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canAdd('locations')) {
                throw redirect(fallbackRedirect);
            }
        },
        component: LazyLocationNewRoute,
    });

    const newShowRoute = createRoute({
        getParentRoute: () => newRoute,
        path: `$locationId/show`,
        component: function NestedShowWrapper() {
            const navigate = useNavigate();
            return (
                <LazyLocationShowRoute 
                    onBack={() => {
                        const path = window.location.pathname;
                        const marker = '/new';
                        const index = path.lastIndexOf(marker);
                        if (index !== -1) {
                            navigate({ to: path.substring(0, index + marker.length), search: true });
                        } else {
                            navigate({ to: '..', search: true });
                        }
                    }} 
                />
            );
        }
    });

    const newNestedEditRoute = createRoute({
        getParentRoute: () => newShowRoute,
        path: `edit`,
        component: function NestedEditWrapper() {
            const navigate = useNavigate();
            return <LazyLocationEditRoute onBack={() => navigate({ to: '..', search: true })} />;
        }
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
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canEdit('locations')) {
                throw redirect(fallbackRedirect);
            }
        },
        component: LazyLocationEditRoute,
    });

    const nestedEditRoute = createRoute({
        getParentRoute: () => showRoute,
        path: `edit`,
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canEdit('locations')) {
                throw redirect(fallbackRedirect);
            }
        },
        component: function NestedEditWrapper() {
            const navigate = useNavigate();
            return <LazyLocationEditRoute onBack={() => navigate({ to: '..', search: true })} />;
        }
    });

    return [
        newRoute.addChildren([
            newShowRoute.addChildren([newNestedEditRoute])
        ]),
        baseRoute.addChildren([
            indexRoute,
            showRoute.addChildren([nestedEditRoute]),
            editRoute
        ])
    ];
};
