import { Type, type Static } from '@sinclair/typebox';

// ============================================================================
// COMMON QUERY & PARAMETER SCHEMAS
// ============================================================================

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

/** Common bulk action payload containing list of numeric IDs */
export const BulkIdsBodySchema = Type.Object({
    ids: Type.Array(Type.Union([Type.Number(), Type.String()]), { minItems: 1 }),
});

/** Common numeric or string ID route parameter */
export const IdParamSchema = Type.Object({
    id: Type.Union([Type.Number(), Type.String()]),
});

/** Common generic success response envelope */
export const SuccessResponseSchema = Type.Object({
    success: Type.Literal(true),
});

export type PaginationQueryType = Static<typeof PaginationQuerySchema>;
export type CursorPaginationQueryType = Static<typeof CursorPaginationQuerySchema>;
export type BulkIdsBodyType = Static<typeof BulkIdsBodySchema>;
export type IdParamType = Static<typeof IdParamSchema>;
export type SuccessResponseType = Static<typeof SuccessResponseSchema>;
