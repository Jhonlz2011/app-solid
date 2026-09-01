import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import { rbacKeys } from '@/modules/rbac/data/users.keys';
import { usersApi } from '@/modules/rbac/data/users.api';
import { STALE_TIME } from '@shared/constants/cache.constants';

const LazyRoleNewRoute = lazyRouteComponent(() =>
    import('@/modules/rbac/components/RoleFormDialog').then(m => ({ default: () => <m.default mode="create" isOpen={true} /> }))
);
const LazyRoleEditRoute = lazyRouteComponent(() =>
    import('@/modules/rbac/components/RoleFormDialog').then(m => ({ default: () => <m.default mode="edit" isOpen={true} /> }))
);
const LazyRolePermissionsRoute = lazyRouteComponent(() =>
    import('@/modules/rbac/components/RoleFormDialog').then(m => ({ default: () => <m.default mode="permissions" isOpen={true} /> }))
);
const LazyRoleUsersRoute = lazyRouteComponent(() =>
    import('@/modules/rbac/components/RoleUsersDialog').then(m => ({ default: () => <m.default isOpen={true} roleId={null} roleName="" /> }))
);

export const createRoleModals = (parentRoute: any, basePath = 'role') => {
    const prefix = basePath ? `${basePath}/` : '';

    // --- CREATE ROLE (/users/role/new) ---
    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}new`,
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canAdd('roles')) {
                throw redirect({ to: parentRoute.fullPath });
            }
        },
        loader: async () => {
            await queryClient.ensureQueryData({
                queryKey: rbacKeys.permissions(),
                queryFn: () => usersApi.listPermissions(),
                staleTime: STALE_TIME.LONG,
            });
        },
        component: LazyRoleNewRoute,
    });

    // --- $roleId BASE (/users/role/$roleId) ---
    const baseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}$roleId`,
    });

    const indexRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `/`,
        beforeLoad: () => {
            throw redirect({ to: parentRoute.fullPath });
        },
    });

    // --- EDIT ROLE (/users/role/$roleId/edit) ---
    const editRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `edit`,
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canEdit('roles')) {
                throw redirect({ to: parentRoute.fullPath });
            }
        },
        loader: async ({ params }: { params: { roleId: string } }) => {
            const roleId = Number(params.roleId);
            if (!isNaN(roleId) && roleId > 0) {
                await Promise.all([
                    queryClient.ensureQueryData({
                        queryKey: rbacKeys.role(roleId),
                        queryFn: () => usersApi.getRole(roleId),
                        staleTime: STALE_TIME.MEDIUM,
                    }),
                    queryClient.ensureQueryData({
                        queryKey: rbacKeys.rolePermissions(roleId),
                        queryFn: () => usersApi.getRolePermissions(roleId),
                        staleTime: STALE_TIME.MEDIUM,
                    }),
                    queryClient.ensureQueryData({
                        queryKey: rbacKeys.permissions(),
                        queryFn: () => usersApi.listPermissions(),
                        staleTime: STALE_TIME.LONG,
                    }),
                ]);
            }
        },
        component: LazyRoleEditRoute,
    });

    // --- PERMISSIONS ONLY (/users/role/$roleId/permissions) ---
    const permissionsRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `permissions`,
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canEdit('roles') && !useAuth().canRead('roles')) {
                throw redirect({ to: parentRoute.fullPath });
            }
        },
        loader: async ({ params }: { params: { roleId: string } }) => {
            const roleId = Number(params.roleId);
            if (!isNaN(roleId) && roleId > 0) {
                await Promise.all([
                    queryClient.ensureQueryData({
                        queryKey: rbacKeys.role(roleId),
                        queryFn: () => usersApi.getRole(roleId),
                        staleTime: STALE_TIME.MEDIUM,
                    }),
                    queryClient.ensureQueryData({
                        queryKey: rbacKeys.rolePermissions(roleId),
                        queryFn: () => usersApi.getRolePermissions(roleId),
                        staleTime: STALE_TIME.MEDIUM,
                    }),
                    queryClient.ensureQueryData({
                        queryKey: rbacKeys.permissions(),
                        queryFn: () => usersApi.listPermissions(),
                        staleTime: STALE_TIME.LONG,
                    }),
                ]);
            }
        },
        component: LazyRolePermissionsRoute,
    });

    // --- ROLE USERS (/users/role/$roleId/users) ---
    const usersRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `users`,
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canRead('roles') && !useAuth().canRead('users')) {
                throw redirect({ to: parentRoute.fullPath });
            }
        },
        loader: async ({ params }: { params: { roleId: string } }) => {
            const roleId = Number(params.roleId);
            if (!isNaN(roleId) && roleId > 0) {
                await Promise.all([
                    queryClient.ensureQueryData({
                        queryKey: rbacKeys.role(roleId),
                        queryFn: () => usersApi.getRole(roleId),
                        staleTime: STALE_TIME.MEDIUM,
                    }),
                    queryClient.ensureQueryData({
                        queryKey: rbacKeys.roleUsers(roleId),
                        queryFn: () => usersApi.getRoleUsers(roleId),
                        staleTime: STALE_TIME.SHORT,
                    }),
                ]);
            }
        },
        component: LazyRoleUsersRoute,
    });

    return [newRoute, baseRoute.addChildren([indexRoute, editRoute, permissionsRoute, usersRoute])];
};
