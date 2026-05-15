import { createRoute, redirect } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import GlobalPageLoader from '@shared/ui/GlobalPageLoader';
import { rbacKeys } from './data/users.keys';
import { usersApi } from './data/users.api';
import { createUserModals } from '@shared/routes/users.factory';
import { createSupplierModals } from '@shared/routes/suppliers.factory';

// ─── Lazy page ──────────────────────────────────────────────────────────────
import { lazyRouteComponent } from '@tanstack/solid-router';
const UsersRolesPage = lazyRouteComponent(() => import('./views/UsersRolesPage'));

// ─── Route factory ──────────────────────────────────────────────────────────
export const createUsersRoutes = (layoutRoute: any) => {
    const usersRoute = createRoute({
        getParentRoute: () => layoutRoute,
        path: 'users',
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canRead('users')) {
                throw redirect({ to: '/dashboard' });
            }
        },
        loader: async () => {
            await Promise.all([
                queryClient.ensureQueryData({
                    queryKey: rbacKeys.list({ page: 1, limit: 15 }),
                    queryFn: () => usersApi.listUsersWithRoles({ page: 1, limit: 15 }),
                    staleTime: 1000 * 60 * 2,
                }),
                queryClient.ensureQueryData({
                    queryKey: rbacKeys.roles(),
                    queryFn: () => usersApi.listRoles(),
                    staleTime: 1000 * 60 * 5,
                }),
            ]);
        },
        staleTime: Infinity, // TanStack Router: don't re-run loader once loaded (TanStack Query handles freshness)
        pendingComponent: GlobalPageLoader,
        component: UsersRolesPage,
    });

    // Inject deep nested modals
    usersRoute.addChildren([
        ...createUserModals(usersRoute),
        ...createSupplierModals(usersRoute, 'supplier', '/users')
    ]);

    return usersRoute;
};
