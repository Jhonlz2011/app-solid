import { Type, type Static } from '@sinclair/typebox';
import { ProfileEntityResponseSchema } from './profile.dto';

// ============================================================================
// TENANTS & SAAS PROVISIONING SCHEMAS (TypeBox for Elysia routes & Eden Treaty)
// Standard: Request Bodies -> *BodySchema, Responses -> *ResponseSchema
// ============================================================================

export const TenantRegisterBodySchema = Type.Object({
    fullName: Type.String({ minLength: 3 }),
    username: Type.String({ minLength: 3, maxLength: 30, pattern: '^[a-z0-9._-]+$' }),
    email: Type.String({ format: 'email' }),
    password: Type.String({ minLength: 8 }),
    phone: Type.Optional(Type.String()),
    cedula: Type.Optional(Type.String()),
    slug: Type.String({ minLength: 3, maxLength: 30, pattern: '^[a-z0-9-]+$' }),
    ruc: Type.String({ minLength: 13, maxLength: 13 }),
    businessName: Type.String({ minLength: 3 }),
    tradeName: Type.Optional(Type.String()),
    businessType: Type.Optional(Type.String()),
    mainAddress: Type.Optional(Type.String()),
    obligadoContabilidad: Type.Optional(Type.Boolean()),
    contribuyenteEspecial: Type.Optional(Type.String()),
    taxRegime: Type.Optional(Type.String()),
    turnstileToken: Type.Optional(Type.String()),
});

export const TenantRegisterUserResponseSchema = Type.Object({
    id: Type.String(),
    companyId: Type.Optional(Type.Number()),
    companySlug: Type.Union([Type.String(), Type.Null()]),
    username: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    email: Type.String(),
    isActive: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    lastLogin: Type.Optional(Type.Union([Type.Date(), Type.Null()])),
    entityId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    emailVerified: Type.Optional(Type.Boolean()),
    emailVerifiedAt: Type.Optional(Type.Union([Type.Date(), Type.Null(), Type.String(), Type.Boolean()])),
    roles: Type.Array(Type.String()),
    permissions: Type.Array(Type.String()),
    entity: Type.Optional(ProfileEntityResponseSchema),
});

export const TenantRegisterResponseSchema = Type.Object({
    company: Type.Object({
        id: Type.Number(),
        slug: Type.String(),
        businessName: Type.String(),
        organizationId: Type.Optional(Type.String()),
    }),
    user: TenantRegisterUserResponseSchema,
});

export const TenantBrandingResponseSchema = Type.Object({
    id: Type.Number(),
    slug: Type.String(),
    businessName: Type.String(),
    tradeName: Type.Union([Type.String(), Type.Null()]),
    logoUrl: Type.Union([Type.String(), Type.Null()]),
    primaryColor: Type.String(),
    themeColor: Type.String(),
    loginBgUrl: Type.Union([Type.String(), Type.Null()]),
});

export const DiscoverTenantItemResponseSchema = Type.Object({
    id: Type.Optional(Type.Number()),
    organizationId: Type.String(),
    slug: Type.String(),
    businessName: Type.String(),
    tradeName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    logoUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

// ============================================================================
// CANONICAL INFERRED TYPES (Single Source of Truth)
// ============================================================================

export type TenantRegisterType = Static<typeof TenantRegisterBodySchema>;
export type TenantRegisterResponseType = Static<typeof TenantRegisterResponseSchema>;
export type TenantBrandingType = Static<typeof TenantBrandingResponseSchema>;
export type DiscoverTenantItemType = Static<typeof DiscoverTenantItemResponseSchema>;
export type AuthUserResponseType = Static<typeof TenantRegisterUserResponseSchema>;