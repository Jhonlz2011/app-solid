import { Type, type Static } from '@sinclair/typebox';
import { RBAC_MODULES, RBAC_ACTIONS } from '../enums';

// ============================================================================
// RBAC, ROLES & USERS
// ============================================================================

export const PermissionSlugSchema = Type.Union(
    RBAC_MODULES.flatMap(m =>
        RBAC_ACTIONS.map(a => Type.Literal(`${m}.${a}` as const))
    )
);

export const RoleBodySchema = Type.Object({
    name: Type.String({ minLength: 2 }),
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export const RolePermissionsUpdateSchema = Type.Object({
    permissionIds: Type.Array(Type.Number()),
});

export const RbacUserCreateSchema = Type.Object({
    username: Type.String({ minLength: 2 }),
    email: Type.String({ format: 'email' }),
    password: Type.String({ minLength: 8 }),
    roleIds: Type.Optional(Type.Array(Type.Number())),
});

export const RbacUserUpdateSchema = Type.Object({
    username: Type.Optional(Type.String({ minLength: 2 })),
    email: Type.Optional(Type.String({ format: 'email' })),
    isActive: Type.Optional(Type.Boolean()),
});

export const RbacUserResetPasswordSchema = Type.Object({
    newPassword: Type.String({ minLength: 8 }),
});

export const RbacUserAssignEntitySchema = Type.Object({
    entityId: Type.Union([Type.Number(), Type.Null()]),
});

export const UserRolesAssignSchema = Type.Object({
    roleIds: Type.Array(Type.Number()),
});

export const UserSessionItemSchema = Type.Object({
    id: Type.String(),
    user_agent: Type.Union([Type.String(), Type.Null()]),
    ip_address: Type.Union([Type.String(), Type.Null()]),
    location: Type.Union([Type.String(), Type.Null()]),
    created_at: Type.Date(),
    is_current: Type.Boolean(),
});

export const UserReferencesResponseSchema = Type.Object({
    roles: Type.Number(),
    activeSessions: Type.Number(),
    total: Type.Number(),
    canDelete: Type.Boolean(),
});

export const BatchResultItemSchema = Type.Object({
    userId: Type.Number(),
    success: Type.Boolean(),
    error: Type.Optional(Type.String()),
});

export const UserAuditLogQuerySchema = Type.Object({
    page: Type.Optional(Type.Number()),
    limit: Type.Optional(Type.Number()),
});

export const UserFacetsQuerySchema = Type.Object({
    search: Type.Optional(Type.String()),
    isActive: Type.Optional(Type.String()),
    roles: Type.Optional(Type.String()),
});

export const UserListQuerySchema = Type.Object({
    search: Type.Optional(Type.String()),
    page: Type.Optional(Type.Number()),
    limit: Type.Optional(Type.Number()),
    sortBy: Type.Optional(Type.String()),
    sortOrder: Type.Optional(Type.String()),
    isActive: Type.Optional(Type.String()),
    roles: Type.Optional(Type.String()),
});

export const AuditLogEntrySchema = Type.Object({
    id: Type.String(),
    tableName: Type.String(),
    recordId: Type.String(),
    action: Type.String(),
    oldData: Type.Any(),
    newData: Type.Any(),
    ipAddress: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.Date(),
    userId: Type.Union([Type.Number(), Type.Null()]),
    performedByUsername: Type.Union([Type.String(), Type.Null()]),
});

export const AuditLogResponseSchema = Type.Object({
    data: Type.Array(AuditLogEntrySchema),
    meta: Type.Object({
        total: Type.Number(),
        page: Type.Number(),
        pageCount: Type.Number(),
    }),
});

export type PermissionSlugType = Static<typeof PermissionSlugSchema>;
export type RoleBodyType = Static<typeof RoleBodySchema>;
export type RolePermissionsUpdateType = Static<typeof RolePermissionsUpdateSchema>;
export type RbacUserCreateType = Static<typeof RbacUserCreateSchema>;
export type RbacUserUpdateType = Static<typeof RbacUserUpdateSchema>;
export type RbacUserResetPasswordType = Static<typeof RbacUserResetPasswordSchema>;
export type RbacUserAssignEntityType = Static<typeof RbacUserAssignEntitySchema>;
export type UserRolesAssignType = Static<typeof UserRolesAssignSchema>;
export type UserSessionItemType = Static<typeof UserSessionItemSchema>;
export type UserReferencesResponseType = Static<typeof UserReferencesResponseSchema>;
export type BatchResultItemType = Static<typeof BatchResultItemSchema>;
export type UserAuditLogQueryType = Static<typeof UserAuditLogQuerySchema>;
export type UserFacetsQueryType = Static<typeof UserFacetsQuerySchema>;
export type UserListQueryType = Static<typeof UserListQuerySchema>;
export type AuditLogEntryType = Static<typeof AuditLogEntrySchema>;
export type AuditLogResponseType = Static<typeof AuditLogResponseSchema>;
