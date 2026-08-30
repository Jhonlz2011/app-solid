import { lazyRouteComponent } from '@tanstack/solid-router';
import { createEntityModals } from '@shared/routes/modals.factory';
import { queryClient } from '@shared/lib/queryClient';
import { rbacKeys } from '@/modules/rbac/data/users.keys';
import { usersApi } from '@/modules/rbac/data/users.api';

const LazyUserShowRoute = lazyRouteComponent(() => import('@/modules/rbac/components/UserShowPanel'));
const LazyUserEditRoute = lazyRouteComponent(() => import('@/modules/rbac/components/UserEditSheet'));
const LazyUserNewRoute = lazyRouteComponent(() => import('@/modules/rbac/components/UserNewSheet'));

export const createUserModals = (parentRoute: any, basePath = '') =>
    createEntityModals(parentRoute, basePath, {
        entityKey: 'users',
        idParam: 'userId',
        components: { New: LazyUserNewRoute, Show: LazyUserShowRoute, Edit: LazyUserEditRoute },
        detail: { queryKey: rbacKeys.user, queryFn: usersApi.getUser, staleTime: 1000 * 60 * 5 },
        editPreload: async () => {
            await queryClient.prefetchQuery({ 
                queryKey: rbacKeys.roles(), 
                queryFn: () => usersApi.listRoles(), 
                staleTime: 1000 * 60 * 5 
            });
        },
    });
