/**
 * users.mutations.ts — TanStack Mutation Hooks for Users/RBAC module
 *
 * All `useMutation` hooks with optimistic updates, cache manipulation helpers,
 * and shared invalidation logic.
 */
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { addOptimisticItem, removeCacheItems, updateCacheItem, type CacheShape } from '@shared/utils/query.utils';
import { rbacKeys } from './users.keys';
import { usersApi } from './users.api';
import type {
    UserListItem,
    Role,
    RoleUsers,
} from '../models/users.types';

// =============================================================================
// Shared Mutation Helpers
// =============================================================================

/** Standardized onSettled for all user mutations — invalidates lists, facets, roles */
function userOnSettled(queryClient: ReturnType<typeof useQueryClient>) {
    return () => {
        queryClient.invalidateQueries({ queryKey: rbacKeys.lists() });
        queryClient.invalidateQueries({ queryKey: [...rbacKeys.all, 'facets'], exact: false });
        queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
    };
}

/** Apply is_active change to all cached user lists (optimistic) */
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
// Role Mutations
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

// =============================================================================
// User Role Assignment Mutations
// =============================================================================

export function useAssignUserRoles() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: ({ userId, roleIds }: { userId: number; roleIds: number[] }) =>
            usersApi.assignUserRoles(userId, roleIds),
        onMutate: async ({ userId, roleIds }) => {
            await queryClient.cancelQueries({ queryKey: rbacKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: rbacKeys.lists() });

            queryClient.setQueriesData<CacheShape<UserListItem>>({ queryKey: rbacKeys.lists() }, (old) => {
                if (!old) return old;
                return updateCacheItem(old, { id: userId, roleIds } as unknown as UserListItem);
            });

            return { previousLists };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousLists) {
                for (const [key, data] of context.previousLists) {
                    queryClient.setQueryData(key, data);
                }
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: rbacKeys.lists() });
            queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
        },
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

// =============================================================================
// User CRUD Mutations
// =============================================================================

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

// =============================================================================
// User Lifecycle Mutations (Deactivate / Restore / Hard Delete)
// =============================================================================

export function useDeactivateUser() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (id: number) => {
            await usersApi.deactivateUser(id);
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

export function useRestoreUser() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (id: number) => {
            await usersApi.restoreUser(id);
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
            await usersApi.hardDeleteUser(id);
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

// =============================================================================
// Bulk Operations
// =============================================================================

export function useBulkDeactivateUsers() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (ids: number[]) => {
            return await usersApi.bulkDeactivateUsers(ids);
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
            return await usersApi.bulkRestoreUsers(ids);
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

// =============================================================================
// Session & Admin Mutations
// =============================================================================

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
