import { createRoute, lazyRouteComponent, redirect, useNavigate } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import { supplierKeys, suppliersApi } from '@modules/suppliers/data/suppliers.api';

// Lazy loading the Panels as Route Components
const LazySupplierShowRoute = lazyRouteComponent(() => import('@modules/suppliers/components/SupplierShowPanel'));
const LazySupplierEditRoute = lazyRouteComponent(() => import('@modules/suppliers/components/SupplierEditSheet'));
const LazySupplierNewRoute = lazyRouteComponent(() => import('@modules/suppliers/components/SupplierNewSheet'));

/**
 * Creates the modal routes for the Suppliers module to be injected via Deep Nesting.
 */
export const createSupplierModals = (parentRoute: any, basePath = '', fallbackRedirect = '/suppliers') => {
    
    const prefix = basePath ? `${basePath}/` : '';

    // --- CREATE / NEW ---
    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}new`,
        component: LazySupplierNewRoute,
    });

    // --- BASE LAYOUT WRAPPER (/$supplierId) ---
    const baseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}$supplierId`,
    });

    // --- INVISIBLE BOUNCE-BACK NODE (/$supplierId -> /suppliers) ---
    const indexRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `/`,
        beforeLoad: () => { throw redirect({ to: fallbackRedirect }); }
    });

    // --- SHOW (/$supplierId/show) ---
    const showRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `show`,
        loader: async ({ params }) => {
            const id = Number(params.supplierId);
            if (isNaN(id)) return;

            return await queryClient.prefetchQuery({
                queryKey: supplierKeys.detail(id),
                queryFn: () => suppliersApi.get(id),
                staleTime: 1000 * 30, 
            });
        },
        component: LazySupplierShowRoute,
    });

    // --- EDIT SIBLING (/$supplierId/edit) (FROM TABLE) ---
    const editRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `edit`,
        loader: async ({ params }) => {
            const id = Number(params.supplierId);
            await queryClient.prefetchQuery({ queryKey: supplierKeys.detail(id), queryFn: () => suppliersApi.get(id), staleTime: 1000 * 30 });
            return;
        },
        component: LazySupplierEditRoute,
    });

    const nestedEditRoute = createRoute({
        getParentRoute: () => showRoute,
        path: `edit`,
        component: function NestedEditWrapper() {
            const navigate = useNavigate();
            return <LazySupplierEditRoute onBack={() => navigate({ to: '..', search: true })} />;
        }
    });

    // Return the array of configured routes
    return [
        newRoute,
        baseRoute.addChildren([
            indexRoute,
            showRoute.addChildren([nestedEditRoute]), // Child behavior
            editRoute // Sibling behavior
        ])
    ];
};