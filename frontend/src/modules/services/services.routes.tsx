import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import GlobalPageLoader from '@shared/ui/GlobalPageLoader';
import { createServiceModals } from '@shared/routes/services.factory';
import { productsApi, productKeys } from '@modules/products/data/products.api';

// --- LAZY PAGE ---
const ServicesPage = lazyRouteComponent(() => import('./views/ServicesPage'));

// ─── Route factory ──────────────────────────────────────────────────────────
export const createServicesRoutes = (layoutRoute: any) => {
    const servicesRoute = createRoute({
        getParentRoute: () => layoutRoute,
        path: 'services',
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canRead('services')) {
                throw redirect({ to: '/dashboard' });
            }
        },
        loader: async () => {
            const defaultFilters = { limit: 10, direction: 'first' as const, productType: ['SERVICIO'] };
            return await queryClient.prefetchQuery({
                queryKey: productKeys.list(defaultFilters),
                queryFn: () => productsApi.list(defaultFilters),
                staleTime: 60 * 1000,
            });
        },
        pendingComponent: GlobalPageLoader,
        component: ServicesPage,
    });

    servicesRoute.addChildren([
        ...createServiceModals(servicesRoute),
    ]);

    return servicesRoute;
};
