/**
 * users.queries.ts — TanStack Query Hooks for Users/RBAC module
 *
 * All `useQuery` and `useMutation` hooks with optimistic updates are consolidated here.
 */
import { createQuery, createMutation, useQueryClient, keepPreviousData } from '@tanstack/solid-query';
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import { addOptimisticItem, removeCacheItems, updateCacheItem, type CacheShape } from '@shared/utils/query.utils';
import { rbacKeys } from './users.keys';
import { usersApi } from './users.api';
import type { 
    UsersFilters, 
    FacetData, 
    UserListItem, 
    Role, 
    RoleUsers, 
    UserReferences 
} from '../models/users.types';

// =============================================================================
// Query Hooks
// =============================================================================

export function useEntitiesList() {
    return createQuery(() => ({
        queryKey: ['entities', 'list-all'] as const,
        queryFn: () => usersApi.listEntities(),
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
    }));
}

export function useUserFacets(
    search: () => string | undefined,
    columnFilters?: () => {
        isActive?: string[];
        roles?: string[];
    }
) {
    return createQuery(() => ({
        queryKey: rbacKeys.facets(search(), columnFilters?.()),
        queryFn: async (): Promise<FacetData> => {
            const cf = columnFilters?.();
            const { data, error } = await api.api.rbac.users.facets.get({
                query: {
                    search: search(),
                    isActive: cf?.isActive?.length ? cf.isActive.join(',') : undefined,
                    roles: cf?.roles?.length ? cf.roles.join(',') : undefined,
                },
            });
            if (error) throwApiError(error);
            return data as unknown as FacetData;
        },
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        retry: 2,
        placeholderData: keepPreviousData,
    }));
}

export function useUsers(filters: () => UsersFilters) {
    return createQuery(() => ({
        queryKey: rbacKeys.list(filters()),
        queryFn: () => usersApi.listUsersWithRoles(filters()),
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 30,
        placeholderData: keepPreviousData,
    }));
}

export function useUsersWithRoles(filters: () => UsersFilters) {
    return useUsers(filters);
}

export function useUser(id: () => number | null) {
    return createQuery(() => ({
        queryKey: rbacKeys.user(id()!),
        queryFn: () => usersApi.getUser(id()!),
        enabled: id() !== null && id()! > 0,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
    }));
}

export function useRoles() {
    return createQuery(() => ({
        queryKey: rbacKeys.roles(),
        queryFn: () => usersApi.listRoles(),
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        placeholderData: keepPreviousData,
    }));
}

export function useRole(id: () => number | null) {
    return createQuery(() => ({
        queryKey: rbacKeys.role(id()!),
        queryFn: () => usersApi.getRole(id()!),
        enabled: id() !== null && id()! > 0,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
    }));
}

export function usePermissions() {
    return createQuery(() => ({
        queryKey: rbacKeys.permissions(),
        queryFn: () => usersApi.listPermissions(),
        staleTime: 1000 * 60 * 10,
        gcTime: 1000 * 60 * 60,
        placeholderData: keepPreviousData,
    }));
}

export function useRolePermissions(roleId: () => number | null) {
    return createQuery(() => ({
        queryKey: rbacKeys.rolePermissions(roleId()!),
        queryFn: () => usersApi.getRolePermissions(roleId()!),
        enabled: roleId() !== null,
        staleTime: 1000 * 60 * 5,
        placeholderData: keepPreviousData,
    }));
}

export function useRoleUsers(roleId: () => number | null) {
    return createQuery(() => ({
        queryKey: rbacKeys.roleUsers(roleId()!),
        queryFn: () => usersApi.getRoleUsers(roleId()!),
        enabled: roleId() !== null,
        staleTime: 1000 * 60 * 2,
        placeholderData: keepPreviousData,
    }));
}

