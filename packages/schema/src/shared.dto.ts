// ============================================================================
// SHARED DTOs — Global types reusable across ALL modules
// ============================================================================

// --- Pagination ---

/** Standard offset-based paginated response metadata */
export interface PaginationMeta {
    total: number;
    page: number;
    pageCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

/** Hybrid cursor/offset pagination metadata (used by entity list endpoints) */
export interface CursorMeta {
    nextCursor: string | null;
    prevCursor: string | null;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    total: number;
    page: number | null;
    pageCount: number | null;
}

// --- Facets ---

/** Faceted filter response: column → distinct values with counts */
export type FacetData = Record<string, { value: string; count: number }[]>;

// --- Filters ---

/** Base filter shape shared across all paginated list endpoints */
export interface BaseFilters {
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

/** Cursor-based filter shape extending BaseFilters */
export interface CursorFilters extends BaseFilters {
    cursor?: string;
    direction?: 'first' | 'next' | 'prev' | 'last';
}

/** Entity-specific filters (Suppliers, Clients, Employees) */
export interface EntityFilters extends CursorFilters {
    personType?: string[];
    taxIdType?: string[];
    isActive?: string[];
    businessName?: string[];
}

// --- Entity References (pre-flight hard delete check) ---

export interface EntityReferences {
    supplierProducts: number;
    invoices: number;
    workOrders: number;
    total: number;
    canDelete: boolean;
}

// --- E2E Entity Payload Contracts ---
// These interfaces represent the strict, single source of truth for the entity creation/update payload.
// Both Valibot (frontend) and TypeBox (backend) must statically map to these types to prevent drift.

export interface EntityContactPayload {
    name: string;
    position: string; // Empty string if omitted
    email: string;    // Empty string if omitted
    phone: string;    // Empty string if omitted
    isPrimary: boolean;
}

export interface EntityAddressPayload {
    addressLine: string;
    city: string; // Empty string if omitted
    country: string; // Empty string if omitted
    countryCode: string; // Empty string if omitted
    postalCode: string; // Empty string if omitted
    isMain: boolean;
}

export interface EmployeeDetailsPayload {
    department: string; // Empty string if omitted
    jobTitle: string; // Empty string if omitted
    salaryBase?: number;
    hireDate: string; // Empty string if omitted
    costPerHour?: number;
}

export interface CarrierVehiclePayload {
    licensePlate: string;
    description?: string;
    isActive?: boolean;
}

export interface CarrierDriverPayload {
    identificationNumber: string;
    fullName: string;
    phone?: string;
    isActive?: boolean;
}

export interface EntityPayload {
    taxId: string;
    taxIdType: 'RUC' | 'CEDULA' | 'PASAPORTE' | 'EXTERIOR' | 'CONSUMIDOR_FINAL';
    personType: 'NATURAL' | 'JURIDICA';
    businessName: string;
    tradeName: string; // Empty string if omitted
    emailBilling: string; // Empty string if omitted
    phone: string; // Empty string if omitted
    
    isClient: boolean;
    isSupplier: boolean;
    isEmployee: boolean;
    isCarrier: boolean;
    
    taxRegimeType?: 'RIMPE_NEGOCIO_POPULAR' | 'RIMPE_EMPRENDEDOR' | 'GENERAL';
    obligadoContabilidad: boolean;
    isRetentionAgent: boolean;
    isSpecialContributor: boolean;
    
    employeeDetails?: EmployeeDetailsPayload;
    contacts: EntityContactPayload[];
    addresses: EntityAddressPayload[];
    vehicles?: CarrierVehiclePayload[];
    drivers?: CarrierDriverPayload[];
}

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

