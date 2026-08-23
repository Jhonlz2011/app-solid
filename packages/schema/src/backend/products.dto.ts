import { Type, type Static } from './typebox';

// ============================================================================
// PRODUCTS & VARIANTS
// Standard: Request Bodies -> *BodySchema, Responses -> *ResponseSchema
// ============================================================================

export const ProductVariantBodySchema = Type.Object({
    id: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    sku: Type.String({ minLength: 1 }),
    variant_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    variant_attributes: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    content_quantity: Type.Number(),
    sale_uom_id: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    base_price: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    last_cost: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    barcode: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    image_urls: Type.Optional(Type.Union([Type.Array(Type.String()), Type.Null()])),
    std_length_cm: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    std_width_cm: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    is_default: Type.Boolean(),
    is_active: Type.Boolean(),
    sort_order: Type.Optional(Type.Number()),
});

export const ProductComponentBodySchema = Type.Object({
    id: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    component_product_id: Type.Number(),
    quantity_per_parent: Type.Number(),
    is_reversible: Type.Optional(Type.Boolean()),
    notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export const ProductBodySchema = Type.Object({
    product_type: Type.Union([Type.Literal('PRODUCTO'), Type.Literal('SERVICIO')]),
    product_subtype: Type.Optional(Type.Union([Type.Literal('SIMPLE'), Type.Literal('COMPUESTO'), Type.Literal('FABRICADO'), Type.Null()])),
    category_id: Type.Number(),
    brand_id: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    slug: Type.String({ minLength: 1 }),
    name: Type.String({ minLength: 1 }),
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    shared_attributes: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    image_urls: Type.Optional(Type.Array(Type.String())),
    uom_inventory_id: Type.Number(),
    has_dimensional_tracking: Type.Boolean(),
    min_stock_alert: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    default_base_price: Type.Number(),
    iva_rate_code: Type.Number(),
    is_active: Type.Boolean(),
    variants: Type.Array(ProductVariantBodySchema),
    components: Type.Optional(Type.Array(ProductComponentBodySchema)),
});

export const ProductUploadImagesBodySchema = Type.Object({
    files: Type.Union([Type.File(), Type.Array(Type.File())]),
});

export const ProductDeleteImageBodySchema = Type.Object({
    url: Type.String(),
});

export const ProductListQuerySchema = Type.Object({
    cursor: Type.Optional(Type.String()),
    direction: Type.Optional(Type.Union([
        Type.Literal('first'), Type.Literal('next'), Type.Literal('prev'), Type.Literal('last')
    ])),
    limit: Type.Optional(Type.Number()),
    search: Type.Optional(Type.String()),
    sortBy: Type.Optional(Type.String()),
    sortOrder: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
    page: Type.Optional(Type.Number()),
    categoryId: Type.Optional(Type.String()),
    brandId: Type.Optional(Type.String()),
    productType: Type.Optional(Type.String()),
    isActive: Type.Optional(Type.String()),
});

export const ProductFacetsQuerySchema = Type.Object({
    search: Type.Optional(Type.String()),
    categoryId: Type.Optional(Type.String()),
    brandId: Type.Optional(Type.String()),
    productType: Type.Optional(Type.String()),
    isActive: Type.Optional(Type.String()),
});

export const GenerateSkuQuerySchema = Type.Object({
    categoryId: Type.Optional(Type.Number()),
    brandId: Type.Optional(Type.Number()),
});

// ============================================================================
// CANONICAL INFERRED TYPES (Single Source of Truth)
// ============================================================================

export type ProductBodyType = Static<typeof ProductBodySchema>;
export type ProductVariantBodyType = Static<typeof ProductVariantBodySchema>;
export type ProductComponentBodyType = Static<typeof ProductComponentBodySchema>;
export type ProductUploadImagesBodyType = Static<typeof ProductUploadImagesBodySchema>;
export type ProductDeleteImageBodyType = Static<typeof ProductDeleteImageBodySchema>;
export type ProductListQueryType = Static<typeof ProductListQuerySchema>;
export type ProductFacetsQueryType = Static<typeof ProductFacetsQuerySchema>;
export type GenerateSkuQueryType = Static<typeof GenerateSkuQuerySchema>;
