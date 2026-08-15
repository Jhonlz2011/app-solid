// ============================================================================
// CATALOG DTOs — Pure TypeScript Contracts (Categories, Attributes, Brands, UOM)
// ============================================================================

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
