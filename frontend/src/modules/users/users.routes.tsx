import { createRoute, redirect } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import GlobalPageLoader from '@shared/ui/GlobalPageLoader';
import { validatePanelSearch } from '@shared/types/search-params.types';
import { rbacKeys } from './data/users.keys';
import { usersApi } from './data/users.api';

// ─── Lazy page ──────────────────────────────────────────────────────────────
import { lazyRouteComponent } from '@tanstack/solid-router';
const UsersRolesPage = lazyRouteComponent(() => import('./views/UsersRolesPage'));

// ─── Route factory ──────────────────────────────────────────────────────────
export const createUsersRoutes = (layoutRoute: any) => {
    const usersRoute = createRoute({
        getParentRoute: () => layoutRoute,
        path: 'users',
        validateSearch: validatePanelSearch,
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canRead('users')) {
                throw redirect({ to: '/dashboard' });
            }
        },
        loaderDeps: () => ({}),
        loader: async () => {
            // Prefetch first page of users + all roles in parallel
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

    return usersRoute;
};
