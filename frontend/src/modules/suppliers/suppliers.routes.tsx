import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import { createSupplierModals } from '@shared/routes/suppliers.factory';
import { createUserModals } from '@shared/routes/users.factory';
import { suppliersApi } from './data/suppliers.api';
import { supplierKeys } from './data/suppliers.keys';

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
        loader: () => {
            const defaultFilters = { limit: 10, direction: 'first' as const };
            queryClient.prefetchQuery({
                queryKey: supplierKeys.list(defaultFilters),
                queryFn: () => suppliersApi.list(defaultFilters),
                staleTime: 60 * 1000,
            });
        },
        component: SuppliersPage,
    });

    return suppliersRoute.addChildren([
        ...createSupplierModals(suppliersRoute),
        ...createUserModals(suppliersRoute, 'user'),
    ]);
};
