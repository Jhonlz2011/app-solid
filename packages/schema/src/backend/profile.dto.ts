import { Type, type Static } from '@sinclair/typebox';

// ============================================================================
// PROFILE TYPEBOX SCHEMAS (Elysia Routes & Eden Treaty)
// Standard: Request Bodies -> *BodySchema, Responses -> *ResponseSchema
// ============================================================================

export const ProfileEntityResponseSchema = Type.Object({
    id: Type.String(),
    businessName: Type.String(),
    isClient: Type.Boolean(),
    isSupplier: Type.Boolean(),
    isEmployee: Type.Boolean(),
});

export const ModuleConfigSchema: any = Type.Recursive((Self) =>
    Type.Object({
        key: Type.String(),
        label: Type.String(),
        icon: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        path: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        permission: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        status: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        children: Type.Optional(Type.Array(Self)),
    })
);

export const ProfileResponseSchema = Type.Object({
    id: Type.String(),
    companyId: Type.Number(),
    companySlug: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    email: Type.String({ format: 'email' }),
    username: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    entityId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    isActive: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    lastLogin: Type.Optional(Type.Union([Type.Date(), Type.Null()])),
    emailVerified: Type.Optional(Type.Boolean()),
    emailVerifiedAt: Type.Optional(Type.Union([Type.String(), Type.Date(), Type.Null()])),
    roles: Type.Array(Type.String()),
    permissions: Type.Array(Type.String()),
    entity: Type.Optional(ProfileEntityResponseSchema),
    sessionId: Type.String(),
    modules: Type.Optional(Type.Array(ModuleConfigSchema)),
});

export const UpdateProfileBodySchema = Type.Object({
    username: Type.Optional(Type.String({ minLength: 3 })),
    email: Type.Optional(Type.String({ format: 'email' })),
});

export const UpdateProfileResponseSchema = Type.Object({
    success: Type.Literal(true),
    message: Type.Optional(Type.String()),
    user: Type.Optional(Type.Object({
        id: Type.String(),
        email: Type.String(),
        username: Type.String(),
    })),
});

export const UserSessionResponseSchema = Type.Object({
    id: Type.String(),
    user_agent: Type.Union([Type.String(), Type.Null()]),
    ip_address: Type.Union([Type.String(), Type.Null()]),
    location: Type.Union([Type.String(), Type.Null()]),
    created_at: Type.Date(),
    is_current: Type.Boolean(),
});

// ============================================================================
// CANONICAL INFERRED TYPES (Single Source of Truth)
// ============================================================================

export type UpdateProfileBodyType = Static<typeof UpdateProfileBodySchema>;
export type ProfileEntityType = Static<typeof ProfileEntityResponseSchema>;
export type ProfileType = Static<typeof ProfileResponseSchema>;
export type UpdateProfileType = Static<typeof UpdateProfileResponseSchema>;
export type UserSessionType = Static<typeof UserSessionResponseSchema>;
