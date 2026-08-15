import { Type, type Static } from '@sinclair/typebox';

// ============================================================================
// AUTH & TENANT DTOs (TypeBox for Elysia routes)
// ============================================================================

export const AuthRegisterDto = Type.Object({
    fullName: Type.String({ minLength: 3 }),
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

export const AuthLoginDto = Type.Object({
    email: Type.String({ minLength: 1, maxLength: 255 }),
    password: Type.String(),
    companyId: Type.Optional(Type.Number()),
    turnstileToken: Type.Optional(Type.String()),
});

export const AuthChangePasswordDto = Type.Object({
    currentPassword: Type.String(),
    newPassword: Type.String({ minLength: 8 }),
});

export const AuthUpdateProfileDto = Type.Object({
    username: Type.Optional(Type.String({ minLength: 3 })),
    email: Type.Optional(Type.String({ format: 'email' })),
});

export type AuthRegisterDtoType = Static<typeof AuthRegisterDto>;
export type AuthLoginDtoType = Static<typeof AuthLoginDto>;
export type AuthChangePasswordDtoType = Static<typeof AuthChangePasswordDto>;
export type AuthUpdateProfileDtoType = Static<typeof AuthUpdateProfileDto>;

export const PublicUser = Type.Object({
    id: Type.Number(),
    companyId: Type.Number(),
    username: Type.String(),
    email: Type.String(),
    isActive: Type.Union([Type.Boolean(), Type.Null()]),
    lastLogin: Type.Union([Type.Date(), Type.Null()]),
    entityId: Type.Union([Type.Number(), Type.Null()]),
    emailVerifiedAt: Type.Union([Type.Date(), Type.Null(), Type.String()]),
});

export const AuthUserResponse = Type.Composite([
    PublicUser,
    Type.Object({
        companySlug: Type.String(),
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

export const AuthResponseDto = Type.Union([
    Type.Object({
        user: AuthUserResponse,
        sessionId: Type.String(),
    }),
    Type.Object({
        requiresTenantSelection: Type.Literal(true),
        tenants: Type.Array(DiscoverTenantItem),
    })
]);

export type PublicUserType = Static<typeof PublicUser>;
export type AuthUserResponseType = Static<typeof AuthUserResponse>;
export type AuthResponseDtoType = Static<typeof AuthResponseDto>;
