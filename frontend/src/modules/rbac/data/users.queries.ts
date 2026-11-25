/**
 * users.queries.ts — TanStack Query v5 `queryOptions` factory + reactive hooks for Users/RBAC.
 * Shared across Router loaders, hover prefetches, next-page prefetches, and UI components.
 */
import { createQuery, keepPreviousData, queryOptions, useQueryClient } from '@tanstack/solid-query';
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';
import { rbacKeys, normalizeUsersFilters } from './users.keys';
import { usersApi } from './users.api';
import type {
    UsersFilters,
    UserReferencesType,
    UserListItemType,
    RoleType,
} from '@app/schema/dto';

// =============================================================================
// Canonical TanStack Query v5 `queryOptions` Factory
// =============================================================================

export const rbacQueries = {
    list: (filters: UsersFilters = {}) => {
        const normalized = normalizeUsersFilters(filters);
        return queryOptions({
            queryKey: rbacKeys.list(normalized),
            queryFn: ({ signal }) => usersApi.listUsersWithRoles(normalized, signal),
            staleTime: STALE_TIME.SHORT,
            gcTime: GC_TIME.DEFAULT,
        });
    },

    facets: (search?: string, columnFilters?: { isActive?: string[]; roles?: string[] }) =>
        queryOptions({
            queryKey: rbacKeys.facets(search, columnFilters),
            queryFn: ({ signal }) => usersApi.getUserFacets(search, columnFilters, signal),
            staleTime: STALE_TIME.MEDIUM,
            gcTime: GC_TIME.DEFAULT,
        }),

    user: (id: string) =>
        queryOptions({
            queryKey: rbacKeys.user(id),
            queryFn: ({ signal }) => usersApi.getUser(id, signal),
            staleTime: STALE_TIME.MEDIUM,
            gcTime: GC_TIME.DEFAULT,
        }),

    roles: () =>
        queryOptions({
            queryKey: rbacKeys.roles(),
            queryFn: ({ signal }) => usersApi.listRoles(signal),
            staleTime: STALE_TIME.MEDIUM,
            gcTime: GC_TIME.DEFAULT,
        }),

    role: (id: number) =>
        queryOptions({
            queryKey: rbacKeys.role(id),
            queryFn: ({ signal }) => usersApi.getRole(id, signal),
            staleTime: STALE_TIME.MEDIUM,
            gcTime: GC_TIME.DEFAULT,
        }),

    permissions: () =>
        queryOptions({
            queryKey: rbacKeys.permissions(),
            queryFn: ({ signal }) => usersApi.listPermissions(signal),
            staleTime: STALE_TIME.LONG,
            gcTime: GC_TIME.DEFAULT,
        }),

    rolePermissions: (roleId: number) =>
        queryOptions({
            queryKey: rbacKeys.rolePermissions(roleId),
            queryFn: ({ signal }) => usersApi.getRolePermissions(roleId, signal),
            staleTime: STALE_TIME.MEDIUM,
            gcTime: GC_TIME.DEFAULT,
        }),

    roleUsers: (roleId: number) =>
        queryOptions({
            queryKey: rbacKeys.roleUsers(roleId),
            queryFn: ({ signal }) => usersApi.getRoleUsers(roleId, signal),
            staleTime: STALE_TIME.SHORT,
            gcTime: GC_TIME.DEFAULT,
        }),
};

// =============================================================================
// Reactive Hooks
// =============================================================================

export function useUserFacets(
    search: () => string | undefined,
    columnFilters?: () => {
        isActive?: string[];
        roles?: string[];
    }
) {
    return createQuery(() => ({
        ...rbacQueries.facets(search(), columnFilters?.()),
        retry: 2,
        placeholderData: keepPreviousData,
    }));
}

export function useUsers(filters: () => UsersFilters, enabled?: () => boolean) {
    return createQuery(() => ({
        ...rbacQueries.list(filters()),
        placeholderData: keepPreviousData,
        enabled: enabled ? enabled() : true,
    }));
}

