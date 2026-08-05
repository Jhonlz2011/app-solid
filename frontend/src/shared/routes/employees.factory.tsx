import { createRoute, lazyRouteComponent, redirect, useNavigate } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import { employeeKeys } from '@modules/employees/data/employees.keys';
import { employeesApi } from '@modules/employees/data/employees.api';

// Lazy loading the Panels as Route Components
const LazyEmployeeShowRoute = lazyRouteComponent(() => import('@modules/employees/components/EmployeeShowPanel'));
const LazyEmployeeEditRoute = lazyRouteComponent(() => import('@modules/employees/components/EmployeeEditSheet'));
const LazyEmployeeNewRoute = lazyRouteComponent(() => import('@modules/employees/components/EmployeeNewSheet'));

/**
 * Creates the modal routes for the Employees module to be injected via Deep Nesting.
 */
export const createEmployeeModals = (parentRoute: any, basePath = '', fallbackRedirect = '/employees') => {
    
    const prefix = basePath ? `${basePath}/` : '';

    // --- CREATE / NEW ---
    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}new`,
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canAdd('employees')) {
                throw redirect({ to: fallbackRedirect });
            }
        },
        component: LazyEmployeeNewRoute,
    });

    // --- BASE LAYOUT WRAPPER (/$employeeId) ---
    const baseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}$employeeId`,
    });

    // --- INVISIBLE BOUNCE-BACK NODE (/$employeeId -> /employees) ---
    const indexRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `/`,
        beforeLoad: () => { throw redirect({ to: fallbackRedirect }); }
    });

    // --- SHOW (/$employeeId/show) ---
    const showRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `show`,
        loader: async ({ params }) => {
            const id = Number(params.employeeId);
            if (isNaN(id)) return;

            return await queryClient.prefetchQuery({
                queryKey: employeeKeys.detail(id),
                queryFn: () => employeesApi.get(id),
                staleTime: 1000 * 30, 
            });
        },
        component: LazyEmployeeShowRoute,
    });

    // --- EDIT SIBLING (/$employeeId/edit) (FROM TABLE) ---
    const editRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `edit`,
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canEdit('employees')) {
                throw redirect({ to: fallbackRedirect });
            }
        },
        loader: async ({ params }) => {
            const id = Number(params.employeeId);
            await queryClient.prefetchQuery({ queryKey: employeeKeys.detail(id), queryFn: () => employeesApi.get(id), staleTime: 1000 * 30 });
            return;
        },
        component: LazyEmployeeEditRoute,
    });

    const nestedEditRoute = createRoute({
        getParentRoute: () => showRoute,
        path: `edit`,
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canEdit('employees')) {
                throw redirect({ to: fallbackRedirect });
            }
        },
        component: function NestedEditWrapper() {
            const navigate = useNavigate();
            return <LazyEmployeeEditRoute onBack={() => navigate({ to: '..', search: true })} />;
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
