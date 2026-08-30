import { Type, type Static } from '@sinclair/typebox';
import { RBAC_MODULES, RBAC_ACTIONS } from '../enums';
import { PaginationMetaSchema, PaginationQuerySchema, type BaseFilters, type PaginationQueryType } from './common.dto';
import { type UserSessionType } from './profile.dto';

// ============================================================================
// RBAC, ROLES & USERS
// ============================================================================

export interface UsersFilters extends BaseFilters {
    isActive?: string[];
    roles?: string[];
}

export const PermissionSlugSchema = Type.Union(
    RBAC_MODULES.flatMap(m =>
        RBAC_ACTIONS.map(a => Type.Literal(`${m}.${a}` as const))
    )
);

export const PermissionSchema = Type.Object({
    id: Type.Number(),
    module: Type.String(),
    action: Type.String(),
    slug: Type.String(),
    description: Type.Union([Type.String(), Type.Null()]),
});

export const PermissionsResponseSchema = Type.Object({
    all: Type.Array(PermissionSchema),
    grouped: Type.Record(Type.String(), Type.Array(PermissionSchema)),
});

export const RolePermissionSchema = Type.Object({
    id: Type.Number(),
    slug: Type.String(),
    description: Type.Union([Type.String(), Type.Null()]),
});

export const RoleResponseSchema = Type.Object({
    id: Type.Number(),
    name: Type.String(),
    description: Type.Union([Type.String(), Type.Null()]),
    is_system: Type.Union([Type.Boolean(), Type.Null()]),
    userCount: Type.Number(),
    permissionCount: Type.Number(),
});

export const RoleDetailResponseSchema = Type.Object({
    id: Type.Number(),
    name: Type.String(),
    description: Type.Union([Type.String(), Type.Null()]),
    is_system: Type.Union([Type.Boolean(), Type.Null()]),
    priority: Type.Union([Type.Number(), Type.Null()]),
    created_at: Type.Date(),
    permissionCount: Type.Number(),
    userCount: Type.Number(),
});

export const RoleUserResponseSchema = Type.Object({
    id: Type.String(),
    username: Type.String(),
    email: Type.String(),
    isActive: Type.Union([Type.Boolean(), Type.Null()]),
});

