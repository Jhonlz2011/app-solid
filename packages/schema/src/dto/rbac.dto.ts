// ============================================================================
// RBAC Response DTOs — Single source of truth for Users/Roles/Permissions API
// ============================================================================

import type { PaginationMeta, BaseFilters } from './common.dto';

// Includes JOINed entity fields via LEFT JOIN on entities table
export interface UserListItemDto {
    id: number;
    username: string;
    email: string;
    isActive: boolean | null;
    lastLogin: Date | null;
    // LEFT JOIN entities ON auth_users.entity_id = entities.id
    entityId: number | null;
    entityName: string | null;
    entityTaxId: string | null;
    entityIsClient: boolean | null;
    entityIsSupplier: boolean | null;
    entityIsEmployee: boolean | null;
    // Aggregated from authUserRoles + authRoles (per-page batch)
    roles: { id: number; name: string }[];
}

export interface UserDetailDto {
    id: number;
    username: string;
    email: string;
    isActive: boolean | null;
    lastLogin: Date | null;
    entityId: number | null;
    entity: {
        id: number;
        businessName: string;
        taxId: string;
        isClient: boolean;
        isSupplier: boolean;
        isEmployee: boolean;
    } | null;
    roles: { id: number; name: string; description: string | null }[];
}

// --- User Session (from getActiveSessions — auth.service.ts L216-253) ---
export interface UserSessionDto {
    id: string;
    user_agent: string | null;
    ip_address: string | null;
    location: string | null;
    created_at: Date;
    is_current: boolean;
}

export interface UserReferencesDto {
    roles: number;
    activeSessions: number;
    total: number;
    canDelete: boolean;
}

// Real fields from audit_logs table + LEFT JOIN auth_users
export interface AuditLogEntryDto {
    id: string;                          // uuid v7
    tableName: string;
    recordId: string;
    action: string;                      // 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT'
    oldData: unknown;
    newData: unknown;
    ipAddress: string | null;
    createdAt: Date;
    userId: number | null;
    performedByUsername: string | null;
}

export interface AuditLogResponseDto {
    data: AuditLogEntryDto[];
    meta: PaginationMeta;
}

export interface RoleDto {
    id: number;
    name: string;
    description: string | null;
    is_system: boolean | null;
    userCount: number;
    permissionCount: number;
}

export interface RoleDetailDto {
    id: number;
    name: string;
    description: string | null;
    is_system: boolean | null;
    priority: number | null;
    created_at: Date;
    permissionCount: number;
    userCount: number;
}

export interface RoleUserDto {
    id: number;
    username: string;
    email: string;
    isActive: boolean | null;
}

export interface PermissionDto {
    id: number;
    module: string;
    action: string;
    slug: string;
    description: string | null;
}

export interface PermissionsResponseDto {
    all: PermissionDto[];
    grouped: Record<string, PermissionDto[]>;
}

export interface RolePermissionDto {
    id: number;
    slug: string;
    description: string | null;
}

export interface SuccessDto {
    success: true;
}

export interface EntityPickerItemDto {
    id: number;
    businessName: string;
    taxId: string;
}

export interface BatchResultDto {
    userId: number;
    success: boolean;
    error?: string;
}

export interface UsersFilters extends BaseFilters {
    isActive?: string[];
    roles?: string[];
}
