import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import GlobalPageLoader from '@shared/ui/GlobalPageLoader';
import { createProductModals } from '@shared/routes/products.factory';
import { productsApi, productKeys } from './data/products.api';

// --- LAZY PAGE ---
const ProductsPage = lazyRouteComponent(() => import('./views/ProductsPage'));

// ─── Route factory ──────────────────────────────────────────────────────────
export const createProductsRoutes = (layoutRoute: any) => {
    const productsRoute = createRoute({
        getParentRoute: () => layoutRoute,
        path: 'products',
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canRead('products')) {
                throw redirect({ to: '/dashboard' });
            }
        },
        loader: async () => {
            const defaultFilters = { limit: 10, direction: 'first' as const };
            return await queryClient.prefetchQuery({
                queryKey: productKeys.list(defaultFilters),
                queryFn: () => productsApi.list(defaultFilters),
                staleTime: 60 * 1000,
            });
        },
        pendingComponent: GlobalPageLoader,
        component: ProductsPage,
    });

    // Catalog modals are now nested INSIDE newRoute/editRoute via the factory.
    // No need to inject them as siblings here — they live inside products.factory.tsx.
    productsRoute.addChildren([
        ...createProductModals(productsRoute),
    ]);

    return productsRoute;
};
