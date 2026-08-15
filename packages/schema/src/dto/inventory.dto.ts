// ============================================================================
// INVENTORY DTOs — Pure TypeScript Contracts (Warehouses, Locations, Stock)
// ============================================================================
import type { LocationType } from '../enums';

// ── Warehouses ───────────────────────────────────────────────────────────────

export interface WarehousePayload {
    code: string;
    name: string;
    address?: string | null;
    is_mobile?: boolean;
    manager_id?: number | null;
}

export interface WarehouseUpdatePayload extends Partial<WarehousePayload> {
    is_active?: boolean;
}

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

export interface WarehouseReferences {
    locations: number;
    stock: number;
    movements: number;
    total: number;
}

// ── Locations ───────────────────────────────────────────────────────────────

export interface LocationPayload {
    warehouse_id?: number | null;
    parent_id?: number | null;
    name: string;
    type?: LocationType;
}

export interface LocationUpdatePayload extends Partial<LocationPayload> {
    is_active?: boolean;
}

export interface LocationReparentPayload {
    parent_id: number | null;
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
    // Joined warehouse info
    warehouse_name: string | null;
    warehouse_code: string | null;
    // Count of distinct products with positive stock at this location
    product_count: number;
}

/** Extended with subRows for TanStack Table tree rendering */
export interface LocationNode extends LocationItem {
    children?: LocationNode[];
    subRows?: LocationNode[];
}

export interface LocationReferences {
    stock: number;
    movementsSrc: number;
    movementsDest: number;
    dimensionalItems: number;
    total: number;
}
