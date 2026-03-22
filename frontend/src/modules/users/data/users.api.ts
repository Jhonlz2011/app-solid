/**
 * users.api.ts — Unified Data API
 *
 * Contains strictly the Eden API fetchers for the Users module.
 */
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { 
    RoleBody, 
    UsersFilters, 
    UserSession, 
    EntityPickerItem,
    AuditLogResponse,
} from '../models/users.types';

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

    // ─── User Audit Log ──────────────────────────────────────────
    getUserAuditLog: async (userId: number, page = 1, limit = 20): Promise<AuditLogResponse> => {
        const userPath = api.api.rbac.users({ id: userId }) as any;
        const { data, error } = await userPath['audit-log'].get({ query: { page, limit } });
        if (error) throwApiError(error);
        return data as AuditLogResponse;
    },
};
