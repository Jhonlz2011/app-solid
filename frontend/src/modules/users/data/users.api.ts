/**
 * users.api.ts — Unified Data Layer (API + Keys + Queries + Mutations)
 *
 * Pattern: mirrors suppliers.api.ts
 * - Eden-inferred types
 * - Centralized query keys
 * - Query hooks with keepPreviousData
 * - Mutation hooks with optimistic updates via query.utils
 * - throwApiError for structured error handling
 */
import { createQuery, createMutation, useQueryClient, keepPreviousData } from '@tanstack/solid-query';
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import { addOptimisticItem, removeCacheItems, updateCacheItem, type CacheShape } from '@shared/utils/query.utils';

// =============================================================================
// Type Utilities — inferred from Eden
// =============================================================================

type UsersListResponse = Awaited<ReturnType<typeof api.api.rbac.users.get>>['data'];
export type UserListItem = NonNullable<UsersListResponse>['data'][number];
type RoleBase = Awaited<ReturnType<typeof api.api.rbac.roles.get>>['data'];
export type RoleListItem = NonNullable<RoleBase>[number] & { is_system?: boolean; permissionCount?: number };
export type RoleBody = Parameters<typeof api.api.rbac.roles.post>[0];

// Re-export commonly used types
export type UserWithRoles = UserListItem;
export type Role = RoleListItem;
export type Permission = Awaited<ReturnType<typeof usersApi.listPermissions>>['all'][number];
export type PermissionsResponse = Awaited<ReturnType<typeof usersApi.listPermissions>>;
export type RoleUsers = Awaited<ReturnType<typeof usersApi.getRoleUsers>>[number];