export function useUserSessions(userId: () => number) {
    return createQuery(() => ({
        queryKey: rbacKeys.userSessions(userId()),
        queryFn: () => usersApi.getUserSessions(userId()),
        enabled: userId() > 0,
        staleTime: 1000 * 60,
        gcTime: 1000 * 60 * 5,
    }));
}

// =============================================================================
// Reference Check (pre-flight for hard delete warning)
// =============================================================================

export function useCheckUserReferences(id: () => number | null, enabled: () => boolean) {
    return createQuery(() => ({
        queryKey: [...rbacKeys.all, 'can-delete', id()],
        queryFn: async (): Promise<UserReferences> => {
            const { data, error } = await (api.api.rbac.users as any)({ id: id() })['can-delete'].get();
            if (error) throw new Error(String(error.value));
            return data as UserReferences;
        },
        enabled: enabled() && id() !== null,
        staleTime: 10_000,
        gcTime: 30_000,
        retry: false,
    }));
}

// =============================================================================
// Shared Mutation Invalidation
// =============================================================================

function userOnSettled(queryClient: ReturnType<typeof useQueryClient>) {
    return () => {
        queryClient.invalidateQueries({ queryKey: rbacKeys.lists() });
        queryClient.invalidateQueries({ queryKey: [...rbacKeys.all, 'facets'], exact: false });
        queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
    };
}

function applyIsActiveToCache(
    queryClient: ReturnType<typeof useQueryClient>,
    ids: number[],
    isActive: boolean
) {
    queryClient.setQueriesData<CacheShape<UserListItem>>({ queryKey: rbacKeys.lists() }, (old) => {
        if (!old) return old;
        return ids.reduce<CacheShape<UserListItem>>(
            (acc, id) => updateCacheItem(acc, { id, isActive } as unknown as UserListItem) ?? acc,
            old
        );
    });
}

// =============================================================================
// Mutation Hooks (with optimistic updates)
// =============================================================================

export function useCreateRole() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: (data: { name: string; description?: string }) => usersApi.createRole(data),
        onMutate: async (newRole) => {
            await queryClient.cancelQueries({ queryKey: rbacKeys.roles() });
            const previous = queryClient.getQueryData<Role[]>(rbacKeys.roles());
            queryClient.setQueryData<Role[]>(rbacKeys.roles(), (old) => [
                ...(old ?? []),
                { id: -Date.now(), name: newRole.name, description: newRole.description ?? null, userCount: 0, is_system: false, permissionCount: 0 } as Role,
            ]);
            return { previous };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) queryClient.setQueryData(rbacKeys.roles(), context.previous);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
        },
    }));
}

export function useUpdateRole() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: ({ id, ...data }: { id: number; name: string; description?: string }) =>
            usersApi.updateRole(id, data),
        onMutate: async ({ id, name, description }) => {
            await queryClient.cancelQueries({ queryKey: rbacKeys.roles() });
            const previous = queryClient.getQueryData<Role[]>(rbacKeys.roles());
            queryClient.setQueryData<Role[]>(rbacKeys.roles(), (old) =>
                old?.map(r => r.id === id ? { ...r, name, description: description ?? null } : r) ?? []
            );
            return { previous };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) queryClient.setQueryData(rbacKeys.roles(), context.previous);
        },
        onSettled: (_data, _err, { id }) => {
            queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
            queryClient.invalidateQueries({ queryKey: rbacKeys.role(id) });
        },
    }));
}

export function useDeleteRole() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: (id: number) => usersApi.deleteRole(id),
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: rbacKeys.roles() });
            const previous = queryClient.getQueryData<Role[]>(rbacKeys.roles());
            queryClient.setQueryData<Role[]>(rbacKeys.roles(), (old) =>
                old?.filter(r => r.id !== id) ?? []
            );
            return { previous };
        },
        onError: (_err, _id, context) => {
            if (context?.previous) queryClient.setQueryData(rbacKeys.roles(), context.previous);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
        },
    }));
}

