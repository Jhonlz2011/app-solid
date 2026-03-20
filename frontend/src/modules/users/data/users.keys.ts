// users/data/users.keys.ts
// Query key factory for TanStack Query cache management

export const rbacKeys = {
    // Base key
    all: ['rbac'] as const,

    // Users list (paginated)
    users: () => [...rbacKeys.all, 'users'] as const,
    lists: () => [...rbacKeys.users(), 'list'] as const,
    list: (filters: object) => [...rbacKeys.lists(), filters] as const,
    user: (id: number) => [...rbacKeys.users(), 'detail', id] as const,

    // Roles
    roles: () => [...rbacKeys.all, 'roles'] as const,
    role: (id: number) => [...rbacKeys.roles(), 'detail', id] as const,
    rolePermissions: (roleId: number) => [...rbacKeys.all, 'role-permissions', roleId] as const,
    roleUsers: (roleId: number) => [...rbacKeys.all, 'role-users', roleId] as const,

    // Permissions
    permissions: () => [...rbacKeys.all, 'permissions'] as const,
};
