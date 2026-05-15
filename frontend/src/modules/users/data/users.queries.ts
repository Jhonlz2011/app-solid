/**
 * users.queries.ts — TanStack Query Hooks (read-only) for Users/RBAC module
 *
 * Only `useQuery` / `createQuery` hooks live here.
 * All mutations are in `users.mutations.ts`.
 */
import { createQuery, keepPreviousData } from '@tanstack/solid-query';
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import { rbacKeys } from './users.keys';
import { usersApi } from './users.api';
import type {
    UsersFilters,
    FacetData,
    UserReferences,
} from '../models/users.types';

// =============================================================================
// Entity Picker
// =============================================================================

export function useEntitiesList() {
    return createQuery(() => ({
        queryKey: ['entities', 'list-all'] as const,
        queryFn: () => usersApi.listEntities(),
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
    }));
}

// =============================================================================
// User Queries
// =============================================================================

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

export function useUsers(filters: () => UsersFilters, enabled?: () => boolean) {
    return createQuery(() => ({
        queryKey: rbacKeys.list(filters()),
        queryFn: () => usersApi.listUsersWithRoles(filters()),
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 30,
        placeholderData: keepPreviousData,
        enabled: enabled ? enabled() : true,
    }));
}

export function useUser(id: () => number | null) {
    return createQuery(() => ({
        queryKey: rbacKeys.user(id() ?? 0),
        queryFn: () => usersApi.getUser(id()!),
        enabled: id() !== null && id()! > 0,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        placeholderData: keepPreviousData,
    }));
}

// =============================================================================
// Role Queries
// =============================================================================

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
        placeholderData: keepPreviousData,
    }));
}

// =============================================================================
// Permission Queries
// =============================================================================

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
// User Detail Queries (Sessions, References, Audit)
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

export function useCheckUserReferences(id: () => number | null, enabled: () => boolean) {
    return createQuery(() => ({
        queryKey: rbacKeys.canDelete(id()!),
        queryFn: async (): Promise<UserReferences> => {
            return await usersApi.canDeleteUser(id()!) as UserReferences;
        },
        enabled: enabled() && id() !== null,
        staleTime: 10_000,
        gcTime: 30_000,
        retry: false,
    }));
}

export function useUserAuditLog(userId: () => number, page: () => number) {
    return createQuery(() => ({
        queryKey: rbacKeys.userAuditLog(userId(), page()),
        queryFn: () => usersApi.getUserAuditLog(userId(), page()),
        enabled: userId() > 0,
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 10,
        placeholderData: keepPreviousData,
    }));
}
