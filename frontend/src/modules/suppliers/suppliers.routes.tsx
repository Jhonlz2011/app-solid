import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import GlobalPageLoader from '@shared/ui/GlobalPageLoader';
import { createSupplierModals } from '@shared/routes/suppliers.factory';
import { createUserModals } from '@shared/routes/users.factory';

// --- LAZY PAGE ---
const SuppliersPage = lazyRouteComponent(() => import('./views/SuppliersPage'));

// ─── Route factory ──────────────────────────────────────────────────────────
export const createSuppliersRoutes = (layoutRoute: any) => {
    const suppliersRoute = createRoute({
        getParentRoute: () => layoutRoute,
        path: 'suppliers',
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canRead('suppliers')) {
                throw redirect({ to: '/dashboard' });
            }
        },
        loader: async () => {
            // Parallel Fetching: Block route transition until data is pre-fetched
            const { suppliersApi, supplierKeys } = await import('./data/suppliers.api');
            const defaultFilters = { limit: 10, direction: 'first' as const };

            return await queryClient.prefetchQuery({
                queryKey: supplierKeys.list(defaultFilters),
                queryFn: () => suppliersApi.list(defaultFilters),
                staleTime: 60 * 1000,
            });
        },
        pendingComponent: GlobalPageLoader,
        component: SuppliersPage,
    });

    suppliersRoute.addChildren([
        ...createSupplierModals(suppliersRoute),
        ...createUserModals(suppliersRoute, 'user', '/suppliers')
    ]);

    return suppliersRoute;
};
