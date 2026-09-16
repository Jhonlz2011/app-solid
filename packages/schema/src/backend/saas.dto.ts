import { Type, type Static } from '@sinclair/typebox';

// ============================================================================
// SAAS CATALOGS & COMMERCE DTOs
// ============================================================================

export const SaasPlanFeatureSchema = Type.Object({
    code: Type.String(),
    name: Type.String(),
    category: Type.String(),
    value: Type.Union([Type.Boolean(), Type.Number(), Type.String()]),
    unit_label: Type.Union([Type.String(), Type.Null()]),
});
export type SaasPlanFeatureType = Static<typeof SaasPlanFeatureSchema>;

export const SaasPlanItemSchema = Type.Object({
    id: Type.String(),
    name: Type.String(),
    description: Type.Union([Type.String(), Type.Null()]),
    interval: Type.String(),
    price_usd: Type.Union([Type.String(), Type.Number()]),
    annual_discount_percent: Type.Number(),
    is_popular: Type.Boolean(),
    is_public: Type.Optional(Type.Boolean()),
    sort_order: Type.Number(),
    features: Type.Record(Type.String(), Type.Union([Type.Boolean(), Type.Number(), Type.String()])),
    feature_details: Type.Optional(Type.Array(SaasPlanFeatureSchema)),
});
export type SaasPlanItemType = Static<typeof SaasPlanItemSchema>;

export const SaasPlansResponseSchema = Type.Array(SaasPlanItemSchema);

export const SaasAddonItemSchema = Type.Object({
    id: Type.String(),
    name: Type.String(),
    description: Type.Union([Type.String(), Type.Null()]),
    addon_type: Type.String(),
    billing_type: Type.String(),
    price_usd: Type.Union([Type.String(), Type.Number()]),
    quantity: Type.Number(),
    unit_label: Type.Union([Type.String(), Type.Null()]),
});
export type SaasAddonItemType = Static<typeof SaasAddonItemSchema>;

export const SaasAddonsResponseSchema = Type.Array(SaasAddonItemSchema);

export const SaasDocumentPackItemSchema = Type.Object({
    id: Type.String(),
    name: Type.String(),
    document_count: Type.Number(),
    price_usd: Type.Union([Type.String(), Type.Number()]),
    unit_cost_usd: Type.Union([Type.String(), Type.Number()]),
    is_popular: Type.Boolean(),
});
export type SaasDocumentPackItemType = Static<typeof SaasDocumentPackItemSchema>;

export const SaasDocumentPacksResponseSchema = Type.Array(SaasDocumentPackItemSchema);

// ============================================================================
// TENANT SUBSCRIPTION & USAGE DTOs
// ============================================================================

export const TenantSubscriptionUsersSchema = Type.Object({
    active: Type.Number(),
    max: Type.Number(),
    hasFreeAccountantSeat: Type.Boolean(),
    accountantAssigned: Type.Boolean(),
});

export const TenantSubscriptionSriSchema = Type.Object({
    monthlyLimit: Type.Number(),
    monthlyUsed: Type.Number(),
    prepaidBalance: Type.Number(),
    unlimited: Type.Boolean(),
});

export const TenantSubscriptionStorageSchema = Type.Object({
    usedBytes: Type.Number(),
    limitGb: Type.Number(),
});

export const TenantSubscriptionPosSchema = Type.Object({
    maxRegisters: Type.Number(),
});

export const TenantSubscriptionDetailResponseSchema = Type.Object({
    companyId: Type.Number(),
    plan: Type.String(),
    planName: Type.String(),
    planInterval: Type.String(),
    status: Type.String(),
    currentPeriodStart: Type.Union([Type.String(), Type.Null()]),
    currentPeriodEnd: Type.Union([Type.String(), Type.Null()]),
    gracePeriodEndsAt: Type.Union([Type.String(), Type.Null()]),
    trialEndsAt: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    users: TenantSubscriptionUsersSchema,
    sriDocuments: TenantSubscriptionSriSchema,
    storage: TenantSubscriptionStorageSchema,
    pos: TenantSubscriptionPosSchema,
    features: Type.Record(Type.String(), Type.Union([Type.Boolean(), Type.Number(), Type.String()])),
});
export type TenantSubscriptionDetailResponseType = Static<typeof TenantSubscriptionDetailResponseSchema>;

export const UpgradePlanBodySchema = Type.Object({
    planId: Type.String({ minLength: 1 }),
    interval: Type.Optional(Type.Union([Type.Literal('monthly'), Type.Literal('yearly')])),
});
export type UpgradePlanBodyType = Static<typeof UpgradePlanBodySchema>;
