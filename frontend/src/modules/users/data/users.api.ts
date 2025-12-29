// users/data/users.api.ts
// Pure API functions using shared/lib/http
import { request } from '@shared/lib/http';
import type { Role, Permission, PermissionsResponse, UserWithRoles } from '../models/users.types';

export interface RoleUser {
    id: number;
    username: string;
    email: string;
    isActive: boolean | null;
}

export const usersApi = {
    // Roles
    listRoles: (): Promise<Role[]> => {
        return request<Role[]>('/rbac/roles');
    },

    getRole: (id: number): Promise<Role> => {
        return request<Role>(`/rbac/roles/${id}`);
    },

    createRole: (data: { name: string; description?: string }): Promise<Role> => {
        return request<Role>('/rbac/roles', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    updateRole: (id: number, data: { name: string; description?: string }): Promise<Role> => {
        return request<Role>(`/rbac/roles/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    deleteRole: (id: number): Promise<{ success: boolean }> => {
        return request(`/rbac/roles/${id}`, { method: 'DELETE' });
    },

    // Permissions
    listPermissions: (): Promise<PermissionsResponse> => {
        return request<PermissionsResponse>('/rbac/permissions');
    },

    getRolePermissions: (roleId: number): Promise<Permission[]> => {
        return request<Permission[]>(`/rbac/roles/${roleId}/permissions`);
    },

    updateRolePermissions: (roleId: number, permissionIds: number[]): Promise<{ success: boolean }> => {
        return request(`/rbac/roles/${roleId}/permissions`, {
            method: 'PUT',
            body: JSON.stringify({ permissionIds }),
        });
    },

    // Users
    listUsersWithRoles: (): Promise<UserWithRoles[]> => {
        return request<UserWithRoles[]>('/rbac/users');
    },

    createUser: (data: { username: string; email: string; password: string; roleIds?: number[] }): Promise<{ id: number; username: string; email: string }> => {
        return request('/rbac/users', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    updateUser: (id: number, data: { username?: string; email?: string; isActive?: boolean }): Promise<{ id: number; username: string; email: string; isActive: boolean }> => {
        return request(`/rbac/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    deleteUser: (id: number): Promise<{ success: boolean }> => {
        return request(`/rbac/users/${id}`, { method: 'DELETE' });
    },

    assignUserRoles: (userId: number, roleIds: number[]): Promise<{ success: boolean }> => {
        return request(`/rbac/users/${userId}/roles`, {
            method: 'PUT',
            body: JSON.stringify({ roleIds }),
        });
    },

    // Role Users
    getRoleUsers: (roleId: number): Promise<RoleUser[]> => {
        return request<RoleUser[]>(`/rbac/roles/${roleId}/users`);
    },

    removeUserFromRole: (roleId: number, userId: number): Promise<{ success: boolean }> => {
        return request(`/rbac/roles/${roleId}/users/${userId}`, { method: 'DELETE' });
    },
};
