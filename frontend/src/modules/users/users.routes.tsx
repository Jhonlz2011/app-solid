import { createRoute, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import GlobalPageLoader from '@shared/ui/GlobalPageLoader';

// --- LAZY COMPONENTS ---
const UsersRolesPage = lazyRouteComponent(() => import('./views/UsersRolesPage'));

export const createUsersRoutes = (layoutRoute: any) => {
  const usersRoute = createRoute({
    getParentRoute: () => layoutRoute,
    path: '/system/users',
    beforeLoad: () => {
      import('@modules/auth/store/auth.store').then(({ useAuth }) => {
        if (!useAuth().canRead('users')) {
           window.location.href = '/dashboard';
        }
      });
    },
    loader: async () => {
      // Parallel Fetching: Block route transition until data is pre-fetched,
      // explicitly triggering the pendingComponent skeleton.
      const { usersApi } = await import('./data/users.api');
      const { rbacKeys } = await import('./data/users.keys');
      
      return await Promise.all([
        queryClient.prefetchQuery({ queryKey: rbacKeys.users(), queryFn: () => usersApi.listUsersWithRoles() }),
        queryClient.prefetchQuery({ queryKey: rbacKeys.roles(), queryFn: () => usersApi.listRoles() })
      ]);
    },
    pendingComponent: GlobalPageLoader,
    component: UsersRolesPage,
  });

  return usersRoute;
};
