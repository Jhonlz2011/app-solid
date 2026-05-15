import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import GlobalPageLoader from '@shared/ui/GlobalPageLoader';
import { createBrandModals } from '@shared/routes/brands.factory';
import { brandsApi } from './data/brands.api';
import { brandKeys } from './data/brands.keys';

const BrandsPage = lazyRouteComponent(() => import('./views/BrandsPage'));

export const createBrandsRoutes = (layoutRoute: any) => {
    const brandsRoute = createRoute({
        getParentRoute: () => layoutRoute,
        path: 'brands',
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canRead('brands')) {
                throw redirect({ to: '/dashboard' });
            }
        },
        loader: async () => {
            const defaultFilters = { limit: 10, direction: 'first' as const };
            return await queryClient.prefetchQuery({
                queryKey: brandKeys.list(defaultFilters),
                queryFn: () => brandsApi.list(defaultFilters),
                staleTime: 60 * 1000,
            });
        },
        pendingComponent: GlobalPageLoader,
        component: BrandsPage,
    });

    brandsRoute.addChildren([
        ...createBrandModals(brandsRoute),
    ]);

    return brandsRoute;
};
