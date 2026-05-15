/**
 * users.types.ts — Centralized Types for Users/RBAC module
 *
 * All types re-exported from @app/schema shared DTOs.
 * Module-specific Eden-derived types for body payloads.
 */
import { api } from '@shared/lib/eden';

// ─── Re-exports from shared DTOs (single source of truth) ──────────────────
export type { UserListItemDto as UserListItem } from '@app/schema/rbac-dto';
export type { UserDetailDto as UserDetail } from '@app/schema/rbac-dto';
export type { UserSessionDto as UserSession } from '@app/schema/rbac-dto';
export type { UserReferencesDto as UserReferences } from '@app/schema/rbac-dto';
export type { AuditLogEntryDto as AuditLogEntry } from '@app/schema/rbac-dto';
export type { AuditLogResponseDto as AuditLogResponse } from '@app/schema/rbac-dto';
export type { RoleDto as Role } from '@app/schema/rbac-dto';
export type { RoleDetailDto as RoleDetail } from '@app/schema/rbac-dto';
export type { RoleUserDto as RoleUsers } from '@app/schema/rbac-dto';
export type { PermissionDto as Permission } from '@app/schema/rbac-dto';
export type { PermissionsResponseDto as PermissionsResponse } from '@app/schema/rbac-dto';
export type { EntityPickerItemDto as EntityPickerItem } from '@app/schema/rbac-dto';
export type { PaginationMeta as UsersMeta } from '@app/schema/rbac-dto';
export type { FacetData } from '@app/schema/rbac-dto';
export type { UsersFilters } from '@app/schema/rbac-dto';
export type { SuccessDto } from '@app/schema/rbac-dto';
export type { BatchResultDto } from '@app/schema/rbac-dto';

// ─── Backward compatibility aliases ────────────────────────────────────────
export type { UserListItemDto as UserWithRoles } from '@app/schema/rbac-dto';

// ─── Eden-derived types (body payloads inferred from route contracts) ──────
export type RoleBody = Parameters<typeof api.api.rbac.roles.post>[0];