export const RoleBodySchema = Type.Object({
    name: Type.String({ minLength: 2 }),
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export const RolePermissionsUpdateBodySchema = Type.Object({
    permissionIds: Type.Array(Type.Number()),
});

export const UserRoleReferenceSchema = Type.Object({
    id: Type.Number(),
    name: Type.String(),
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export const UserEntityReferenceSchema = Type.Object({
    id: Type.String(),
    businessName: Type.String(),
    taxId: Type.String(),
    isClient: Type.Boolean(),
    isSupplier: Type.Boolean(),
    isEmployee: Type.Boolean(),
});

export const UserListItemResponseSchema = Type.Object({
    id: Type.String(),
    username: Type.String(),
    email: Type.String(),
    isActive: Type.Union([Type.Boolean(), Type.Null()]),
    lastLogin: Type.Union([Type.Date(), Type.Null()]),
    entityId: Type.Union([Type.String(), Type.Null()]),
    entity: Type.Union([UserEntityReferenceSchema, Type.Null()]),
    roles: Type.Array(UserRoleReferenceSchema),
});

export const UserDetailResponseSchema = Type.Object({
    id: Type.String(),
    username: Type.String(),
    email: Type.String(),
    isActive: Type.Union([Type.Boolean(), Type.Null()]),
    lastLogin: Type.Union([Type.Date(), Type.Null()]),
    entityId: Type.Union([Type.String(), Type.Null()]),
    entity: Type.Union([UserEntityReferenceSchema, Type.Null()]),
    roles: Type.Array(UserRoleReferenceSchema),
});

export const RbacUserCreateBodySchema = Type.Object({
    email: Type.String({ format: 'email' }),
    username: Type.Optional(Type.String({ minLength: 2 })),
    password: Type.Optional(Type.String({ minLength: 8 })),
    roleIds: Type.Optional(Type.Array(Type.Number())),
    entityId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export const RbacUserUpdateBodySchema = Type.Object({
    roleIds: Type.Optional(Type.Array(Type.Number())),
    entityId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    isActive: Type.Optional(Type.Boolean()),
    username: Type.Optional(Type.String({ minLength: 2 })),
    email: Type.Optional(Type.String({ format: 'email' })),
});

export const RbacUserResetPasswordBodySchema = Type.Object({
    newPassword: Type.String({ minLength: 8 }),
});

export const RbacUserAssignEntityBodySchema = Type.Object({
    entityId: Type.Union([Type.String(), Type.Null()]),
});

export const UserRolesAssignBodySchema = Type.Object({
    roleIds: Type.Array(Type.Number()),
});

export const UserReferencesResponseSchema = Type.Object({
    roles: Type.Number(),
    activeSessions: Type.Number(),
    total: Type.Number(),
    canDelete: Type.Boolean(),
});

export const BatchResultItemSchema = Type.Object({
    userId: Type.String(),
    success: Type.Boolean(),
    error: Type.Optional(Type.String()),
});

export const CheckUserEmailQuerySchema = Type.Object({
    email: Type.String({ format: 'email' }),
});

export const CheckUserEmailResponseSchema = Type.Object({
    exists: Type.Boolean(),
    username: Type.Optional(Type.String()),
    displayUsername: Type.Optional(Type.String()),
    name: Type.Optional(Type.String()),
    isAlreadyMember: Type.Boolean(),
});

export const UserFacetsQuerySchema = Type.Object({
    search: Type.Optional(Type.String()),
    isActive: Type.Optional(Type.String()),
    roles: Type.Optional(Type.String()),
});

export const UserListQuerySchema = Type.Composite([
    PaginationQuerySchema,
    Type.Object({
        isActive: Type.Optional(Type.String()),
        roles: Type.Optional(Type.String()),
    }),
]);

export const AuditLogEntrySchema = Type.Object({
    id: Type.String(),
    tableName: Type.String(),
    recordId: Type.String(),
    action: Type.String(),
    oldData: Type.Any(),
    newData: Type.Any(),
    ipAddress: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.Date(),
    userId: Type.Union([Type.String(), Type.Number(), Type.Null()]),
    performedByUsername: Type.Union([Type.String(), Type.Null()]),
});

export const AuditLogResponseSchema = Type.Object({
    data: Type.Array(AuditLogEntrySchema),
    meta: PaginationMetaSchema,
});

// ============================================================================
// CANONICAL INFERRED TYPES (Single Source of Truth)
// ============================================================================

export type PermissionSlugType = Static<typeof PermissionSlugSchema>;
export type PermissionType = Static<typeof PermissionSchema>;
export type PermissionsDetailType = Static<typeof PermissionsResponseSchema>;
export type RolePermissionType = Static<typeof RolePermissionSchema>;

export type RoleType = Static<typeof RoleResponseSchema>;
export type RoleDetailType = Static<typeof RoleDetailResponseSchema>;
export type RoleUserType = Static<typeof RoleUserResponseSchema>;

export type RoleBodyType = Static<typeof RoleBodySchema>;
export type RolePermissionsUpdateType = Static<typeof RolePermissionsUpdateBodySchema>;

export type UserListItemType = Static<typeof UserListItemResponseSchema>;
export type UserDetailType = Static<typeof UserDetailResponseSchema>;
export type UserEntityReferenceType = Static<typeof UserEntityReferenceSchema>;

export type RbacUserCreateType = Static<typeof RbacUserCreateBodySchema>;
export type RbacUserUpdateType = Static<typeof RbacUserUpdateBodySchema>;
export type RbacUserResetPasswordType = Static<typeof RbacUserResetPasswordBodySchema>;
export type RbacUserAssignEntityType = Static<typeof RbacUserAssignEntityBodySchema>;

export type UserRolesAssignType = Static<typeof UserRolesAssignBodySchema>;
export type { UserSessionType };

export type UserReferencesType = Static<typeof UserReferencesResponseSchema>;

export type CheckUserEmailResponseType = Static<typeof CheckUserEmailResponseSchema>;

export type BatchResultItemType = Static<typeof BatchResultItemSchema>;

export type UserAuditLogQueryType = PaginationQueryType;
export type UserFacetsQueryType = Static<typeof UserFacetsQuerySchema>;
export type UserListQueryType = Static<typeof UserListQuerySchema>;

export type AuditLogEntryType = Static<typeof AuditLogEntrySchema>;

export type AuditLogResponseType = Static<typeof AuditLogResponseSchema>;