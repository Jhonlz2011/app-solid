// users/data/users.api.ts
// Pure API functions using Eden treaty client - Types inferred from backend
import { api } from '@shared/lib/eden';

// Type utilities - Extract body types from Eden
type RoleBody = Parameters<typeof api.api.rbac.roles.post>[0];

export const usersApi = {
    // Roles
    listRoles: async () => {
        const { data, error } = await api.api.rbac.roles.get();
        if (error) throw new Error(String(error.value));
        return data!;
    },

    getRole: async (id: number) => {
        const { data, error } = await api.api.rbac.roles({ id }).get();
        if (error) throw new Error(String(error.value));
        return data!;
    },

    createRole: async (body: RoleBody) => {
        const { data, error } = await api.api.rbac.roles.post(body);
        if (error) throw new Error(String(error.value));
        return data!;
    },

    updateRole: async (id: number, body: RoleBody) => {
        const { data, error } = await api.api.rbac.roles({ id }).put(body);
        if (error) throw new Error(String(error.value));
        return data!;
    },

    deleteRole: async (id: number) => {
        const { data, error } = await api.api.rbac.roles({ id }).delete();
        if (error) throw new Error(String(error.value));
        return data!;
    },

    // Permissions
    listPermissions: async () => {
        const { data, error } = await api.api.rbac.permissions.get();
        if (error) throw new Error(String(error.value));
        return data!;
    },

    getRolePermissions: async (roleId: number) => {
        const { data, error } = await api.api.rbac.roles({ id: roleId }).permissions.get();
        if (error) throw new Error(String(error.value));
        return data!;
    },

    updateRolePermissions: async (roleId: number, permissionIds: number[]) => {
        const { data, error } = await api.api.rbac.roles({ id: roleId }).permissions.put({ permissionIds });
        if (error) throw new Error(String(error.value));
        return data!;
    },

    // Users
    listUsersWithRoles: async () => {
        const { data, error } = await api.api.rbac.users.get();
        if (error) throw new Error(String(error.value));
        return data!;
    },

    createUser: async (body: Parameters<typeof api.api.rbac.users.post>[0]) => {
        const { data, error } = await api.api.rbac.users.post(body);
        if (error) throw new Error(String(error.value));
        return data!;
    },

    updateUser: async (id: number, body: Parameters<typeof api.api.rbac.users.put>[0]) => {
        const { data, error } = await api.api.rbac.users({ id }).put(body);
        if (error) throw new Error(String(error.value));
        return data!;
    },

    deleteUser: async (id: number) => {
        const { data, error } = await api.api.rbac.users({ id }).delete();
        if (error) throw new Error(String(error.value));
        return data!;
    },

    assignUserRoles: async (userId: number, roleIds: number[]) => {
        const { data, error } = await api.api.rbac.users({ id: userId }).roles.put({ roleIds });
        if (error) throw new Error(String(error.value));
        return data!;
    },

    // Role Users
    getRoleUsers: async (roleId: number) => {
        const { data, error } = await api.api.rbac.roles({ id: roleId }).users.get();
        if (error) throw new Error(String(error.value));
        return data!;
    },

    removeUserFromRole: async (roleId: number, userId: number) => {
        const { data, error } = await api.api.rbac.roles({ id: roleId }).users({ userId }).delete();
        if (error) throw new Error(String(error.value));
        return data!;
    },
};

// Re-export inferred types for consumers
export type { RoleBody };
