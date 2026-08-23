import { Type, type Static } from './typebox';
import type { LocationType } from '../enums';
import { LOCATION_TYPES } from '../enums';

// ============================================================================
// WAREHOUSES & LOCATIONS
// Standard: Request Bodies -> *BodySchema, Responses -> *ResponseSchema
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

export const WarehouseUpdateBodySchema = Type.Partial(Type.Object({
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

export const LocationUpdateBodySchema = Type.Partial(Type.Object({
    name: Type.String({ maxLength: 100 }),
    type: LocationTypeSchema,
    warehouse_id: Type.Union([Type.Number(), Type.Null()]),
    parent_id: Type.Union([Type.Number(), Type.Null()]),
    is_active: Type.Boolean(),
}));

export const LocationReparentBodySchema = Type.Object({
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

// ============================================================================
// CANONICAL INFERRED TYPES (Single Source of Truth)
// ============================================================================

export type WarehouseBodyType = Static<typeof WarehouseBodySchema>;
export type WarehouseUpdateType = Static<typeof WarehouseUpdateBodySchema>;


export type LocationBodyType = Static<typeof LocationBodySchema>;
export type LocationUpdateType = Static<typeof LocationUpdateBodySchema>;
export type LocationReparentType = Static<typeof LocationReparentBodySchema>;
export type LocationListQueryType = Static<typeof LocationListQuerySchema>;

export type LocationReferencesResponseType = Static<typeof LocationReferencesResponseSchema>;
export type WarehouseReferencesResponseType = Static<typeof WarehouseReferencesResponseSchema>;

export interface WarehouseItem {
    id: number;
    company_id: number;
    code: string;
    name: string;
    address: string | null;
    is_mobile: boolean | null;
    manager_id: number | null;
    manager_name?: string | null;
    is_active: boolean | null;
    created_at?: string | Date;
    updated_at?: string | Date;
}

export interface LocationItem {
    id: number;
    company_id: number;
    warehouse_id: number | null;
    parent_id: number | null;
    name: string;
    path: string;
    type: LocationType;
    depth: number;
    is_active: boolean | null;
    warehouse_name: string | null;
    warehouse_code: string | null;
    product_count: number;
}

export interface LocationNode extends LocationItem {
    children?: LocationNode[];
    subRows?: LocationNode[];
}
