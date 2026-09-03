import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import { createClientsModals } from '@shared/routes/clients.factory';
import { createUserModals } from '@shared/routes/users.factory';
import { clientsApi } from './data/clients.api';
import { clientKeys } from './data/clients.keys';

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
        loader: () => {
            const defaultFilters = { limit: 10, direction: 'first' as const };
            queryClient.prefetchQuery({
                queryKey: clientKeys.list(defaultFilters),
                queryFn: () => clientsApi.list(defaultFilters),
                staleTime: 60 * 1000,
            });
        },
        component: ClientsPage,
    });

    return clientsRoute.addChildren([
        ...createClientsModals(clientsRoute),
        ...createUserModals(clientsRoute, 'user'),
    ]);
};