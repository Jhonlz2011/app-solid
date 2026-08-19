import { Type, type Static } from '@sinclair/typebox';

// ============================================================================
// AUTH & TENANT DTOs (TypeBox for Elysia routes)
// ============================================================================

export const AuthRegisterDto = Type.Object({
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

export const AuthUpdateProfileDto = Type.Object({
    username: Type.Optional(Type.String({ minLength: 3 })),
    email: Type.Optional(Type.String({ format: 'email' })),
});

export type AuthRegisterDtoType = Static<typeof AuthRegisterDto>;
export type AuthUpdateProfileDtoType = Static<typeof AuthUpdateProfileDto>;

export const PublicUser = Type.Object({
    id: Type.Union([Type.String(), Type.Number()]),
    companyId: Type.Optional(Type.Number()),
    username: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    email: Type.String(),
    isActive: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    lastLogin: Type.Optional(Type.Union([Type.Date(), Type.Null()])),
    entityId: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    emailVerified: Type.Optional(Type.Boolean()),
    emailVerifiedAt: Type.Optional(Type.Union([Type.Date(), Type.Null(), Type.String(), Type.Boolean()])),
});

export const AuthUserResponse = Type.Composite([
    PublicUser,
    Type.Object({
        companySlug: Type.Union([Type.String(), Type.Null()]),
        roles: Type.Array(Type.String()),
        permissions: Type.Array(Type.String()),
        entity: Type.Optional(Type.Object({
            id: Type.Number(),
            businessName: Type.String(),
            isClient: Type.Boolean(),
            isSupplier: Type.Boolean(),
            isEmployee: Type.Boolean(),
        })),
    })
]);

export const DiscoverTenantItem = Type.Object({
    id: Type.Number(),
    slug: Type.String(),
    businessName: Type.String(),
    tradeName: Type.Union([Type.String(), Type.Null()]),
    logoUrl: Type.Union([Type.String(), Type.Null()]),
});

export type DiscoverTenantItemType = Static<typeof DiscoverTenantItem>;

export type PublicUserType = Static<typeof PublicUser>;
export type AuthUserResponseType = Static<typeof AuthUserResponse>;
