/**
 * users.keys.ts — Centralized query keys for Users/RBAC module
 */
export const rbacKeys = {
    // Base key
    all: ['rbac'] as const,

    // Users list (paginated)
    users: () => [...rbacKeys.all, 'users'] as const,
    lists: () => [...rbacKeys.users(), 'list'] as const,
    list: (filters: object) => [...rbacKeys.lists(), filters] as const,
    user: (id: number) => [...rbacKeys.users(), 'detail', id] as const,
    userSessions: (id: number) => [...rbacKeys.users(), 'sessions', id] as const,

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
