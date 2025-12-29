// users/data/users.queries.ts
// TanStack Query hooks for users/RBAC module
import { createQuery, createMutation, useQueryClient, keepPreviousData } from '@tanstack/solid-query';
import { usersApi, type RoleUser } from './users.api';
import { rbacKeys } from './users.keys';
import type { Role, UserWithRoles } from '../models/users.types';

// ============================================
// QUERY HOOKS
// ============================================

export function useRoles() {
    return createQuery(() => ({
        queryKey: rbacKeys.roles(),
        queryFn: () => usersApi.listRoles(),
        staleTime: 1000 * 60 * 5, // 5 minutes
        placeholderData: keepPreviousData,
    }));
}

export function usePermissions() {
    return createQuery(() => ({
        queryKey: rbacKeys.permissions(),
        queryFn: () => usersApi.listPermissions(),
        staleTime: 1000 * 60 * 10, // 10 minutes
        placeholderData: keepPreviousData,
    }));
}

export function useUsersWithRoles() {
    return createQuery(() => ({
        queryKey: rbacKeys.users(),
        queryFn: () => usersApi.listUsersWithRoles(),
        staleTime: 1000 * 60 * 2, // 2 minutes
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
                { id: -1, name: newRole.name, description: newRole.description ?? null, userCount: 0 }
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
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
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
        onMutate: async ({ userId, roleIds }) => {
            await queryClient.cancelQueries({ queryKey: rbacKeys.users() });
            const previous = queryClient.getQueryData<UserWithRoles[]>(rbacKeys.users());
            const roles = queryClient.getQueryData<Role[]>(rbacKeys.roles()) ?? [];

            queryClient.setQueryData<UserWithRoles[]>(rbacKeys.users(), (old) =>
                old?.map(u => u.id === userId ? {
                    ...u,
                    roles: roleIds.map(id => {
                        const role = roles.find(r => r.id === id);
                        return { id, name: role?.name ?? '' };
                    })
                } : u) ?? []
            );
            return { previous };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) queryClient.setQueryData(rbacKeys.users(), context.previous);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: rbacKeys.users() });
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
            await queryClient.cancelQueries({ queryKey: rbacKeys.users() });
            const previous = queryClient.getQueryData<UserWithRoles[]>(rbacKeys.users());
            const roles = queryClient.getQueryData<Role[]>(rbacKeys.roles()) ?? [];

            queryClient.setQueryData<UserWithRoles[]>(rbacKeys.users(), (old) => [
                ...(old ?? []),
                {
                    id: -1,
                    username: newUser.username,
                    email: newUser.email,
                    isActive: true,
                    lastLogin: null,
                    roles: (newUser.roleIds ?? []).map(id => {
                        const role = roles.find(r => r.id === id);
                        return { id, name: role?.name ?? '' };
                    }),
                }
            ]);
            return { previous };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) queryClient.setQueryData(rbacKeys.users(), context.previous);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: rbacKeys.users() });
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
            const previous = queryClient.getQueryData<RoleUser[]>(rbacKeys.roleUsers(roleId));
            queryClient.setQueryData<RoleUser[]>(rbacKeys.roleUsers(roleId), (old) =>
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
            queryClient.invalidateQueries({ queryKey: rbacKeys.users() });
            queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
        },
    }));
}

export function useUpdateUser() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: ({ id, ...data }: { id: number; username?: string; email?: string; isActive?: boolean }) =>
            usersApi.updateUser(id, data),
        onMutate: async ({ id, username, email, isActive }) => {
            await queryClient.cancelQueries({ queryKey: rbacKeys.users() });
            const previous = queryClient.getQueryData<UserWithRoles[]>(rbacKeys.users());
            queryClient.setQueryData<UserWithRoles[]>(rbacKeys.users(), (old) =>
                old?.map(u => u.id === id ? {
                    ...u,
                    username: username ?? u.username,
                    email: email ?? u.email,
                    isActive: isActive ?? u.isActive,
                } : u) ?? []
            );
            return { previous };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) queryClient.setQueryData(rbacKeys.users(), context.previous);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: rbacKeys.users() });
        },
    }));
}

export function useDeleteUser() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: (id: number) => usersApi.deleteUser(id),
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: rbacKeys.users() });
            const previous = queryClient.getQueryData<UserWithRoles[]>(rbacKeys.users());
            queryClient.setQueryData<UserWithRoles[]>(rbacKeys.users(), (old) =>
                old?.filter(u => u.id !== id) ?? []
            );
            return { previous };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) queryClient.setQueryData(rbacKeys.users(), context.previous);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: rbacKeys.users() });
            queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
        },
    }));
}