export function useUpdateRolePermissions() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: ({ roleId, permissionIds }: { roleId: number; permissionIds: number[] }) =>
            usersApi.updateRolePermissions(roleId, permissionIds),
        onSettled: (_data, _err, variables) => {
            queryClient.invalidateQueries({ queryKey: rbacKeys.rolePermissions(variables.roleId) });
            queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
        },
    }));
}

export function useAssignUserRoles() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: ({ userId, roleIds }: { userId: number; roleIds: number[] }) =>
            usersApi.assignUserRoles(userId, roleIds),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: rbacKeys.lists() });
            queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
        },
    }));
}

export function useCreateUser() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: (data: { username: string; email: string; password: string; roleIds?: number[] }) =>
            usersApi.createUser(data),
        onMutate: async (newUser) => {
            await queryClient.cancelQueries({ queryKey: rbacKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: rbacKeys.lists() });

            queryClient.setQueriesData<CacheShape<UserListItem>>({ queryKey: rbacKeys.lists() }, (old) => {
                if (!old) return old;
                const optimistic = {
                    id: -Date.now(),
                    username: newUser.username,
                    email: newUser.email,
                    isActive: true,
                    lastLogin: null,
                    roles: [],
                } as unknown as UserListItem;
                return addOptimisticItem(old, optimistic);
            });

            return { previousLists };
        },
        onError: (_err, _vars, context) => {
            context?.previousLists?.forEach(([key, data]) => queryClient.setQueryData(key, data));
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: rbacKeys.lists() });
            queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
        },
    }));
}

export function useUpdateUser() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: ({ id, ...data }: { id: number; username?: string; email?: string; isActive?: boolean }) =>
            usersApi.updateUser(id, data),
        onMutate: async ({ id, ...updates }) => {
            await queryClient.cancelQueries({ queryKey: rbacKeys.user(id) });
            const previousUser = queryClient.getQueryData(rbacKeys.user(id));

            if (previousUser) {
                queryClient.setQueryData(rbacKeys.user(id), (old: unknown) => {
                    if (!old || typeof old !== 'object') return old;
                    return { ...old as object, ...updates };
                });
            }

            queryClient.setQueriesData<CacheShape<UserListItem>>({ queryKey: rbacKeys.lists() }, (old) => {
                if (!old) return old;
                return updateCacheItem(old, { id, ...updates } as unknown as UserListItem);
            });

            return { previousUser };
        },
        onError: (_err, { id }, context) => {
            if (context?.previousUser) queryClient.setQueryData(rbacKeys.user(id), context.previousUser);
        },
        onSettled: (_data, _err, { id }) => {
            queryClient.invalidateQueries({ queryKey: rbacKeys.lists() });
            queryClient.invalidateQueries({ queryKey: rbacKeys.user(id) });
        },
    }));
}

export function useDeactivateUser() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (id: number) => {
            const { error } = await (api.api.rbac.users as any)({ id }).deactivate.patch();
            if (error) throw new Error(String(error.value));
            return id;
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: rbacKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: rbacKeys.lists() });
            applyIsActiveToCache(queryClient, [id], false);
            return { previousLists };
        },
        onError: (_err, _id, context) => {
            context?.previousLists?.forEach(([key, data]) => queryClient.setQueryData(key, data));
        },
        onSettled: userOnSettled(queryClient),
    }));
}

export function useDeleteUser() {
    return useDeactivateUser();
}

export function useRestoreUser() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (id: number) => {
            const { error } = await (api.api.rbac.users as any)({ id }).restore.patch();
            if (error) throw new Error(String(error.value));
            return id;
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: rbacKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: rbacKeys.lists() });
            applyIsActiveToCache(queryClient, [id], true);
            return { previousLists };
        },
        onError: (_err, _id, context) => {
            context?.previousLists?.forEach(([key, data]) => queryClient.setQueryData(key, data));
        },
        onSettled: userOnSettled(queryClient),
    }));
}

