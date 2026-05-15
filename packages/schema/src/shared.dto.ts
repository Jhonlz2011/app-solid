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
