import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import GlobalPageLoader from '@shared/ui/GlobalPageLoader';
import { createClientsModals } from '@shared/routes/clients.factory';
import { createUserModals } from '@shared/routes/users.factory';

// --- LAZY PAGE ---
const ClientsPage = lazyRouteComponent(() => import('./views/ClientsPage'));

// ─── Route factory ──────────────────────────────────────────────────────────
export const createClientsRoutes = (layoutRoute: any) => {
    const clientsRoute = createRoute({
        getParentRoute: () => layoutRoute,
        path: 'clients',
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canRead('clients')) {
                throw redirect({ to: '/dashboard' });
            }
        },
        loader: async () => {
            // Parallel Fetching: Block route transition until data is pre-fetched
            const { clientsApi, clientKeys } = await import('./data/clients.api');
            const defaultFilters = { limit: 10, direction: 'first' as const };

            return await queryClient.prefetchQuery({
                queryKey: clientKeys.list(defaultFilters),
                queryFn: () => clientsApi.list(defaultFilters),
                staleTime: 60 * 1000,
            });
        },
        pendingComponent: GlobalPageLoader,
        component: ClientsPage,
    });

    clientsRoute.addChildren([
        ...createClientsModals(clientsRoute),
        ...createUserModals(clientsRoute, 'user', '/clients')
    ]);

    return clientsRoute;
};
