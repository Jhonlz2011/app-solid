import { createRoute, lazyRouteComponent, redirect, useNavigate } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import { categorieKeys } from '@/modules/categories/data/categories.keys';
import { categoriesApi } from '@/modules/categories/data/categories.api';
import { createAttributeModals } from '@shared/routes/attributes.factory';

// --- Lazy Loaders for Categories ---
const LazyCategoryShowRoute = lazyRouteComponent(() => import('@modules/categories/components/CategoryShowPanel'));
const LazyCategoryEditRoute = lazyRouteComponent(() => import('@modules/categories/components/CategoryEditSheet'));
const LazyCategoryNewRoute = lazyRouteComponent(() => import('@modules/categories/components/CategoryNewSheet'));

/**
 * Creates deep nested modal routes for Categories.
 * Supports /categories/new, /categories/$categoryId/show, and nested modals /categories/new/$categoryId/show
 */
export const createCategoryModals = (parentRoute: any, basePath = '', fallbackRedirect: any = { to: '/categories' }) => {
    const prefix = basePath ? `${basePath}/` : '';

    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}new`,
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canAdd('categories')) {
                throw redirect(fallbackRedirect);
            }
        },
        component: LazyCategoryNewRoute,
    });

    const newShowRoute = createRoute({
        getParentRoute: () => newRoute,
        path: `$categoryId/show`,
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

    const newNestedEditRoute = createRoute({
        getParentRoute: () => newShowRoute,
        path: `edit`,
        component: LazyCategoryEditRoute,
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
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canEdit('categories')) {
                throw redirect(fallbackRedirect);
            }
        },
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
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canEdit('categories')) {
                throw redirect(fallbackRedirect);
            }
        },
        component: LazyCategoryEditRoute,
    });

    // Nest attribute creation modals inside newRoute and editRoute
    newRoute.addChildren([
        ...createAttributeModals(newRoute, 'attributes', fallbackRedirect),
        newShowRoute.addChildren([newNestedEditRoute]),
    ]);

    editRoute.addChildren([
        ...createAttributeModals(editRoute, 'attributes', fallbackRedirect),
    ]);

    return [
        newRoute,
        baseRoute.addChildren([
            indexRoute,
            showRoute.addChildren([nestedEditRoute]),
            editRoute
        ])
    ];
};
