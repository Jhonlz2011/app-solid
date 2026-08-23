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
    user: (id: string | number) => [...rbacKeys.users(), 'detail', String(id)] as const,
    userSessions: (id: string | number) => [...rbacKeys.users(), 'sessions', String(id)] as const,
    userAuditLog: (id: string | number, page: number) => [...rbacKeys.users(), 'audit-log', String(id), page] as const,

    // Roles
    roles: () => [...rbacKeys.all, 'roles'] as const,
    role: (id: number) => [...rbacKeys.roles(), 'detail', id] as const,
    rolePermissions: (roleId: number) => [...rbacKeys.all, 'role-permissions', roleId] as const,
    roleUsers: (roleId: number) => [...rbacKeys.all, 'role-users', roleId] as const,

    // Permissions
    permissions: () => [...rbacKeys.all, 'permissions'] as const,

    // Facets
    facets: (search?: string, filters?: Record<string, string[] | undefined>) =>
        [...rbacKeys.all, 'facets', { search, filters }] as const,

    canDelete: (id: string | number) => [...rbacKeys.users(), 'can-delete', String(id)] as const,
};
