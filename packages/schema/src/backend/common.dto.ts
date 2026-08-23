import { Type, type Static } from '@sinclair/typebox';

// ============================================================================
// COMMON QUERY & PARAMETER SCHEMAS (TypeBox for Elysia & Eden Treaty)
// ============================================================================

/** Coordinates for server-side & client-side image cropping */
export const CropCoordinatesSchema = Type.Object({
    x: Type.Number(),
    y: Type.Number(),
    width: Type.Number(),
    height: Type.Number(),
    rotate: Type.Optional(Type.Number()),
    flipX: Type.Optional(Type.Boolean()),
    flipY: Type.Optional(Type.Boolean()),
});

/** Standard offset-based paginated response metadata schema */
export const PaginationMetaSchema = Type.Object({
    total: Type.Number(),
    page: Type.Number(),
    pageCount: Type.Number(),
    hasNextPage: Type.Boolean(),
    hasPrevPage: Type.Boolean(),
});

/** Hybrid cursor/offset pagination metadata schema */
export const CursorMetaSchema = Type.Object({
    nextCursor: Type.Union([Type.String(), Type.Null()]),
    prevCursor: Type.Union([Type.String(), Type.Null()]),
    hasNextPage: Type.Boolean(),
    hasPrevPage: Type.Boolean(),
    total: Type.Number(),
    page: Type.Union([Type.Number(), Type.Null()]),
    pageCount: Type.Union([Type.Number(), Type.Null()]),
});

/** Common offset-based pagination query parameters */
export const PaginationQuerySchema = Type.Object({
    page: Type.Optional(Type.Number()),
    limit: Type.Optional(Type.Number()),
    search: Type.Optional(Type.String()),
    sortBy: Type.Optional(Type.String()),
    sortOrder: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
});

/** Common cursor-based pagination query parameters */
export const CursorPaginationQuerySchema = Type.Composite([
    PaginationQuerySchema,
    Type.Object({
        cursor: Type.Optional(Type.String()),
        direction: Type.Optional(Type.Union([
            Type.Literal('first'), Type.Literal('next'), Type.Literal('prev'), Type.Literal('last')
        ])),
    })
]);

export const BulkStringIdsBodySchema = Type.Object({
    ids: Type.Array(Type.String(), { minItems: 1 }),
});

export const BulkIdsBodySchema = Type.Object({
    ids: Type.Array(Type.Number(), { minItems: 1 }),
});

/** Common numeric ID route parameter */
export const IdParamSchema = Type.Object({
    id: Type.Number(),
});

/** Common UUID string ID route parameter */
export const IdStringParamSchema = Type.Object({
    id: Type.String(),
});

/** Common generic success response envelope */
export const SuccessResponseSchema = Type.Object({
    success: Type.Literal(true),
});

// ============================================================================
// CANONICAL INFERRED TYPES (Single Source of Truth)
// ============================================================================

export type CropCoordinates = Static<typeof CropCoordinatesSchema>;
export type PaginationMetaType = Static<typeof PaginationMetaSchema>;

export type CursorMetaType = Static<typeof CursorMetaSchema>;

export type PaginationQueryType = Static<typeof PaginationQuerySchema>;
export type CursorPaginationQueryType = Static<typeof CursorPaginationQuerySchema>;
export type BulkIdsBodyType = Static<typeof BulkIdsBodySchema>;
export type IdParamType = Static<typeof IdParamSchema>;
export type SuccessResponseType = Static<typeof SuccessResponseSchema>;

export interface PaginatedResult<T> {
    data: T[];
    meta: PaginationMetaType | CursorMetaType;
}

export type FacetData = Record<string, { value: string; count: number }[]>;

export interface BaseFilters {
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface CursorFilters extends BaseFilters {
    cursor?: string;
    direction?: 'first' | 'next' | 'prev' | 'last';
}

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
