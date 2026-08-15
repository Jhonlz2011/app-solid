// ============================================================================
// CATALOG DTOs — Pure TypeScript Contracts (Categories, Attributes, Brands, UOM)
// ============================================================================
import type { AttributeDataType, UomGroup } from '../enums';

// ── Brands ───────────────────────────────────────────────────────────────────

export interface BrandPayload {
    name: string;
    website?: string | null;
}

export interface BrandUpdatePayload extends Partial<BrandPayload> {
    is_active?: boolean;
}

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

export interface BrandReferences {
    products: number;
    total: number;
}

// ── Attributes ───────────────────────────────────────────────────────────────

export interface RenameOptionEntry {
    from: string;
    to: string;
}

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

export interface AttributeReferences {
    categories: number;
    total: number;
}

// ── Categories ───────────────────────────────────────────────────────────────

export interface CategoryAttributePayload {
    attributeDefId: number;
    required?: boolean;
    order?: number;
    specificOptions?: unknown;
}

export interface CategoryPayload {
    companyId?: number;
    name: string;
    parentId?: number | null;
    description?: string | null;
    icon?: string | null;
    nameTemplate?: string | null;
    sortOrder?: number;
    attributes?: CategoryAttributePayload[];
}

export interface CategoryUpdatePayload extends Partial<CategoryPayload> {
    is_active?: boolean;
}

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
    created_at: string | Date;
    updated_at: string | Date;
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

export interface CategoryReferences {
    products: number;
    total: number;
}

export interface CategoryReparentPayload {
    parent_id: number | null;
}

export interface CategoryReorderItem {
    id: number;
    sort_order: number;
}

export interface CategoryReorderPayload {
    items: CategoryReorderItem[];
}

// ── Units of Measure (UOM) ──────────────────────────────────────────────────

export interface UomPayload {
    code: string;
    name: string;
    uom_group: UomGroup;
    base_factor?: string | number | null;
}

export interface UomUpdatePayload extends Partial<UomPayload> {
    is_active?: boolean;
}

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

export interface UomReferences {
    products: number;
    variants: number;
    supplierProducts: number;
    conversions: number;
    workOrderItems: number;
    quoteItems: number;
    total: number;
}
