// ============================================================================
// COMMON DTOs — Global Pure TypeScript Contracts (Zero Database Dependencies)
// ============================================================================

/** Coordinates for server-side & client-side image cropping */
export interface CropCoordinates {
    x: number;
    y: number;
    width: number;
    height: number;
    rotate?: number;
    flipX?: boolean;
    flipY?: boolean;
}

// --- Pagination & Cursor ---

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

/** Standard paginated response envelope */
export interface PaginatedResult<T> {
    data: T[];
    meta: PaginationMeta | CursorMeta;
}

// --- Facets ---

/** Faceted filter response: column → distinct values with counts */
export type FacetData = Record<string, { value: string; count: number }[]>;

// --- Filters & Query Params ---

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

/** Unified pagination params interface for data queries & Paginator */
export interface PaginationParams<TFilters = BaseFilters> {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    cursor?: string;
    direction?: 'first' | 'next' | 'prev' | 'last';
    filters?: TFilters;
}