export function useHardDeleteUser() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (id: number) => {
            const { error } = await (api.api.rbac.users as any)({ id }).delete();
            if (error) throw new Error(String(error.value));
            return id;
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: rbacKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: rbacKeys.lists() });

            queryClient.setQueriesData<CacheShape<UserListItem>>({ queryKey: rbacKeys.lists() }, (old) => {
                if (!old) return old;
                return removeCacheItems(old, [id]);
            });

            return { previousLists };
        },
        onError: (_err, _id, context) => {
            context?.previousLists?.forEach(([key, data]) => queryClient.setQueryData(key, data));
        },
        onSettled: userOnSettled(queryClient),
    }));
}

export function useBulkDeactivateUsers() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (ids: number[]) => {
            const { data, error } = await (api.api.rbac.users.bulk.delete as any).post({ ids });
            if (error) throw new Error(String(error.value));
            return data!;
        },
        onMutate: async (ids) => {
            await queryClient.cancelQueries({ queryKey: rbacKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: rbacKeys.lists() });
            applyIsActiveToCache(queryClient, ids, false);
            return { previousLists };
        },
        onError: (_err, _ids, context) => {
            context?.previousLists?.forEach(([key, data]) => queryClient.setQueryData(key, data));
        },
        onSettled: userOnSettled(queryClient),
    }));
}

export function useBulkRestoreUsers() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (ids: number[]) => {
            const { data, error } = await (api.api.rbac.users.bulk.restore as any).patch({ ids });
            if (error) throw new Error(String(error.value));
            return data!;
        },
        onMutate: async (ids) => {
            await queryClient.cancelQueries({ queryKey: rbacKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: rbacKeys.lists() });
            applyIsActiveToCache(queryClient, ids, true);
            return { previousLists };
        },
        onError: (_err, _ids, context) => {
            context?.previousLists?.forEach(([key, data]) => queryClient.setQueryData(key, data));
        },
        onSettled: userOnSettled(queryClient),
    }));
}

export function useRemoveUserFromRole() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: ({ roleId, userId }: { roleId: number; userId: number }) =>
            usersApi.removeUserFromRole(roleId, userId),
        onMutate: async ({ roleId, userId }) => {
            await queryClient.cancelQueries({ queryKey: rbacKeys.roleUsers(roleId) });
            const previous = queryClient.getQueryData<RoleUsers[]>(rbacKeys.roleUsers(roleId));
            queryClient.setQueryData<RoleUsers[]>(rbacKeys.roleUsers(roleId), (old) =>
                old?.filter(u => u.id !== userId) ?? []
            );
            return { previous, roleId };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(rbacKeys.roleUsers(context.roleId), context.previous);
            }
        },
        onSettled: (_data, _err, { roleId }) => {
            queryClient.invalidateQueries({ queryKey: rbacKeys.roleUsers(roleId) });
            queryClient.invalidateQueries({ queryKey: rbacKeys.lists() });
            queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
        },
    }));
}

export function useRevokeUserSession() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: ({ userId, sessionId }: { userId: number; sessionId: string }) =>
            usersApi.revokeUserSession(userId, sessionId),
        onSuccess: (_data, { userId }) => {
            queryClient.invalidateQueries({ queryKey: rbacKeys.userSessions(userId) });
        },
    }));
}

export function useAdminResetPassword() {
    return createMutation(() => ({
        mutationFn: ({ userId, newPassword }: { userId: number; newPassword: string }) =>
            usersApi.adminResetPassword(userId, newPassword),
    }));
}

export function useSetUserEntity() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: ({ userId, entityId }: { userId: number; entityId: number | null }) =>
            usersApi.setUserEntity(userId, entityId),
        onSuccess: (_data, { userId }) => {
            queryClient.invalidateQueries({ queryKey: rbacKeys.user(userId) });
            queryClient.invalidateQueries({ queryKey: rbacKeys.lists() });
        },
    }));
}
