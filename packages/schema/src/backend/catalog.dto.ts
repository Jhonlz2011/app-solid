import { Type, type Static } from './typebox';
import type { AttributeDataType, UomGroup } from '../enums';

// ============================================================================
// BRANDS
// Standard: Request Bodies -> *BodySchema, Responses -> *ResponseSchema
// ============================================================================

export const BrandBodySchema = Type.Object({
    name: Type.String({ maxLength: 100 }),
    website: Type.Optional(Type.Union([Type.String({ maxLength: 255 }), Type.Null()])),
});

export const BrandUpdateBodySchema = Type.Partial(Type.Object({
    name: Type.String({ maxLength: 100 }),
    website: Type.Union([Type.String({ maxLength: 255 }), Type.Null()]),
    is_active: Type.Boolean(),
}));

export const BrandListQuerySchema = Type.Object({
    cursor: Type.Optional(Type.String()),
    direction: Type.Optional(Type.Union([
        Type.Literal('first'), Type.Literal('next'), Type.Literal('prev'), Type.Literal('last')
    ])),
    search: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Number()),
    sortBy: Type.Optional(Type.String()),
    sortOrder: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
    page: Type.Optional(Type.Number()),
    isActive: Type.Optional(Type.String()),
});

export const BrandReferencesResponseSchema = Type.Object({
    products: Type.Number(),
    total: Type.Number(),
});

export type BrandBodyType = Static<typeof BrandBodySchema>;
export type BrandUpdateType = Static<typeof BrandUpdateBodySchema>;
export type BrandListQueryType = Static<typeof BrandListQuerySchema>;
export type BrandReferencesType = Static<typeof BrandReferencesResponseSchema>;

export interface BrandItem {
    id: number;
    company_id: number;
    name: string;
    website: string | null;
    is_active: boolean | null;
    created_at: string | Date;
    updated_at: string | Date;
}

export interface BrandFilters {
    cursor?: string;
    direction?: 'first' | 'next' | 'prev' | 'last';
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    isActive?: string[];
}

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

export const UomUpdateBodySchema = Type.Partial(Type.Object({
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
export type UomUpdateType = Static<typeof UomUpdateBodySchema>;
export type UomReferencesResponseType = Static<typeof UomReferencesResponseSchema>;

export interface UomItem {
    id: number;
    code: string;
    name: string;
    uom_group: UomGroup;
    base_factor: string | null;
    company_id: number | null;
    is_system: boolean;
    is_active: boolean | null;
    created_at: string | Date;
    updated_at: string | Date;
}

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

export const AttributeUpdateBodySchema = Type.Partial(Type.Object({
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
export type AttributeUpdateType = Static<typeof AttributeUpdateBodySchema>;
export type AttributeReferencesResponseType = Static<typeof AttributeReferencesResponseSchema>;
export type AttributeReferences = AttributeReferencesResponseType;

export type RenameOptionEntry = Static<typeof RenameOptionEntrySchema>;

export interface AttributeDefPayload {
    label: string;
    type: AttributeDataType;
    defaultOptions?: string[] | null;
    renamedOptions?: RenameOptionEntry[];
}

export interface AttributeUpdatePayload extends Partial<AttributeDefPayload> {
    is_active?: boolean;
}

export interface AttributeItem {
    id: number;
    company_id: number;
    key: string;
    label: string;
    type: AttributeDataType;
    default_options: string[] | null;
    is_active: boolean | null;
    created_at: string | Date;
    updated_at: string | Date;
}

export interface AttributeCategoryUsage {
    categoryId: number;
    categoryName: string;
    required: boolean | null;
}

export interface AttributeDetail extends AttributeItem {
    usedInCategories: AttributeCategoryUsage[];
}

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

export const CategoryUpdateBodySchema = Type.Partial(Type.Object({
    name: Type.String(),
    parentId: Type.Union([Type.Number(), Type.Null()]),
    description: Type.Union([Type.String(), Type.Null()]),
    icon: Type.Union([Type.String(), Type.Null()]),
    nameTemplate: Type.Union([Type.String(), Type.Null()]),
    sortOrder: Type.Number(),
    attributes: Type.Array(CategoryAttributeEntrySchema),
}));
export const CategoryUpdateSchema = CategoryUpdateBodySchema;

export const CategoryReparentBodySchema = Type.Object({
    parent_id: Type.Union([Type.Number(), Type.Null()]),
});
export const CategoryReparentSchema = CategoryReparentBodySchema;

export const CategoryReorderItemSchema = Type.Object({
    id: Type.Number(),
    sort_order: Type.Number(),
});

export const CategoryReorderBodySchema = Type.Object({
    items: Type.Array(CategoryReorderItemSchema),
});
export const CategoryReorderSchema = CategoryReorderBodySchema;

export const CategoryListQuerySchema = Type.Object({
    flat: Type.Optional(Type.Union([Type.String(), Type.Boolean()])),
});

export const CategoryReferencesResponseSchema = Type.Object({
    products: Type.Number(),
    total: Type.Number(),
});

export type CategoryAttributeEntryType = Static<typeof CategoryAttributeEntrySchema>;
export type CategoryAttributePayload = CategoryAttributeEntryType;
export type CategoryBodyType = Static<typeof CategoryBodySchema>;
export type CategoryPayload = CategoryBodyType;
export type CategoryUpdateType = Static<typeof CategoryUpdateBodySchema>;
export type CategoryUpdatePayload = CategoryUpdateType;
export type CategoryReparentType = Static<typeof CategoryReparentBodySchema>;
export type CategoryReparentPayload = CategoryReparentType;
export type CategoryReorderType = Static<typeof CategoryReorderBodySchema>;
export type CategoryReorderPayload = CategoryReorderType;
export type CategoryReorderItem = Static<typeof CategoryReorderItemSchema>;
export type CategoryListQueryType = Static<typeof CategoryListQuerySchema>;
export type CategoryReferencesResponseType = Static<typeof CategoryReferencesResponseSchema>;
export type CategoryReferences = CategoryReferencesResponseType;

export interface CategoryNode {
    id: number;
    company_id: number;
    name: string;
    parent_id: number | null;
    description: string | null;
    icon: string | null;
    name_template: string | null;
    sort_order: number | null;
    is_active: boolean;
    path: string;
    depth: number;
    attributeCount: number;
    children?: CategoryNode[];
    subRows?: CategoryNode[];
    created_at?: string | Date | null;
    updated_at?: string | Date | null;
}

export interface CategoryAttributeDetail {
    id: number;
    attributeDefId: number;
    required: boolean;
    order: number;
    specificOptions: string[] | null | unknown;
    key: string;
    label: string;
    type: AttributeDataType;
    defaultOptions: string[] | null | unknown;
}

export interface CategoryDetail extends Omit<CategoryNode, 'children' | 'attributeCount' | 'subRows'> {
    attributes: CategoryAttributeDetail[];
}

export interface CategoryFormSchemaAttribute {
    id: number;
    key: string;
    label: string;
    type: AttributeDataType;
    required: boolean;
    order: number;
    options: string[];
}

export interface CategoryFormSchemaData {
    category: {
        id: number;
        name: string;
        nameTemplate: string | null;
    };
    attributes: CategoryFormSchemaAttribute[];
}
