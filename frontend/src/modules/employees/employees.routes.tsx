import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import GlobalPageLoader from '@/shared/ui/display/GlobalPageLoader';
import { createEmployeeModals } from '@shared/routes/employees.factory';
import { createUserModals } from '@shared/routes/users.factory';
import { employeesApi } from './data/employees.api';
import { employeeKeys } from './data/employees.keys';

// --- LAZY PAGE ---
const EmployeesPage = lazyRouteComponent(() => import('./views/EmployeesPage'));

// ─── Route factory ──────────────────────────────────────────────────────────
export const createEmployeesRoutes = (layoutRoute: any) => {
    const employeesRoute = createRoute({
        getParentRoute: () => layoutRoute,
        path: 'employees',
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canRead('employees')) {
                throw redirect({ to: '/dashboard' });
            }
        },
        loader: async () => {
            const defaultFilters = { limit: 10, direction: 'first' as const };
            return await queryClient.prefetchQuery({
                queryKey: employeeKeys.list(defaultFilters),
                queryFn: () => employeesApi.list(defaultFilters),
                staleTime: 60 * 1000,
            });
        },
        pendingComponent: GlobalPageLoader,
        component: EmployeesPage,
    });

    return employeesRoute.addChildren([
        ...createEmployeeModals(employeesRoute),
        ...createUserModals(employeesRoute, 'user'),
    ]);
};
