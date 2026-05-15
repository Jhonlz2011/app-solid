import { createRoute, lazyRouteComponent, redirect, useNavigate } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import { productKeys, productsApi } from '@modules/products/data/products.api';
import { createCategoryModals } from '@/shared/routes/categories.factory';
import { createFamilyModals } from '@shared/routes/settings.factory';
import { createBrandModals } from '@shared/routes/brands.factory';
import { createUomModals } from '@shared/routes/uom.factory';

// Lazy loading the Panels as Route Components
const LazyProductShowRoute = lazyRouteComponent(() => import('@modules/products/components/ProductShowPanel'));
const LazyProductEditRoute = lazyRouteComponent(() => import('@modules/products/components/ProductEditSheet'));
const LazyProductNewRoute = lazyRouteComponent(() => import('@modules/products/components/ProductNewSheet'));

/**
 * Creates the modal routes for the Products module to be injected via Deep Nesting.
 *
 * Route tree:
 *   /products (ProductsPage + <Outlet />)
 *     ├── new (ProductNewSheet + <Outlet />)
 *     │    ├── categories/new   ← nested CategoryNewSheet
 *     │    ├── brands/new       ← nested BrandNewSheet
 *     │    └── families/new     ← nested FamilyNewSheet
 *     └── $productId
 *          ├── show (ProductShowPanel + <Outlet />)
 *          │    └── edit (nested ProductEditSheet)
 *          └── edit (ProductEditSheet + <Outlet />)
 *               ├── categories/new
 *               ├── brands/new
 *               └── families/new
 */
export const createProductModals = (parentRoute: any, basePath = '', fallbackRedirect = '/products') => {
    const prefix = basePath ? `${basePath}/` : '';

    // --- CREATE / NEW ---
    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}new`,
        component: LazyProductNewRoute,
    });

    // Nest catalog creation modals INSIDE newRoute
    // so navigating to /products/new/categories/new renders CategoryNewSheet
    // via <Outlet /> inside ProductNewSheet WITHOUT unmounting the form.
    newRoute.addChildren([
        ...createCategoryModals(newRoute, 'categories', { to: fallbackRedirect }),
        ...createBrandModals(newRoute, 'brands', { to: fallbackRedirect }),
        ...createFamilyModals(newRoute, 'families', { to: fallbackRedirect }),
    ]);

    // --- BASE LAYOUT WRAPPER (/$productId) ---
    const baseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}$productId`,
    });

    // --- INVISIBLE BOUNCE-BACK NODE (/$productId -> /products) ---
    const indexRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `/`,
        beforeLoad: () => { throw redirect({ to: fallbackRedirect }); }
    });

    // --- SHOW (/$productId/show) ---
    const showRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `show`,
        loader: async ({ params }) => {
            const id = Number(params.productId);
            if (isNaN(id)) return;

            return await queryClient.prefetchQuery({
                queryKey: productKeys.detail(id),
                queryFn: () => productsApi.get(id),
                staleTime: 1000 * 30,
            });
        },
        component: LazyProductShowRoute,
    });

    // --- EDIT SIBLING (/$productId/edit) (FROM TABLE) ---
    const editRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `edit`,
        loader: async ({ params }) => {
            const id = Number(params.productId);
            await queryClient.prefetchQuery({
                queryKey: productKeys.detail(id),
                queryFn: () => productsApi.get(id),
                staleTime: 1000 * 30,
            });
            return;
        },
        component: LazyProductEditRoute,
    });

    // Nest catalog creation modals INSIDE editRoute too
    editRoute.addChildren([
        ...createCategoryModals(editRoute, 'categories', { to: fallbackRedirect }),
        ...createBrandModals(editRoute, 'brands', { to: fallbackRedirect }),
        ...createFamilyModals(editRoute, 'families', { to: fallbackRedirect }),
    ]);

    // --- NESTED EDIT (/$productId/show/edit) (FROM SHOW PANEL) ---
    const nestedEditRoute = createRoute({
        getParentRoute: () => showRoute,
        path: `edit`,
        component: function NestedEditWrapper() {
            const navigate = useNavigate();
            return <LazyProductEditRoute onBack={() => navigate({ to: '..', search: true })} />;
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
