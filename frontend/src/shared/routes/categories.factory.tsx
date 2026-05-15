import { createRoute, lazyRouteComponent, redirect, useNavigate } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import { categorieKeys } from '@/modules/categories/data/categories.keys';
import { categoriesApi } from '@/modules/categories/data/categories.api';

// --- Lazy Loaders for Categories ---
const LazyCategoryShowRoute = lazyRouteComponent(() => import('@modules/categories/components/CategoryShowPanel'));
const LazyCategoryEditRoute = lazyRouteComponent(() => import('@modules/categories/components/CategoryEditSheet'));
const LazyCategoryNewRoute = lazyRouteComponent(() => import('@modules/categories/components/CategoryNewSheet'));

/**
 * Creates deep nested modal routes for Categories.
 */
export const createCategoryModals = (parentRoute: any, basePath = 'categories', fallbackRedirect: any = { to: '/categories' }) => {
    const prefix = basePath ? `${basePath}/` : '';

    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}new`,
        component: LazyCategoryNewRoute,
    });

    const baseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}$categoryId`,
    });

    const indexRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `/`,
        beforeLoad: () => { throw redirect(fallbackRedirect); }
    });

    const showRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `show`,
        loader: async ({ params }) => {
            const id = Number(params.categoryId);
            if (isNaN(id)) return;
            return await queryClient.prefetchQuery({
                queryKey: categorieKeys.categoryDetail(id),
                queryFn: () => categoriesApi.getCategory(id),
                staleTime: 1000 * 30,
            });
        },
        component: LazyCategoryShowRoute,
    });

    const editRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `edit`,
        loader: async ({ params }) => {
            const id = Number(params.categoryId);
            if (isNaN(id)) return;
            await queryClient.prefetchQuery({
                queryKey: categorieKeys.categoryDetail(id),
                queryFn: () => categoriesApi.getCategory(id),
                staleTime: 1000 * 30,
            });
            return;
        },
        component: LazyCategoryEditRoute,
    });

    const nestedEditRoute = createRoute({
        getParentRoute: () => showRoute,
        path: `edit`,
        component: function NestedEditWrapper() {
            const navigate = useNavigate();
            return <LazyCategoryEditRoute onBack={() => navigate({ to: '..', search: true })} />;
        }
    });

    return [
        newRoute,
        baseRoute.addChildren([
            indexRoute,
            showRoute.addChildren([nestedEditRoute]),
            editRoute
        ])
    ];
};
