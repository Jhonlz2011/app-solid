import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import GlobalPageLoader from '@shared/ui/GlobalPageLoader';

// Data layer imports
import { familiesApi } from './data/families.api';
import { familyKeys } from './data/families.keys';
import { warehousesApi } from './data/warehouses.api';
import { warehouseKeys } from './data/warehouses.keys';

// Route factories
import { createFamilyModals, createWarehouseModals, createLocationModals } from '@shared/routes/settings.factory';

// Lazy-loaded views
const SettingsPage = lazyRouteComponent(() => import('./views/SettingsPage'));
const FamilyList = lazyRouteComponent(() => import('./components/families/FamilyList'));

const WarehouseList = lazyRouteComponent(() => import('./components/warehouses/WarehouseList'));
const LocationList = lazyRouteComponent(() => import('./components/locations/LocationList'));

export const createSettingsRoutes = (layoutRoute: any) => {
    // ── Parent layout route with sidebar ──
    const settingsRoute = createRoute({
        getParentRoute: () => layoutRoute,
        path: 'settings',
        pendingComponent: GlobalPageLoader,
        component: SettingsPage,
        beforeLoad: ({ location }) => {
            // Redirect bare /settings to /settings/families
            if (location.pathname === '/settings' || location.pathname === '/settings/') {
                throw redirect({ to: '/settings/families' });
            }
        },
    });

    const familiesRoute = createRoute({
        getParentRoute: () => settingsRoute,
        path: 'families',
        loader: async () => {
            await queryClient.prefetchQuery({
                queryKey: familyKeys.all,
                queryFn: () => familiesApi.list(),
                staleTime: 1000 * 60 * 30,
            });
        },
        component: FamilyList,
    });

    // Add family modals as children
    familiesRoute.addChildren([
        ...createFamilyModals(familiesRoute),
    ]);

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
        component: lazyRouteComponent(() => import('./components/warehouses/WarehouseEditSheet')),
    });

    const warehouseLocationsRoute = createRoute({
        getParentRoute: () => warehouseBaseRoute,
        path: 'locations',
        component: LocationList,
    });

    // Location modals within warehouse
    warehouseLocationsRoute.addChildren([
        ...createLocationModals(warehouseLocationsRoute),
    ]);

    const warehouseNewRoute = createRoute({
        getParentRoute: () => warehousesRoute,
        path: 'new',
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
        familiesRoute,
        attributesRedirectRoute,
        warehousesRoute,
    ]);
};