// Pagination meta
export interface UsersMeta {
    total: number;
    page: number;
    pageCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

// Filters for paginated user list
export interface UsersFilters {
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    isActive?: string[];
    roles?: string[];
}

// =============================================================================
// Query Keys — centralized factory
// =============================================================================

export const rbacKeys = {
    all: ['rbac'] as const,
    // Users
    users: () => [...rbacKeys.all, 'users'] as const,
    lists: () => [...rbacKeys.users(), 'list'] as const,
    list: (filters: object) => [...rbacKeys.lists(), filters] as const,
    user: (id: number) => [...rbacKeys.users(), 'detail', id] as const,
    userSessions: (id: number) => [...rbacKeys.users(), 'sessions', id] as const,
    userAuditLog: (id: number, page?: number) => [...rbacKeys.users(), 'audit-log', id, { page }] as const,
    // Roles
    roles: () => [...rbacKeys.all, 'roles'] as const,
    role: (id: number) => [...rbacKeys.roles(), 'detail', id] as const,
    rolePermissions: (roleId: number) => [...rbacKeys.all, 'role-permissions', roleId] as const,
    roleUsers: (roleId: number) => [...rbacKeys.all, 'role-users', roleId] as const,
    // Permissions
    permissions: () => [...rbacKeys.all, 'permissions'] as const,
    // Facets
    facets: (search?: string, filters?: Record<string, string[] | undefined>) =>
        [...rbacKeys.all, 'facets', { search, ...filters }] as const,
};

// =============================================================================
// Direct API (for prefetching and non-hook usage)
// =============================================================================

export const usersApi = {
    // ─── Roles ───────────────────────────────────────────────────
    listRoles: async () => {
        const { data, error } = await api.api.rbac.roles.get();
        if (error) throwApiError(error);
        return data!;
    },

    getRole: async (id: number) => {
        const { data, error } = await api.api.rbac.roles({ id }).get();
        if (error) throwApiError(error);
        return data!;
    },

    createRole: async (body: RoleBody) => {
        const { data, error } = await api.api.rbac.roles.post(body);
        if (error) throwApiError(error);
        return data!;
    },

    updateRole: async (id: number, body: RoleBody) => {
        const { data, error } = await api.api.rbac.roles({ id }).put(body);
        if (error) throwApiError(error);
        return data!;
    },

    deleteRole: async (id: number) => {
        const { data, error } = await api.api.rbac.roles({ id }).delete();
        if (error) throwApiError(error);
        return data!;
    },

    // ─── Permissions ─────────────────────────────────────────────
    listPermissions: async () => {
        const { data, error } = await api.api.rbac.permissions.get();
        if (error) throwApiError(error);
        return data!;
    },

    getRolePermissions: async (roleId: number) => {
        const { data, error } = await api.api.rbac.roles({ id: roleId }).permissions.get();
        if (error) throwApiError(error);
        return data!;
    },

    updateRolePermissions: async (roleId: number, permissionIds: number[]) => {
        const { data, error } = await api.api.rbac.roles({ id: roleId }).permissions.put({ permissionIds });
        if (error) throwApiError(error);
        return data!;
    },

    // ─── Users (paginated) ───────────────────────────────────────
    listUsersWithRoles: async (filters: UsersFilters = {}) => {
        const { data, error } = await api.api.rbac.users.get({
            query: {
                search: filters.search,
                page: filters.page,
                limit: filters.limit,
                sortBy: filters.sortBy,
                sortOrder: filters.sortOrder,
                isActive: filters.isActive?.join(','),
                roles: filters.roles?.join(','),
            },
        });
        if (error) throwApiError(error);
        return data!;
    },

    getUser: async (id: number) => {
        const { data, error } = await api.api.rbac.users({ id }).get();
        if (error) throwApiError(error);
        return data!;
    },

    createUser: async (body: Parameters<typeof api.api.rbac.users.post>[0]) => {
        const { data, error } = await api.api.rbac.users.post(body);
        if (error) throwApiError(error);
        return data!;
    },

    updateUser: async (id: number, body: { username?: string; email?: string; isActive?: boolean }) => {
        const { data, error } = await api.api.rbac.users({ id }).put(body);
        if (error) throwApiError(error);
        return data!;
    },

    deleteUser: async (id: number) => {
        const { data, error } = await api.api.rbac.users({ id }).delete();
        if (error) throwApiError(error);
        return data!;
    },

    // ─── User Roles ──────────────────────────────────────────────
    assignUserRoles: async (userId: number, roleIds: number[]) => {
        const { data, error } = await api.api.rbac.users({ id: userId }).roles.put({ roleIds });
        if (error) throwApiError(error);
        return data!;
    },

    // ─── Role Users ──────────────────────────────────────────────
    getRoleUsers: async (roleId: number) => {
        const { data, error } = await api.api.rbac.roles({ id: roleId }).users.get();
        if (error) throwApiError(error);
        return data!;
    },

    removeUserFromRole: async (roleId: number, userId: number) => {
        const { data, error } = await api.api.rbac.roles({ id: roleId }).users({ userId }).delete();
        if (error) throwApiError(error);
        return data!;
    },

    // ─── Batch Operations ────────────────────────────────────────
    batchDeleteUsers: async (userIds: number[]) => {
        const { data, error } = await api.api.rbac.users.batch_delete.post({ userIds });
        if (error) throwApiError(error);
        return data!;
    },

    bulkDeactivateUsers: async (ids: number[]) => {
        const { data, error } = await (api.api.rbac.users.bulk.delete as any).post({ ids });
        if (error) throwApiError(error);
        return data!;
    },

    bulkRestoreUsers: async (ids: number[]) => {
        const { data, error } = await (api.api.rbac.users.bulk.restore as any).patch({ ids });
        if (error) throwApiError(error);
        return data!;
    },

    // ─── Role Hierarchy ──────────────────────────────────────────
    getRoleHierarchy: async () => {
        const { data, error } = await api.api.rbac.roles.hierarchy.get();
        if (error) throwApiError(error);
        return data!;
    },

    addRoleHierarchy: async (parentRoleId: number, childRoleId: number) => {
        const { data, error } = await api.api.rbac.roles.hierarchy.post({ parentRoleId, childRoleId });
        if (error) throwApiError(error);
        return data!;
    },

    removeRoleHierarchy: async (parentRoleId: number, childRoleId: number) => {
        const { data, error } = await api.api.rbac.roles.hierarchy.delete({ parentRoleId, childRoleId });
        if (error) throwApiError(error);
        return data!;
    },

    // ─── User Sessions (Admin) ───────────────────────────────────
    getUserSessions: async (userId: number): Promise<UserSession[]> => {
        const userPath = api.api.rbac.users({ id: userId }) as any;
        const { data, error } = await userPath.sessions.get();
        if (error) throwApiError(error);
        return data as UserSession[];
    },

    revokeUserSession: async (userId: number, sessionId: string) => {
        const userPath = api.api.rbac.users({ id: userId }) as any;
        const { data, error } = await userPath.sessions({ id: sessionId }).delete();
        if (error) throwApiError(error);
        return data!;
    },

    // ─── User Audit Log ──────────────────────────────────────────
    getUserAuditLog: async (userId: number, page: number = 1, limit: number = 20): Promise<AuditLogResponse> => {
        const userPath = api.api.rbac.users({ id: userId }) as any;
        const { data, error } = await userPath['audit-log'].get({
            query: { page, limit },
        });
        if (error) throwApiError(error);
        return data as AuditLogResponse;
    },

    // ─── Admin Password Reset ────────────────────────────────────
    adminResetPassword: async (userId: number, newPassword: string) => {
        const userPath = api.api.rbac.users({ id: userId }) as any;
        const { data, error } = await userPath['reset-password'].post({ newPassword });
        if (error) throwApiError(error);
        return data!;
    },

    // ─── User Entity Assignment ──────────────────────────────────
    setUserEntity: async (userId: number, entityId: number | null) => {
        const userPath = api.api.rbac.users({ id: userId }) as any;
        const { data, error } = await userPath.entity.patch({ entityId });
        if (error) throwApiError(error);
        return data!;
    },

    // ─── Entities (for picker) ───────────────────────────────────
    listEntities: async (search?: string): Promise<EntityPickerItem[]> => {
        const { data, error } = await (api.api as any).entities.get({
            query: { limit: 200, search },
        });
        if (error) throwApiError(error);
        return (data ?? []) as EntityPickerItem[];
    },
};

// =============================================================================
// Query Hooks
// =============================================================================

export type FacetData = Record<string, { value: string; count: number }[]>;

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

