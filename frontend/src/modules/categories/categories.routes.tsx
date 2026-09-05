import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import GlobalPageLoader from '@/shared/ui/display/GlobalPageLoader';
import { categoriesApi } from './data/categories.api';
import { categoryKeys } from './data/categories.keys';
import { createCategoryModals } from '@shared/routes/categories.factory';
import { STALE_TIME } from '@shared/constants/cache.constants';

const categoriesPage = lazyRouteComponent(() => import('./views/CategoryPage'));

export const createCategoriesRoutes = (layoutRoute: any) => {
    const categoriesRoute = createRoute({
        getParentRoute: () => layoutRoute,
        path: 'categories',
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canRead('categories')) {
                throw redirect({ to: '/dashboard' });
            }
        },
        loader: async () => {
            return await queryClient.prefetchQuery({
                queryKey: categoryKeys.categoriesFlat(),
                queryFn: () => categoriesApi.listCategories(true),
                staleTime: STALE_TIME.SHORT,
            });
        },
        pendingComponent: GlobalPageLoader,
        component: categoriesPage,
        notFoundComponent: () => null,
    });

    categoriesRoute.addChildren([
        ...createCategoryModals(categoriesRoute),
    ]);

    return categoriesRoute;
};
