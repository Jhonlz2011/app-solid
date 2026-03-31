import { createRoute, lazyRouteComponent, redirect, useNavigate } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import { clientKeys, clientsApi } from '@modules/clients/data/clients.api';

// Lazy loading the Panels as Route Components
const LazyClientShowRoute = lazyRouteComponent(() => import('@modules/clients/components/ClientShowPanel'));
const LazyClientEditRoute = lazyRouteComponent(() => import('@modules/clients/components/ClientEditSheet'));
const LazyClientNewRoute = lazyRouteComponent(() => import('@modules/clients/components/ClientNewSheet'));

/**
 * Creates the modal routes for the Clients module to be injected via Deep Nesting.
 */
export const createClientsModals = (parentRoute: any, basePath = '', fallbackRedirect = '/clients') => {
    
    const prefix = basePath ? `${basePath}/` : '';

    // --- CREATE / NEW ---
    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}new`,
        component: LazyClientNewRoute,
    });

    // --- BASE LAYOUT WRAPPER (/$clientId) ---
    const baseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}$clientId`,
    });

    // --- INVISIBLE BOUNCE-BACK NODE (/$clientId -> /clients) ---
    const indexRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `/`,
        beforeLoad: () => { throw redirect({ to: fallbackRedirect }); }
    });

    // --- SHOW (/$clientId/show) ---
    const showRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `show`,
        loader: async ({ params }) => {
            const id = Number(params.clientId);
            if (isNaN(id)) return;

            return await queryClient.prefetchQuery({
                queryKey: clientKeys.detail(id),
                queryFn: () => clientsApi.get(id),
                staleTime: 1000 * 30, 
            });
        },
        component: LazyClientShowRoute,
    });

    // --- EDIT SIBLING (/$clientId/edit) (FROM TABLE) ---
    const editRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `edit`,
        loader: async ({ params }) => {
            const id = Number(params.clientId);
            await queryClient.prefetchQuery({ queryKey: clientKeys.detail(id), queryFn: () => clientsApi.get(id), staleTime: 1000 * 30 });
            return;
        },
        component: LazyClientEditRoute,
    });

    const nestedEditRoute = createRoute({
        getParentRoute: () => showRoute,
        path: `edit`,
        component: function NestedEditWrapper() {
            const navigate = useNavigate();
            return <LazyClientEditRoute onBack={() => navigate({ to: '..', search: true })} />;
        }
    });

    // Return the array of configured routes
    return [
        newRoute,
        baseRoute.addChildren([
            indexRoute,
            showRoute.addChildren([nestedEditRoute]), // Child behavior
            editRoute // Sibling behavior
        ])
    ];
};
