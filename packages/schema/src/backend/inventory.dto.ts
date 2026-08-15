import { Type, type Static } from './typebox';

// ============================================================================
// WAREHOUSES & LOCATIONS
// ============================================================================

export const LocationTypeSchema = Type.Union([
    Type.Literal('VIEW'),
    Type.Literal('INTERNAL'),
    Type.Literal('SUPPLIER'),
    Type.Literal('CUSTOMER'),
    Type.Literal('ADJUSTMENT'),
    Type.Literal('PRODUCTION'),
]);

export const WarehouseBodySchema = Type.Object({
    code: Type.String({ maxLength: 20 }),
    name: Type.String({ maxLength: 100 }),
    address: Type.Optional(Type.Union([Type.String({ maxLength: 255 }), Type.Null()])),
    is_mobile: Type.Optional(Type.Boolean()),
    manager_id: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
});

export const WarehouseUpdateSchema = Type.Partial(Type.Object({
    code: Type.String({ maxLength: 20 }),
    name: Type.String({ maxLength: 100 }),
    address: Type.Union([Type.String({ maxLength: 255 }), Type.Null()]),
    is_mobile: Type.Boolean(),
    manager_id: Type.Union([Type.Number(), Type.Null()]),
    is_active: Type.Boolean(),
}));

export const LocationBodySchema = Type.Object({
    warehouse_id: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    parent_id: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    name: Type.String({ maxLength: 100 }),
    type: Type.Optional(LocationTypeSchema),
});

export const LocationUpdateSchema = Type.Partial(Type.Object({
    name: Type.String({ maxLength: 100 }),
    type: LocationTypeSchema,
    warehouse_id: Type.Union([Type.Number(), Type.Null()]),
    parent_id: Type.Union([Type.Number(), Type.Null()]),
    is_active: Type.Boolean(),
}));

export const LocationReparentSchema = Type.Object({
    parent_id: Type.Union([Type.Number(), Type.Null()]),
});

export const LocationListQuerySchema = Type.Object({
    warehouseId: Type.Optional(Type.Numeric()),
});

export const LocationReferencesResponseSchema = Type.Object({
    stock: Type.Number(),
    movementsSrc: Type.Number(),
    movementsDest: Type.Number(),
    dimensionalItems: Type.Number(),
    total: Type.Number(),
});

export const WarehouseReferencesResponseSchema = Type.Object({
    locations: Type.Number(),
    stock: Type.Number(),
    movements: Type.Number(),
    total: Type.Number(),
});

export type LocationTypeType = Static<typeof LocationTypeSchema>;
export type WarehouseBodyType = Static<typeof WarehouseBodySchema>;
export type WarehouseUpdateType = Static<typeof WarehouseUpdateSchema>;
export type LocationBodyType = Static<typeof LocationBodySchema>;
export type LocationUpdateType = Static<typeof LocationUpdateSchema>;
export type LocationReparentType = Static<typeof LocationReparentSchema>;
export type LocationListQueryType = Static<typeof LocationListQuerySchema>;
export type LocationReferencesResponseType = Static<typeof LocationReferencesResponseSchema>;
export type WarehouseReferencesResponseType = Static<typeof WarehouseReferencesResponseSchema>;
