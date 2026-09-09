import { Type, type Static } from './typebox';
import { TaxRegimeTypeSchema } from './entities.dto';
import { MENU_ITEM_STATUSES } from '../enums';

// ============================================================================
// MODULES & NAVIGATION
// ============================================================================

export const MenuItemStatusSchema = Type.Union([
    Type.Literal('active'),
    Type.Literal('development'),
    Type.Literal('deprecated'),
]);

export const MenuItemUpdateBodySchema = Type.Object({
    label: Type.Optional(Type.String({ minLength: 1, maxLength: 60 })),
    path_alias: Type.Optional(Type.Union([Type.String({ minLength: 1, maxLength: 120 }), Type.Null()])),
    icon: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    sort_order: Type.Optional(Type.Number()),
    status: Type.Optional(MenuItemStatusSchema),
});

export const MenuItemResponseSchema = Type.Object({
    id: Type.Number(),
    company_id: Type.Union([Type.Number(), Type.Null()]),
    key: Type.String(),
    label: Type.String(),
    icon: Type.Union([Type.String(), Type.Null()]),
    path: Type.Union([Type.String(), Type.Null()]),
    path_alias: Type.Union([Type.String(), Type.Null()]),
    parent_id: Type.Union([Type.Number(), Type.Null()]),
    sort_order: Type.Number(),
    permission_prefix: Type.Union([Type.String(), Type.Null()]),
    status: MenuItemStatusSchema,
});

export const MenuItemReorderItemSchema = Type.Object({
    id: Type.Number(),
    sort_order: Type.Number(),
});

export const MenuItemReorderBodySchema = Type.Object({
    items: Type.Array(MenuItemReorderItemSchema),
});

// ============================================================================
// BRANDING & COMPANY SETTINGS
// ============================================================================

export const CompanySettingsBodySchema = Type.Partial(Type.Object({
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
}));

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

export const CompanyVehicleResponseSchema = Type.Object({
    id: Type.Number(),
    company_id: Type.Number(),
    entity_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    carrier_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    license_plate: Type.String(),
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    is_active: Type.Boolean(),
    created_at: Type.Optional(Type.Union([Type.Date(), Type.String(), Type.Null()])),
    updated_at: Type.Optional(Type.Union([Type.Date(), Type.String(), Type.Null()])),
});

// ============================================================================
// CANONICAL INFERRED TYPES (Single Source of Truth)
// ============================================================================

export type MenuItemUpdateType = Static<typeof MenuItemUpdateBodySchema>;
export type MenuItemResponseType = Static<typeof MenuItemResponseSchema>;
export type MenuItemReorderItemType = Static<typeof MenuItemReorderItemSchema>;
export type MenuItemReorderType = Static<typeof MenuItemReorderBodySchema>;
export type CompanySettingsBodyType = Static<typeof CompanySettingsBodySchema>;
export type UploadLogoBodyType = Static<typeof UploadLogoBodySchema>;
export type UploadLoginBgBodyType = Static<typeof UploadLoginBgBodySchema>;
export type CompanyVehicleItemType = Static<typeof CompanyVehicleResponseSchema>;
