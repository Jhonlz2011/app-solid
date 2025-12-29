// Product types matching backend schema

export type ProductClass = 'MATERIAL' | 'TOOL' | 'EPP' | 'ASSET' | 'SERVICE' | 'MANUFACTURED';

export interface Product {
    id: number;
    sku: string;
    name: string;
    description?: string | null;
    product_class: ProductClass;
    category_id?: number | null;
    brand_id?: number | null;
    specs?: Record<string, any>;
    image_urls?: string[];
    uom_inventory_code?: string | null;
    uom_consumption_code?: string | null;
    track_dimensional: boolean;
    is_service: boolean;
    min_stock_alert: string;
    last_cost: string;
    base_price: string;
    iva_rate_code: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // Joined data
    category?: Category | null;
    brand?: Brand | null;
    bom?: BomHeader | null;
}

export interface ProductPayload {
    sku: string;
    name: string;
    productClass: ProductClass;
    categoryId?: number;
    brandId?: number;
    description?: string;
    specs?: Record<string, any>;
    imageUrls?: string[];
    uomInventoryCode?: string;
    uomConsumptionCode?: string;
    trackDimensional?: boolean;
    isService?: boolean;
    minStockAlert?: number;
    lastCost?: number;
    basePrice?: number;
    ivaRateCode?: number;
    components?: BomComponent[];
}

export interface BomComponent {
    componentId: number;
    quantity: number;
    wastagePercent?: number;
}

export interface BomHeader {
    id: number;
    name?: string;
    revision: number;
    components: BomDetail[];
}

export interface BomDetail {
    id: number;
    componentProductId: number;
    quantityNeeded: string;
    wastagePercent: string;
}

export interface Category {
    id: number;
    name: string;
    parent_id?: number | null;
    name_template?: string | null;
    children?: Category[];
    attributes?: CategoryAttribute[];
}

export interface CategoryAttribute {
    id: number;
    category_id: number;
    attribute_def_id: number;
    required: boolean;
    order: number;
    specific_options?: any;
    definition?: AttributeDefinition;
}

export interface AttributeDefinition {
    id: number;
    key: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'boolean' | 'date';
    default_options?: any[];
}

export interface Brand {
    id: number;
    name: string;
    website?: string | null;
}

export interface UOM {
    code: string;
    name: string;
}

export interface ProductsResponse {
    data: Product[];
    meta: {
        total: number;
        limit: number;
        offset: number;
    };
}

export interface ProductFilters {
    search?: string;
    categoryId?: number;
    brandId?: number;
    productClass?: ProductClass;
    isActive?: boolean;
    limit?: number;
    offset?: number;
}

// Label mappings
export const productClassLabels: Record<ProductClass, string> = {
    MATERIAL: 'Material',
    TOOL: 'Herramienta',
    EPP: 'EPP',
    ASSET: 'Insumo',
    SERVICE: 'Servicio',
    MANUFACTURED: 'Fabricado',
};

export const ivaRateLabels: Record<number, string> = {
    0: '0%',
    2: '12%',
    4: '15%',
};
