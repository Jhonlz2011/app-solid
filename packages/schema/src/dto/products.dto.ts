// ============================================================================
// PRODUCT DTOs — Pure TypeScript Contracts
// ============================================================================

export interface ProductVariantPayload {
    id?: number | null;
    sku: string;
    variant_name?: string | null;
    variant_attributes?: Record<string, unknown>;
    content_quantity: number;
    sale_uom_id?: number | null;
    base_price?: number | null;
    last_cost?: number | null;
    barcode?: string | null;
    image_urls?: string[] | null;
    std_length_cm?: number | null;
    std_width_cm?: number | null;
    is_default: boolean;
    is_active: boolean;
    sort_order?: number;
}

export interface ProductComponentPayload {
    id?: number | null;
    component_product_id: number;
    quantity_per_parent: number;
    is_reversible?: boolean;
    notes?: string | null;
}

export interface ProductPayload {
    product_type: 'PRODUCTO' | 'SERVICIO';
    product_subtype?: 'SIMPLE' | 'COMPUESTO' | 'FABRICADO' | null;
    category_id: number;
    brand_id?: number | null;
    slug: string;
    name: string;
    description?: string | null;
    shared_attributes?: Record<string, unknown>;
    image_urls?: string[];
    uom_inventory_id: number;
    has_dimensional_tracking: boolean;
    min_stock_alert?: number | null;
    default_base_price: number;
    iva_rate_code: number;
    is_active: boolean;
    variants: ProductVariantPayload[];
    components?: ProductComponentPayload[];
}
