import { createRoute, lazyRouteComponent, redirect, useNavigate } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import { productKeys, productsApi } from '@modules/products/data/products.api';
import { createCategoryModals } from '@/shared/routes/categories.factory';

import { createBrandModals } from '@shared/routes/brands.factory';

// Lazy loading the Panels as Route Components
const LazyServiceShowRoute = lazyRouteComponent(() => import('@modules/services/components/ServiceShowPanel'));
const LazyServiceEditRoute = lazyRouteComponent(() => import('@modules/services/components/ServiceEditSheet'));
const LazyServiceNewRoute = lazyRouteComponent(() => import('@modules/services/components/ServiceNewSheet'));

/**
 * Creates the modal routes for the Services module to be injected via Deep Nesting.
 */
export const createServiceModals = (parentRoute: any, basePath = '', fallbackRedirect = '/services') => {
    const prefix = basePath ? `${basePath}/` : '';

    // --- CREATE / NEW ---
    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}new`,
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canAdd('services')) {
                throw redirect({ to: fallbackRedirect });
            }
        },
        component: LazyServiceNewRoute,
    });

    // Nest catalog creation modals INSIDE newRoute
    newRoute.addChildren([
        ...createCategoryModals(newRoute, 'categories', { to: fallbackRedirect }),
        ...createBrandModals(newRoute, 'brands', { to: fallbackRedirect }),
    ]);

    // --- BASE LAYOUT WRAPPER (/$serviceId) ---
    const baseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}$serviceId`,
    });

    // --- INVISIBLE BOUNCE-BACK NODE (/$serviceId -> /services) ---
    const indexRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `/`,
        beforeLoad: () => { throw redirect({ to: fallbackRedirect }); }
    });

    // --- SHOW (/$serviceId/show) ---
    const showRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `show`,
        loader: async ({ params }) => {
            const id = Number(params.serviceId);
            if (isNaN(id)) return;

            return await queryClient.prefetchQuery({
                queryKey: productKeys.detail(id),
                queryFn: () => productsApi.get(id),
                staleTime: 1000 * 30,
            });
        },
        component: LazyServiceShowRoute,
    });

    // --- EDIT SIBLING (/$serviceId/edit) (FROM TABLE) ---
    const editRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `edit`,
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canEdit('services')) {
                throw redirect({ to: fallbackRedirect });
            }
        },
        loader: async ({ params }) => {
            const id = Number(params.serviceId);
            await queryClient.prefetchQuery({
                queryKey: productKeys.detail(id),
                queryFn: () => productsApi.get(id),
                staleTime: 1000 * 30,
            });
            return;
        },
        component: LazyServiceEditRoute,
    });

    // Nest catalog creation modals INSIDE editRoute too
    editRoute.addChildren([
        ...createCategoryModals(editRoute, 'categories', { to: fallbackRedirect }),
        ...createBrandModals(editRoute, 'brands', { to: fallbackRedirect }),
    ]);

    // --- NESTED EDIT (/$serviceId/show/edit) (FROM SHOW PANEL) ---
    const nestedEditRoute = createRoute({
        getParentRoute: () => showRoute,
        path: `edit`,
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canEdit('services')) {
                throw redirect({ to: fallbackRedirect });
            }
        },
        component: function NestedEditWrapper() {
            const navigate = useNavigate();
            return <LazyServiceEditRoute onBack={() => navigate({ to: '..', search: true })} />;
        }
    });

    return [
        newRoute,
        baseRoute.addChildren([
            indexRoute,
            showRoute.addChildren([nestedEditRoute]),
            editRoute,
        ])
    ];
};
