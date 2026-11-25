/**
 * users.api.ts — Unified Data API with AbortSignal cancellation support
 */
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { RoleBodyType, UsersFilters, FacetData } from '@app/schema/dto';
import type { PermissionSlug } from '@app/schema/enums';

export const usersApi = {
    // ─── Roles ───────────────────────────────────────────────────
    listRoles: async (signal?: AbortSignal) => {
        const { data, error } = await api.rbac.roles.get({ fetch: { signal } });
        if (error) throwApiError(error);
        return data!;
    },

    getRole: async (id: number, signal?: AbortSignal) => {
        const { data, error } = await api.rbac.roles({ id }).get({ fetch: { signal } });
        if (error) throwApiError(error);
        return data!;
    },

    createRole: async (body: RoleBodyType) => {
        const { data, error } = await api.rbac.roles.post(body);
        if (error) throwApiError(error);
        return data!;
    },

    updateRole: async (id: number, body: RoleBodyType) => {
        const { data, error } = await api.rbac.roles({ id }).put(body);
        if (error) throwApiError(error);
        return data!;
    },

    deleteRole: async (id: number) => {
        const { data, error } = await api.rbac.roles({ id }).delete();
        if (error) throwApiError(error);
        return data!;
    },

    // ─── Permissions ─────────────────────────────────────────────
    listPermissions: async (signal?: AbortSignal) => {
        const { data, error } = await api.rbac.permissions.get({ fetch: { signal } });
        if (error) throwApiError(error);
        return data!;
    },

    getRolePermissions: async (roleId: number, signal?: AbortSignal) => {
        const { data, error } = await api.rbac.roles({ id: roleId }).permissions.get({ fetch: { signal } });
        if (error) throwApiError(error);
        return data!;
    },

    updateRolePermissions: async (roleId: number, permissionSlugs: PermissionSlug[]) => {
        const { data, error } = await api.rbac.roles({ id: roleId }).permissions.put({ permissionSlugs });
        if (error) throwApiError(error);
        return data!;
    },

    // ─── Users (paginated + facets) ──────────────────────────────
    listUsersWithRoles: async (filters: UsersFilters = {}, signal?: AbortSignal) => {
        const { data, error } = await api.rbac.users.get({
            query: {
                search: filters.search,
                page: filters.page,
                limit: filters.limit,
                sortBy: filters.sortBy,
                sortOrder: filters.sortOrder,
                isActive: filters.isActive?.length ? filters.isActive.join(',') : undefined,
                roles: filters.roles?.length ? filters.roles.join(',') : undefined,
            },
            fetch: { signal },
        });
        if (error) throwApiError(error);
        return data!;
    },

    getUserFacets: async (
        search?: string,
        columnFilters?: { isActive?: string[]; roles?: string[] },
        signal?: AbortSignal,
    ): Promise<FacetData> => {
        const { data, error } = await api.rbac.users.facets.get({
            query: {
                search: search || undefined,
                isActive: columnFilters?.isActive?.length ? columnFilters.isActive.join(',') : undefined,
                roles: columnFilters?.roles?.length ? columnFilters.roles.join(',') : undefined,
            },
            fetch: { signal },
        });
        if (error) throwApiError(error);
        return data as unknown as FacetData;
    },

    getUser: async (id: string, signal?: AbortSignal) => {
        const { data, error } = await api.rbac.users({ id }).get({ fetch: { signal } });
        if (error) throwApiError(error);
        return data!;
    },

    checkEmail: async (email: string, signal?: AbortSignal) => {
        const { data, error } = await api.rbac.users['check-email'].get({
            query: { email },
            fetch: { signal },
        });
        if (error) throwApiError(error);
        return data!;
    },

    createUser: async (body: Parameters<typeof api.rbac.users.post>[0]) => {
        const { data, error } = await api.rbac.users.post(body);
        if (error) throwApiError(error);
        return data!;
    },

    resendInvitation: async (userId: string) => {
        const { data, error } = await api.rbac.users({ id: userId })['resend-invitation'].post();
        if (error) throwApiError(error);
        return data!;
    },

    updateUser: async (id: string, body: Parameters<ReturnType<typeof api.rbac.users>['put']>[0]) => {
        const { data, error } = await api.rbac.users({ id }).put(body);
        if (error) throwApiError(error);
        return data!;
    },

    deleteUser: async (id: string) => {
        const { data, error } = await api.rbac.users({ id }).delete();
        if (error) throwApiError(error);
        return data!;
    },

    deactivateUser: async (id: string) => {
        const userPath = api.rbac.users({ id });
        const { error } = await userPath.deactivate.patch();
        if (error) throwApiError(error);
    },

    restoreUser: async (id: string) => {
        const userPath = api.rbac.users({ id });
        const { error } = await userPath.restore.patch();
        if (error) throwApiError(error);
    },

    hardDeleteUser: async (id: string) => {
        const userPath = api.rbac.users({ id });
        const { error } = await userPath.delete();
        if (error) throwApiError(error);
    },

    canDeleteUser: async (id: string) => {
        const userPath = api.rbac.users({ id });
        const { data, error } = await userPath['can-delete'].get();
        if (error) throwApiError(error);
        return data!;
    },

    // ─── User Roles ──────────────────────────────────────────────
    assignUserRoles: async (userId: string, roleIds: number[]) => {
        const { data, error } = await api.rbac.users({ id: userId }).roles.put({ roleIds });
        if (error) throwApiError(error);
        return data!;
    },

    // ─── Role Users ──────────────────────────────────────────────
    getRoleUsers: async (roleId: number, signal?: AbortSignal) => {
        const { data, error } = await api.rbac.roles({ id: roleId }).users.get({ fetch: { signal } });
        if (error) throwApiError(error);
        return data!;
    },

    removeUserFromRole: async (roleId: number, userId: string) => {
        const { data, error } = await api.rbac.roles({ id: roleId }).users({ userId }).delete();
        if (error) throwApiError(error);
        return data!;
    },

    bulkDeactivateUsers: async (ids: string[]) => {
        const { data, error } = await api.rbac.users.bulk.delete.post({ ids });
        if (error) throwApiError(error);
        return data!;
    },

    bulkRestoreUsers: async (ids: string[]) => {
        const { data, error } = await api.rbac.users.bulk.restore.patch({ ids });
        if (error) throwApiError(error);
        return data!;
    },

    // ─── User Sessions (Admin) ───────────────────────────────────
    getUserSessions: async (userId: string, signal?: AbortSignal) => {
        const userPath = api.rbac.users({ id: userId });
        const { data, error } = await userPath.sessions.get({ fetch: { signal } });
        if (error) throwApiError(error);
        return data!;
    },

    revokeUserSession: async (userId: string, sessionId: string) => {
        const userPath = api.rbac.users({ id: userId });
        const { data, error } = await userPath.sessions({ sessionId }).delete();
        if (error) throwApiError(error);
        return data!;
    },

    // ─── Admin Password Reset ────────────────────────────────────
    adminResetPassword: async (userId: string) => {
        const userPath = api.rbac.users({ id: userId });
        const { data, error } = await userPath['reset-password'].post({});
        if (error) throwApiError(error);
        return data!;
    },

    // ─── User Entity Assignment ──────────────────────────────────
    setUserEntity: async (userId: string, entityId: string | null) => {
        const userPath = api.rbac.users({ id: userId });
        const { data, error } = await userPath.entity.patch({ entityId });
        if (error) throwApiError(error);
        return data!;
    },

    // ─── User Audit Log ──────────────────────────────────────────
    getUserAuditLog: async (userId: string, page = 1, limit = 20, signal?: AbortSignal) => {
        const userPath = api.rbac.users({ id: userId });
        const { data, error } = await userPath['audit-log'].get({ query: { page, limit }, fetch: { signal } });
        if (error) throwApiError(error);
        return data!;
    },
};
