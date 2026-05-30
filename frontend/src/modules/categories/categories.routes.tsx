import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import GlobalPageLoader from '@shared/ui/GlobalPageLoader';
import { categoriesApi } from './data/categories.api';
import { categorieKeys } from './data/categories.keys';
import { createCategoryModals } from '@/shared/routes/categories.factory';

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
                queryKey: categorieKeys.categoriesFlat(),
                queryFn: () => categoriesApi.listCategories(true),
                staleTime: 60 * 1000,
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
