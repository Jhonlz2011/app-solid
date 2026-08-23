/**
 * users.queries.ts — TanStack Query Hooks (read-only) for Users/RBAC module
 *
 * Only `useQuery` / `createQuery` hooks live here.
 * All mutations are in `users.mutations.ts`.
 */
import { createQuery, keepPreviousData } from '@tanstack/solid-query';
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';
import { rbacKeys } from './users.keys';
import { usersApi } from './users.api';
import type {
    UsersFilters,
    UserReferencesType,
    FacetData,
} from '@app/schema/dto';

// =============================================================================
// Entity Picker
// =============================================================================

export function useEntitiesList() {
    return createQuery(() => ({
        queryKey: ['entities', 'list-all'] as const,
        queryFn: () => usersApi.listEntities(),
        staleTime: STALE_TIME.MEDIUM,
        gcTime: GC_TIME.DEFAULT,
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
            const { data, error } = await api.rbac.users.facets.get({
                query: {
                    search: search(),
                    isActive: cf?.isActive?.length ? cf.isActive.join(',') : undefined,
                    roles: cf?.roles?.length ? cf.roles.join(',') : undefined,
                },
            });
            if (error) throwApiError(error);
            return data as unknown as FacetData;
        },
        staleTime: STALE_TIME.MEDIUM,
        gcTime: GC_TIME.DEFAULT,
        retry: 2,
        placeholderData: keepPreviousData,
    }));
}

export function useUsers(filters: () => UsersFilters, enabled?: () => boolean) {
    return createQuery(() => ({
        queryKey: rbacKeys.list(filters()),
        queryFn: () => usersApi.listUsersWithRoles(filters()),
        staleTime: STALE_TIME.SHORT,
        gcTime: GC_TIME.DEFAULT,
        placeholderData: keepPreviousData,
        enabled: enabled ? enabled() : true,
    }));
}

export function useUser(id: () => string | number | null | undefined) {
    return createQuery(() => ({
        queryKey: rbacKeys.user(id() ?? ''),
        queryFn: () => usersApi.getUser(id()!),
        enabled: Boolean(id()),
        staleTime: STALE_TIME.MEDIUM,
        gcTime: GC_TIME.DEFAULT,
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
        staleTime: STALE_TIME.MEDIUM,
        gcTime: GC_TIME.DEFAULT,
        placeholderData: keepPreviousData,
    }));
}

export function useRole(id: () => number | null | undefined) {
    return createQuery(() => ({
        queryKey: rbacKeys.role(id() ?? 0),
        queryFn: () => usersApi.getRole(id()!),
        enabled: Boolean(id() && id()! > 0),
        staleTime: STALE_TIME.MEDIUM,
        gcTime: GC_TIME.DEFAULT,
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
        staleTime: STALE_TIME.LONG,
        gcTime: GC_TIME.DEFAULT,
        placeholderData: keepPreviousData,
    }));
}

export function useRolePermissions(roleId: () => number | null | undefined) {
    return createQuery(() => ({
        queryKey: rbacKeys.rolePermissions(roleId() ?? 0),
        queryFn: () => usersApi.getRolePermissions(roleId()!),
        enabled: Boolean(roleId() && roleId()! > 0),
        staleTime: STALE_TIME.MEDIUM,
        placeholderData: keepPreviousData,
    }));
}

export function useRoleUsers(roleId: () => number | null | undefined) {
    return createQuery(() => ({
        queryKey: rbacKeys.roleUsers(roleId() ?? 0),
        queryFn: () => usersApi.getRoleUsers(roleId()!),
        enabled: Boolean(roleId() && roleId()! > 0),
        staleTime: STALE_TIME.SHORT,
        placeholderData: keepPreviousData,
    }));
}

// =============================================================================
// User Detail Queries (Sessions, References, Audit)
// =============================================================================

export function useUserSessions(userId: () => string | number | null | undefined) {
    return createQuery(() => ({
        queryKey: rbacKeys.userSessions(userId() ?? ''),
        queryFn: () => usersApi.getUserSessions(userId()!),
        enabled: Boolean(userId()),
        staleTime: 60_000,
        gcTime: STALE_TIME.MEDIUM,
    }));
}

export function useCheckUserReferences(id: () => string | number | null | undefined, enabled: () => boolean) {
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

export function useUserAuditLog(userId: () => string | number | null | undefined, page: () => number) {
    return createQuery(() => ({
        queryKey: rbacKeys.userAuditLog(userId() ?? '', page()),
        queryFn: () => usersApi.getUserAuditLog(userId()!, page()),
        enabled: Boolean(userId()),
        staleTime: STALE_TIME.SHORT,
        gcTime: STALE_TIME.LONG,
        placeholderData: keepPreviousData,
    }));
}
