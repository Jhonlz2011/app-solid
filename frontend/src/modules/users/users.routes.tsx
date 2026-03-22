import { createRoute, redirect, useParams, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import GlobalPageLoader from '@shared/ui/GlobalPageLoader';
import { rbacKeys } from './data/users.keys';
import { usersApi } from './data/users.api';

// ─── Lazy components ────────────────────────────────────────────────────────
const UsersRolesPage = lazyRouteComponent(() => import('./views/UsersRolesPage'));
const UserNewSheet = lazyRouteComponent(() => import('./components/UserNewSheet'));
const UserEditSheet = lazyRouteComponent(() => import('./components/UserEditSheet'));
const UserShowPanel = lazyRouteComponent(() => import('./components/UserShowPanel'));

// ─── Parameter wrappers ──────────────────────────────────────────────────────
const UserEditWrapper = () => {
    const params = useParams({ strict: false });
    const userId = Number(params()?.id) || 0;
    return <UserEditSheet userId={userId} />;
};

const UserShowWrapper = () => {
    const params = useParams({ strict: false });
    const userId = Number(params()?.id) || 0;
    return <UserShowPanel userId={userId} />;
};

// ─── Route factory ───────────────────────────────────────────────────────────
export const createUsersRoutes = (layoutRoute: any) => {
    // Parent: /users — layout + permission guard + data prefetch
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

    // ─── User sub-routes ────────────────────────────────────────────────────
    const usersIndexRoute = createRoute({
        getParentRoute: () => usersRoute,
        path: '/',
        component: () => null,
    });

    const userNewRoute = createRoute({
        getParentRoute: () => usersRoute,
        path: 'new',
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canAdd('users')) {
                throw redirect({ to: '/users' });
            }
        },
        component: () => <UserNewSheet />,
    });

    const userEditRoute = createRoute({
        getParentRoute: () => usersRoute,
        path: 'edit/$id',
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canEdit('users')) {
                throw redirect({ to: '/users' });
            }
        },
        component: UserEditWrapper,
        loader: async ({ params }) => {
            const id = Number(params.id);
            if (!id) return;
            await queryClient.prefetchQuery({
                queryKey: rbacKeys.user(id),
                queryFn: () => usersApi.getUser(id),
                staleTime: 1000 * 60 * 2,
            });
        },
    });

    const userShowRoute = createRoute({
        getParentRoute: () => usersRoute,
        path: 'show/$id',
        component: UserShowWrapper,
        loader: async ({ params }) => {
            const id = Number(params.id);
            if (!id) return;
            await queryClient.prefetchQuery({
                queryKey: rbacKeys.user(id),
                queryFn: () => usersApi.getUser(id),
                staleTime: 1000 * 60 * 5,
            });
        },
    });

    return usersRoute.addChildren([
        usersIndexRoute,
        userNewRoute,
        userEditRoute,
        userShowRoute,
    ]);
};