            // Also optimistically update in list caches
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
// Shared Mutation Invalidation
// =============================================================================

/** Shared onSettled for all user mutations — invalidates list + facet caches */
function userOnSettled(queryClient: ReturnType<typeof useQueryClient>) {
    return () => {
        queryClient.invalidateQueries({ queryKey: rbacKeys.lists() });
        queryClient.invalidateQueries({ queryKey: [...rbacKeys.all, 'facets'], exact: false });
        queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
    };
}

/**
 * Applies `isActive` patch for multiple user IDs via sequential updateCacheItem calls.
 */
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
// Deactivate (Soft Delete) — preserves roles
// =============================================================================

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

/** Backwards-compatible alias — calls deactivate */
export function useDeleteUser() {
    return useDeactivateUser();
}

// =============================================================================
// Restore — re-activates user with roles intact
// =============================================================================

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

// =============================================================================
// Hard Delete (Destroy) — permanently removes user
// =============================================================================

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

// =============================================================================
// Reference Check (pre-flight for hard delete warning)
// =============================================================================

export interface UserReferences {
    roles: number;
    activeSessions: number;
    auditLogs: number;
    total: number;
    canDelete: boolean;
}

/**
 * Lazy query: only fetches when `enabled` is true.
 * Trigger it by passing `enabled: () => true` when the user switches to hard-delete mode.
 */
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
// Bulk Operations
// =============================================================================

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

/** Backwards-compatible alias */
export function useBatchDeleteUsers() {
    return useBulkDeactivateUsers();
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

// =============================================================================
// New Types
// =============================================================================

export interface UserSession {
    id: string;
    user_agent: string | null;
    ip_address: string | null;
    location: string | null;
    created_at: string;
    is_current: boolean;
}

export interface AuditLogEntry {
    id: number;
    action: string;
    targetType: string | null;
    targetId: number | null;
    details: string | null;
    ipAddress: string | null;
    createdAt: string;
    performedBy: number;
    performedByUsername: string | null;
}

export interface AuditLogResponse {
    data: AuditLogEntry[];
    meta: {
        total: number;
        page: number;
        pageCount: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}

export interface EntityPickerItem {
    id: number;
    businessName: string;
    taxId: string;
}

// =============================================================================
// New Query Hooks — Sessions, Audit, Password, Entity
// =============================================================================

export function useUserSessions(userId: () => number) {
    return createQuery(() => ({
        queryKey: rbacKeys.userSessions(userId()),
        queryFn: () => usersApi.getUserSessions(userId()),
        enabled: userId() > 0,
        staleTime: 1000 * 60,
        gcTime: 1000 * 60 * 5,
    }));
}

export function useUserAuditLog(userId: () => number, page: () => number) {
    return createQuery(() => ({
        queryKey: rbacKeys.userAuditLog(userId(), page()),
        queryFn: () => usersApi.getUserAuditLog(userId(), page()),
        enabled: userId() > 0,
        staleTime: 1000 * 60 * 2,
        placeholderData: keepPreviousData,
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
