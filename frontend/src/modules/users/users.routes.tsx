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
            // B) Parallel Query Prefetching
            return await Promise.all([
                queryClient.prefetchQuery({
                    queryKey: rbacKeys.list({ page: 1, limit: 15 }),
                    queryFn: () => usersApi.listUsersWithRoles({ page: 1, limit: 15 }),
                    staleTime: 1000 * 60 * 2,
                }),
                queryClient.prefetchQuery({
                    queryKey: rbacKeys.roles(),
                    queryFn: () => usersApi.listRoles(),
                    staleTime: 1000 * 60 * 5,
                }),
            ]);
        },
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
