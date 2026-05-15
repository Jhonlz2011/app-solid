// ============================================================================
// RBAC Response DTOs — Single source of truth for Users/Roles/Permissions API
// Derived from rbac.service.ts and auth.service.ts actual return shapes
// ============================================================================

import type { PaginationMeta, BaseFilters } from './shared.dto';

// Re-export shared types for convenience
export type { PaginationMeta, FacetData, BaseFilters } from './shared.dto';

// --- User List Item (from getAllUsersWithRoles — rbac.service.ts L399-448) ---
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

// --- User Detail (from getUserById — rbac.service.ts L531-570) ---
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

// --- User References (from checkUserReferences — rbac.service.ts L907-921) ---
export interface UserReferencesDto {
    roles: number;
    activeSessions: number;
    total: number;
    canDelete: boolean;
}

// --- Audit Log Entry (from getUserAuditLog — rbac.service.ts L954-993) ---
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

// --- Role (from getAllRoles — rbac.service.ts L154-181) ---
export interface RoleDto {
    id: number;
    name: string;
    description: string | null;
    is_system: boolean | null;
    userCount: number;
    permissionCount: number;
}

// --- Role Detail (from getRoleById — rbac.service.ts L575-592) ---
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

// --- Role Users (from getUsersByRole — rbac.service.ts L722-734) ---
export interface RoleUserDto {
    id: number;
    username: string;
    email: string;
    isActive: boolean | null;
}

// --- Permissions (from getAllPermissions — rbac.service.ts L253-273) ---
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

// --- Role Permission (from getRolePermissions — rbac.service.ts L278-290) ---
export interface RolePermissionDto {
    id: number;
    slug: string;
    description: string | null;
}

// --- Success response (deactivate, restore, hardDelete, assignRoles, etc.) ---
export interface SuccessDto {
    success: true;
}

// --- Entity Picker (shared across modules for entity selection) ---
export interface EntityPickerItemDto {
    id: number;
    businessName: string;
    taxId: string;
}

// --- Batch operation result ---
export interface BatchResultDto {
    userId: number;
    success: boolean;
    error?: string;
}

// --- Users Filters (extends BaseFilters with RBAC-specific fields) ---
export interface UsersFilters extends BaseFilters {
    isActive?: string[];
    roles?: string[];
}
