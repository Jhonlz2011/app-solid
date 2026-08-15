import { Type, type Static } from './typebox';

// ============================================================================
// BRANDS
// ============================================================================

export const BrandBodySchema = Type.Object({
    name: Type.String({ maxLength: 100 }),
    website: Type.Optional(Type.Union([Type.String({ maxLength: 255 }), Type.Null()])),
});

export const BrandUpdateSchema = Type.Partial(Type.Object({
    name: Type.String({ maxLength: 100 }),
    website: Type.Union([Type.String({ maxLength: 255 }), Type.Null()]),
    is_active: Type.Boolean(),
}));

export const BrandListQuerySchema = Type.Object({
    cursor: Type.Optional(Type.String()),
    direction: Type.Optional(Type.String()),
    search: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Numeric()),
    sortBy: Type.Optional(Type.String()),
    sortOrder: Type.Optional(Type.String()),
    page: Type.Optional(Type.Numeric()),
    isActive: Type.Optional(Type.String()),
});

export const BrandReferencesResponseSchema = Type.Object({
    products: Type.Number(),
    total: Type.Number(),
});

export type BrandBodyType = Static<typeof BrandBodySchema>;
export type BrandUpdateType = Static<typeof BrandUpdateSchema>;
export type BrandListQueryType = Static<typeof BrandListQuerySchema>;
export type BrandReferencesResponseType = Static<typeof BrandReferencesResponseSchema>;

// ============================================================================
// UNITS OF MEASURE (UOM)
// ============================================================================

export const UomGroupSchema = Type.Union([
    Type.Literal('VOLUMEN'),
    Type.Literal('LONGITUD'),
    Type.Literal('PESO'),
    Type.Literal('AREA'),
    Type.Literal('CANTIDAD'),
    Type.Literal('TIEMPO'),
    Type.Literal('DATA'),
]);

export const UomBodySchema = Type.Object({
    code: Type.String({ maxLength: 10 }),
    name: Type.String({ maxLength: 50 }),
    uom_group: UomGroupSchema,
    base_factor: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export const UomUpdateSchema = Type.Partial(Type.Object({
    name: Type.String({ maxLength: 50 }),
    uom_group: UomGroupSchema,
    base_factor: Type.Union([Type.String(), Type.Null()]),
    is_active: Type.Boolean(),
}));

export const UomReferencesResponseSchema = Type.Object({
    products: Type.Number(),
    variants: Type.Number(),
    supplierProducts: Type.Number(),
    conversions: Type.Number(),
    workOrderItems: Type.Number(),
    quoteItems: Type.Number(),
    total: Type.Number(),
});

export type UomGroupType = Static<typeof UomGroupSchema>;
export type UomBodyType = Static<typeof UomBodySchema>;
export type UomUpdateType = Static<typeof UomUpdateSchema>;
export type UomReferencesResponseType = Static<typeof UomReferencesResponseSchema>;

// ============================================================================
// ATTRIBUTES
// ============================================================================

export const AttributeTypeSchema = Type.Union([
    Type.Literal('TEXT'),
    Type.Literal('NUMBER'),
    Type.Literal('SELECT'),
    Type.Literal('BOOLEAN'),
]);

export const AttributeOptionSchema = Type.Array(Type.String());

export const RenameOptionEntrySchema = Type.Object({
    from: Type.String(),
    to: Type.String(),
});

export const AttributeBodySchema = Type.Object({
    label: Type.String({ maxLength: 100 }),
    type: AttributeTypeSchema,
    defaultOptions: Type.Optional(Type.Union([AttributeOptionSchema, Type.Null()])),
});

export const AttributeUpdateSchema = Type.Partial(Type.Object({
    label: Type.String({ maxLength: 100 }),
    type: AttributeTypeSchema,
    defaultOptions: Type.Union([AttributeOptionSchema, Type.Null()]),
    renamedOptions: Type.Array(RenameOptionEntrySchema),
    is_active: Type.Boolean(),
}));

export const AttributeReferencesResponseSchema = Type.Object({
    categories: Type.Number(),
    total: Type.Number(),
});

export type AttributeTypeType = Static<typeof AttributeTypeSchema>;
export type AttributeBodyType = Static<typeof AttributeBodySchema>;
export type AttributeUpdateType = Static<typeof AttributeUpdateSchema>;
export type AttributeReferencesResponseType = Static<typeof AttributeReferencesResponseSchema>;

// ============================================================================
// CATEGORIES
// ============================================================================

export const CategoryAttributeEntrySchema = Type.Object({
    attributeDefId: Type.Number(),
    required: Type.Boolean(),
    order: Type.Number(),
    specificOptions: Type.Optional(Type.Any()),
});

export const CategoryBodySchema = Type.Object({
    name: Type.String({ minLength: 1 }),
    parentId: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    icon: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    nameTemplate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    sortOrder: Type.Optional(Type.Number()),
    attributes: Type.Array(CategoryAttributeEntrySchema),
});

export const CategoryUpdateSchema = Type.Partial(Type.Object({
    name: Type.String(),
    parentId: Type.Union([Type.Number(), Type.Null()]),
    description: Type.Union([Type.String(), Type.Null()]),
    icon: Type.Union([Type.String(), Type.Null()]),
    nameTemplate: Type.Union([Type.String(), Type.Null()]),
    sortOrder: Type.Number(),
    attributes: Type.Array(CategoryAttributeEntrySchema),
}));

export const CategoryReparentSchema = Type.Object({
    parent_id: Type.Union([Type.Number(), Type.Null()]),
});

export const CategoryReorderItemSchema = Type.Object({
    id: Type.Number(),
    sort_order: Type.Number(),
});

export const CategoryReorderSchema = Type.Object({
    items: Type.Array(CategoryReorderItemSchema),
});

export const CategoryListQuerySchema = Type.Object({
    flat: Type.Optional(Type.String()),
});

export const CategoryReferencesResponseSchema = Type.Object({
    products: Type.Number(),
    total: Type.Number(),
});

export type CategoryAttributeEntryType = Static<typeof CategoryAttributeEntrySchema>;
export type CategoryBodyType = Static<typeof CategoryBodySchema>;
export type CategoryUpdateType = Static<typeof CategoryUpdateSchema>;
export type CategoryReparentType = Static<typeof CategoryReparentSchema>;
export type CategoryReorderType = Static<typeof CategoryReorderSchema>;
export type CategoryListQueryType = Static<typeof CategoryListQuerySchema>;
export type CategoryReferencesResponseType = Static<typeof CategoryReferencesResponseSchema>;