export function useUser(id: () => string | null | undefined) {
    const queryClient = useQueryClient();

    return createQuery(() => ({
        ...rbacQueries.user(id() ?? ''),
        enabled: Boolean(id()),
        placeholderData: (previousData) => {
            if (previousData) return previousData;
            const targetId = id();
            if (!targetId) return undefined;

            const listQueries = queryClient.getQueriesData<{ data?: UserListItemType[]; meta?: unknown }>({
                queryKey: rbacKeys.lists(),
            });

            for (const [, listData] of listQueries) {
                const items = listData?.data;
                if (!Array.isArray(items)) continue;

                const found = items.find(u => u.id === targetId);
                if (found) {
                    return {
                        id: found.id,
                        username: found.username,
                        email: found.email,
                        image: found.image,
                        isActive: found.isActive,
                        membershipStatus: found.membershipStatus ?? 'ACTIVE',
                        lastLogin: found.lastLogin,
                        entityId: found.entityId,
                        entity: found.entity,
                        roles: found.roles.map(r => ({
                            id: r.id,
                            name: r.name,
                            description: (r.description ?? null) as string | null,
                        })),
                        isGlobalUser: (found as any).isGlobalUser ?? false,
                    };
                }
            }
            return undefined;
        },
    }));
}

export function useRoles() {
    return createQuery(() => ({
        ...rbacQueries.roles(),
        placeholderData: keepPreviousData,
    }));
}

export function useRole(id: () => number | null | undefined) {
    const queryClient = useQueryClient();

    return createQuery(() => ({
        ...rbacQueries.role(id() ?? 0),
        enabled: Boolean(id() && id()! > 0),
        placeholderData: (previousData) => {
            if (previousData) return previousData;
            const roleId = id();
            if (!roleId) return undefined;

            const rolesList = queryClient.getQueryData<RoleType[]>(rbacKeys.roles());
            const found = rolesList?.find(r => r.id === roleId);
            if (found) {
                return {
                    id: found.id,
                    name: found.name,
                    description: found.description,
                    is_system: found.is_system,
                    priority: found.priority ?? 0,
                    createdAt: new Date(),
                    userCount: found.userCount,
                    permissionCount: found.permissionCount,
                };
            }
            return undefined;
        },
    }));
}

export function usePermissions() {
    return createQuery(() => ({
        ...rbacQueries.permissions(),
        placeholderData: keepPreviousData,
    }));
}

export function useRolePermissions(roleId: () => number | null | undefined) {
    return createQuery(() => ({
        ...rbacQueries.rolePermissions(roleId() ?? 0),
        enabled: Boolean(roleId() && roleId()! > 0),
        placeholderData: keepPreviousData,
    }));
}

export function useRoleUsers(roleId: () => number | null | undefined) {
    return createQuery(() => ({
        ...rbacQueries.roleUsers(roleId() ?? 0),
        enabled: Boolean(roleId() && roleId()! > 0),
        placeholderData: keepPreviousData,
    }));
}

export function useUserSessions(userId: () => string | null | undefined) {
    return createQuery(() => ({
        queryKey: rbacKeys.userSessions(userId() ?? ''),
        queryFn: ({ signal }) => usersApi.getUserSessions(userId()!, signal),
        enabled: Boolean(userId()),
        staleTime: 60_000,
        gcTime: STALE_TIME.MEDIUM,
    }));
}

export function useCheckUserReferences(id: () => string | null | undefined, enabled: () => boolean) {
    return createQuery(() => ({
        queryKey: rbacKeys.canDelete(id() ?? ''),
        queryFn: async (): Promise<UserReferencesType> => {
            return await usersApi.canDeleteUser(id()!) as UserReferencesType;
        },
        enabled: enabled() && Boolean(id()),
        staleTime: 10_000,
        gcTime: GC_TIME.PREFLIGHT,
        retry: false,
    }));
}

export function useUserAuditLog(userId: () => string | null | undefined, page: () => number) {
    return createQuery(() => ({
        queryKey: rbacKeys.userAuditLog(userId() ?? '', page()),
        queryFn: ({ signal }) => usersApi.getUserAuditLog(userId()!, page(), 20, signal),
        enabled: Boolean(userId()),
        staleTime: STALE_TIME.SHORT,
        gcTime: STALE_TIME.LONG,
        placeholderData: keepPreviousData,
    }));
}

export function useCheckUserEmail(email: () => string | undefined, enabled: () => boolean = () => true) {
    return createQuery(() => {
        const rawEmail = email()?.trim().toLowerCase() ?? '';
        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail);

        return {
            queryKey: ['rbac', 'users', 'check-email', rawEmail],
            queryFn: ({ signal }) => usersApi.checkEmail(rawEmail, signal),
            enabled: enabled() && isValidEmail,
            staleTime: 30_000,
            gcTime: 60_000,
            retry: false,
        };
    });
}
