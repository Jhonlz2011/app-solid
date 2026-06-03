import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import GlobalPageLoader from '@shared/ui/GlobalPageLoader';

// Data layer imports
import { warehousesApi } from './data/warehouses.api';
import { warehouseKeys } from './data/warehouses.keys';

// Lazy-loaded views
const SettingsPage = lazyRouteComponent(() => import('./views/SettingsPage'));

const WarehouseList = lazyRouteComponent(() => import('./components/warehouses/WarehouseList'));

export const createSettingsRoutes = (layoutRoute: any) => {
    // ── Parent layout route with sidebar ──
    const settingsRoute = createRoute({
        getParentRoute: () => layoutRoute,
        path: 'settings',
        pendingComponent: GlobalPageLoader,
        component: SettingsPage,
        beforeLoad: async ({ location }) => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canRead('inventory')) {
                throw redirect({ to: '/dashboard' });
            }
            // Redirect bare /settings to /settings/warehouses
            if (location.pathname === '/settings' || location.pathname === '/settings/') {
                throw redirect({ to: '/settings/warehouses' });
            }
        },
    });

    // Redirect /settings/attributes → /attributes (standalone module)
    const attributesRedirectRoute = createRoute({
        getParentRoute: () => settingsRoute,
        path: 'attributes',
        beforeLoad: () => { throw redirect({ to: '/attributes' }); },
    });

    // ── Warehouses ──
    const warehousesRoute = createRoute({
        getParentRoute: () => settingsRoute,
        path: 'warehouses',
        loader: async () => {
            await queryClient.prefetchQuery({
                queryKey: warehouseKeys.warehouses,
                queryFn: () => warehousesApi.list(),
                staleTime: 1000 * 60 * 30,
            });
        },
        component: WarehouseList,
    });

    // Warehouse modals (new, edit) + locations sub-route
    const warehouseBaseRoute = createRoute({
        getParentRoute: () => warehousesRoute,
        path: '$warehouseId',
    });

    const warehouseEditRoute = createRoute({
        getParentRoute: () => warehouseBaseRoute,
        path: 'edit',
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canEdit('inventory')) {
                throw redirect({ to: '/settings/warehouses' });
            }
        },
        component: lazyRouteComponent(() => import('./components/warehouses/WarehouseEditSheet')),
    });

    const warehouseLocationsRoute = createRoute({
        getParentRoute: () => warehouseBaseRoute,
        path: 'locations',
        beforeLoad: ({ params }) => {
            throw redirect({
                to: '/locations',
                search: { warehouseId: Number(params.warehouseId) },
            });
        },
    });

    const warehouseNewRoute = createRoute({
        getParentRoute: () => warehousesRoute,
        path: 'new',
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canAdd('inventory')) {
                throw redirect({ to: '/settings/warehouses' });
            }
        },
        component: lazyRouteComponent(() => import('./components/warehouses/WarehouseNewSheet')),
    });

    warehousesRoute.addChildren([
        warehouseNewRoute,
        warehouseBaseRoute.addChildren([
            warehouseEditRoute,
            warehouseLocationsRoute,
        ]),
    ]);

    // ── Return single parent with children ──
    return settingsRoute.addChildren([
        attributesRedirectRoute,
        warehousesRoute,
    ]);
};
