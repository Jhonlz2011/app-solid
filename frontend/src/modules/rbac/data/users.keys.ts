import type { UsersFilters } from '@app/schema/dto';

export const DEFAULT_USERS_PAGE_SIZE = 15;

/**
 * Canonical filter normalizer so TanStack Router loaders, hooks, and next-page prefetches
 * ALWAYS produce identical query keys (100% cache hit, 0 duplicate requests).
 */
export function normalizeUsersFilters(filters: UsersFilters = {}): {
    page: number;
    limit: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    isActive?: string[];
    roles?: string[];
} {
    const normalized: {
        page: number;
        limit: number;
        search?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
        isActive?: string[];
        roles?: string[];
    } = {
        page: filters.page ?? 1,
        limit: filters.limit ?? DEFAULT_USERS_PAGE_SIZE,
    };

    const trimmedSearch = filters.search?.trim();
    if (trimmedSearch) normalized.search = trimmedSearch;
    if (filters.sortBy) normalized.sortBy = filters.sortBy;
    if (filters.sortOrder) normalized.sortOrder = filters.sortOrder;
    if (filters.isActive && filters.isActive.length > 0) normalized.isActive = [...filters.isActive].sort();
    if (filters.roles && filters.roles.length > 0) normalized.roles = [...filters.roles].sort();

    return normalized;
}

export function normalizeFacetsFilters(
    search?: string,
    filters?: { isActive?: string[]; roles?: string[] },
) {
    const trimmedSearch = search?.trim() || undefined;
    const isActive = filters?.isActive?.length ? [...filters.isActive].sort() : undefined;
    const roles = filters?.roles?.length ? [...filters.roles].sort() : undefined;
    return { search: trimmedSearch, isActive, roles };
}

/**
 * users.keys.ts — Centralized normalized query keys for Users/RBAC module
 */
export const rbacKeys = {
    all: ['rbac'] as const,

    // Users list (paginated)
    users: () => [...rbacKeys.all, 'users'] as const,
    lists: () => [...rbacKeys.users(), 'list'] as const,
    list: (filters: UsersFilters = {}) => [...rbacKeys.lists(), normalizeUsersFilters(filters)] as const,
    user: (id: string) => [...rbacKeys.users(), 'detail', id] as const,
    userSessions: (id: string) => [...rbacKeys.users(), 'sessions', id] as const,
    userAuditLog: (id: string, page: number) => [...rbacKeys.users(), 'audit-log', id, page] as const,

    // Roles
    roles: () => [...rbacKeys.all, 'roles'] as const,
    role: (id: number) => [...rbacKeys.roles(), 'detail', id] as const,
    rolePermissions: (roleId: number) => [...rbacKeys.all, 'role-permissions', roleId] as const,
    roleUsers: (roleId: number) => [...rbacKeys.all, 'role-users', roleId] as const,

    // Permissions
    permissions: () => [...rbacKeys.all, 'permissions'] as const,

    // Facets
    facetsAll: () => [...rbacKeys.all, 'facets'] as const,
    facets: (search?: string, filters?: { isActive?: string[]; roles?: string[] }) =>
        [...rbacKeys.facetsAll(), normalizeFacetsFilters(search, filters)] as const,

    canDelete: (id: string) => [...rbacKeys.users(), 'can-delete', id] as const,
};
