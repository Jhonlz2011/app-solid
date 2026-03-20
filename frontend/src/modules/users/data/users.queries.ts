// users/data/users.queries.ts
// TanStack Query hooks for users/RBAC module
import { createQuery, createMutation, useQueryClient, keepPreviousData } from '@tanstack/solid-query';
import { usersApi } from './users.api';
import { rbacKeys } from './users.keys';
import type { Role, UserWithRoles, RoleUsers, UsersFilters } from '../models/users.types';

// ============================================
// QUERY HOOKS
// ============================================

export function useRoles() {
    return createQuery(() => ({
        queryKey: rbacKeys.roles(),
        queryFn: () => usersApi.listRoles(),
        staleTime: 1000 * 60 * 5, // 5 minutes
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
        staleTime: 1000 * 60 * 10, // 10 minutes — permissions rarely change
        gcTime: 1000 * 60 * 60,
        placeholderData: keepPreviousData,
    }));
}

/** Paginated users list — mirrors useSuppliers() pattern */
export function useUsersWithRoles(filters: () => UsersFilters) {
    return createQuery(() => ({
        queryKey: rbacKeys.list(filters()),
        queryFn: () => usersApi.listUsersWithRoles(filters()),
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 30,
        placeholderData: keepPreviousData,
    }));
}

/** Single user detail — for Sheet view/edit panels */
export function useUser(id: () => number | null) {
    return createQuery(() => ({
        queryKey: rbacKeys.user(id()!),
        queryFn: () => usersApi.getUser(id()!),
        enabled: id() !== null && id()! > 0,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
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

// ============================================
// MUTATION HOOKS (with optimistic updates)
// ============================================

export function useCreateRole() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: (data: { name: string; description?: string }) => usersApi.createRole(data),
        onMutate: async (newRole) => {
            await queryClient.cancelQueries({ queryKey: rbacKeys.roles() });
            const previous = queryClient.getQueryData<Role[]>(rbacKeys.roles());
            queryClient.setQueryData<Role[]>(rbacKeys.roles(), (old) => [
                ...(old ?? []),
                { id: -1, name: newRole.name, description: newRole.description ?? null, userCount: 0, is_system: false } as Role
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

export function useUpdateUser() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: ({ id, ...data }: { id: number; username?: string; email?: string; isActive?: boolean }) =>
            usersApi.updateUser(id, data),
        onSettled: (_data, _err, { id }) => {
            queryClient.invalidateQueries({ queryKey: rbacKeys.lists() });
            queryClient.invalidateQueries({ queryKey: rbacKeys.user(id) });
        },
    }));
}

export function useDeleteUser() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: (id: number) => usersApi.deleteUser(id),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: rbacKeys.lists() });
            queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
        },
    }));
}

export function useBatchDeleteUsers() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: (userIds: number[]) => usersApi.batchDeleteUsers(userIds),
        onMutate: async (userIds) => {
            await queryClient.cancelQueries({ queryKey: rbacKeys.lists() });
            const previous = queryClient.getQueriesData({ queryKey: rbacKeys.lists() });
            // Optimistically remove users from all list caches
            queryClient.setQueriesData({ queryKey: rbacKeys.lists() }, (old: any) => {
                if (!old?.data) return old;
                return {
                    ...old,
                    data: old.data.filter((u: any) => !userIds.includes(u.id)),
                    meta: old.meta ? { ...old.meta, total: Math.max(0, (old.meta.total ?? 0) - userIds.length) } : old.meta,
                };
            });
            return { previous };
        },
        onError: (_err: any, _vars: any, context: any) => {
            // Rollback on error
            if (context?.previous) {
                for (const [key, data] of context.previous) {
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
