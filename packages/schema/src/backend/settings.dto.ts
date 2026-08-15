import { Type, type Static } from './typebox';
import { TaxRegimeTypeSchema } from './entities.dto';

// ============================================================================
// MODULES & NAVIGATION
// ============================================================================

export const MenuItemUpdateSchema = Type.Object({
    label: Type.Optional(Type.String()),
    icon: Type.Optional(Type.String()),
    sort_order: Type.Optional(Type.Number()),
});

export const MenuItemReorderItemSchema = Type.Object({
    id: Type.Number(),
    sort_order: Type.Number(),
});

export const MenuItemReorderSchema = Type.Object({
    items: Type.Array(MenuItemReorderItemSchema),
});

export type MenuItemUpdateType = Static<typeof MenuItemUpdateSchema>;
export type MenuItemReorderItemType = Static<typeof MenuItemReorderItemSchema>;
export type MenuItemReorderType = Static<typeof MenuItemReorderSchema>;

// ============================================================================
// BRANDING & COMPANY SETTINGS
// ============================================================================

export const TenantBrandingResponseDto = Type.Object({
    id: Type.Number(),
    slug: Type.String(),
    businessName: Type.String(),
    tradeName: Type.Union([Type.String(), Type.Null()]),
    logoUrl: Type.Union([Type.String(), Type.Null()]),
    primaryColor: Type.String(),
    themeColor: Type.String(),
    loginBgUrl: Type.Union([Type.String(), Type.Null()]),
});

export const CompanySettingsBodySchema = Type.Object({
    logoUrl: Type.Union([Type.String(), Type.Null()]),
    loginBgUrl: Type.Union([Type.String(), Type.Null()]),
    primaryColor: Type.String({ minLength: 4 }),
    themeColor: Type.String({ minLength: 4 }),
    businessName: Type.String({ minLength: 3 }),
    tradeName: Type.Union([Type.String(), Type.Null()]),
    ruc: Type.String({ minLength: 13, maxLength: 13 }),
    mainAddress: Type.String({ minLength: 5 }),
    businessType: Type.Union([Type.String(), Type.Null()]),
    email: Type.Union([Type.String(), Type.Null()]),
    phone: Type.Union([Type.String(), Type.Null()]),
    obligadoContabilidad: Type.Boolean(),
    contribuyenteEspecial: Type.Union([Type.String(), Type.Null()]),
    agenteRetencion: Type.Union([Type.String(), Type.Null()]),
    rimpeType: Type.Union([TaxRegimeTypeSchema, Type.Null()]),
    sriEnvironment: Type.Union([Type.Literal('1'), Type.Literal('2')]),
});

export const UploadLogoBodySchema = Type.Object({
    file: Type.File({
        maxSize: '5m',
        type: ['image/jpeg', 'image/png', 'image/webp'],
    }),
});

export const UploadLoginBgBodySchema = Type.Object({
    file: Type.File({
        maxSize: '10m',
        type: ['image/jpeg', 'image/png', 'image/webp'],
    }),
    cropX: Type.Optional(Type.Number()),
    cropY: Type.Optional(Type.Number()),
    cropWidth: Type.Optional(Type.Number()),
    cropHeight: Type.Optional(Type.Number()),
    cropRotate: Type.Optional(Type.Number()),
    cropFlipX: Type.Optional(Type.BooleanString()),
    cropFlipY: Type.Optional(Type.BooleanString()),
});

export type TenantBrandingResponseDtoType = Static<typeof TenantBrandingResponseDto>;
export type CompanySettingsBodyType = Static<typeof CompanySettingsBodySchema>;
export type UploadLogoBodyType = Static<typeof UploadLogoBodySchema>;
export type UploadLoginBgBodyType = Static<typeof UploadLoginBgBodySchema>;
