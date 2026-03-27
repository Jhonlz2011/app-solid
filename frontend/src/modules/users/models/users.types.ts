/**
 * users.types.ts — Centralized Types for Users module
 */
import { api } from '@shared/lib/eden';
import type { usersApi } from '../data/users.api';

// Derived from Eden — extended with fields from backend JOINs that Eden can't infer
export type UsersListResponse = Awaited<ReturnType<typeof api.api.rbac.users.get>>['data'];
export type UserListItem = NonNullable<UsersListResponse>['data'][number] & {
    entityName?: string | null;
    entityId?: number | null;
    entityTaxId?: string | null;
    entityIsClient?: boolean | null;
    entityIsSupplier?: boolean | null;
    entityIsEmployee?: boolean | null;
};
export type RoleBase = Awaited<ReturnType<typeof api.api.rbac.roles.get>>['data'];
export type RoleListItem = NonNullable<RoleBase>[number] & { is_system?: boolean | null; permissionCount?: number };
export type RoleBody = Parameters<typeof api.api.rbac.roles.post>[0];

export type UserWithRoles = UserListItem;
export type Role = RoleListItem;
export type Permission = Awaited<ReturnType<typeof usersApi.listPermissions>>['all'][number];
export type PermissionsResponse = Awaited<ReturnType<typeof usersApi.listPermissions>>;
export type RoleUsers = Awaited<ReturnType<typeof usersApi.getRoleUsers>>[number];

export interface UsersMeta {
    total: number;
    page: number;
    pageCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

export interface UsersFilters {
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    isActive?: string[];
    roles?: string[];
}

export interface UserSession {
    id: string;
    user_agent: string | null;
    ip_address: string | null;
    location: string | null;
    created_at: string;
    is_current: boolean;
}

export interface EntityPickerItem {
    id: number;
    businessName: string;
    taxId: string;
}

export type FacetData = Record<string, { value: string; count: number }[]>;

export interface UserReferences {
    roles: number;
    activeSessions: number;
    total: number;
    canDelete: boolean;
}

export const isActiveLabels: Record<string, string> = {
    'true': 'Activo',
    'false': 'Inactivo',
};

export interface AuditLogEntry {
    id: string;
    tableName: string;
    recordId: string;
    action: string;
    oldData: unknown;
    newData: unknown;
    ipAddress: string | null;
    createdAt: string;
    userId: number | null;
    performedByUsername: string | null;
}

export interface AuditLogResponse {
    data: AuditLogEntry[];
    meta: UsersMeta;
}