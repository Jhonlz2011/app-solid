import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';

// =============================================================================
// Types — TODO(M5): Move to packages/schema/src/frontend.ts when scaling
// =============================================================================

export interface WarehouseItem {
    id: number;
    code: string;
    name: string;
    address: string | null;
    is_mobile: boolean | null;
    manager_id: number | null;
    is_active: boolean | null;
    locationCount: number;
}

export interface CreateWarehouseBody {
    code: string;
    name: string;
    address?: string;
    is_mobile?: boolean;
    manager_id?: number;
}

export interface UpdateWarehouseBody {
    code?: string;
    name?: string;
    address?: string | null;
    is_mobile?: boolean;
    manager_id?: number | null;
    is_active?: boolean;
}

// =============================================================================
// API Wrappers — Warehouses
//
// NOTE on `as any`: Eden treaty cannot resolve parameterized route segments
// like `({ id })` or hyphenated paths. The casts are scoped minimally and
// return types are explicitly annotated.
// =============================================================================

export const warehousesApi = {
    list: async (): Promise<WarehouseItem[]> => {
        const { data, error } = await api.api.inventory.warehouses.get();
        if (error) throwApiError(error);
        return data as WarehouseItem[];
    },

    get: async (id: number) => {
        const { data, error } = await api.api.inventory.warehouses({ id }).get();
        if (error) throwApiError(error);
        return data!;
    },

    create: async (body: CreateWarehouseBody) => {
        const { data, error } = await api.api.inventory.warehouses.post(body as any);
        if (error) throwApiError(error);
        return data!;
    },

    update: async (id: number, body: UpdateWarehouseBody) => {
        const { data, error } = await (api.api.inventory.warehouses as any)({ id }).put(body);
        if (error) throwApiError(error);
        return data!;
    },

    deactivate: async (id: number) => {
        const { data, error } = await (api.api.inventory.warehouses as any)({ id }).deactivate.patch();
        if (error) throwApiError(error);
        return data!;
    },

    restore: async (id: number) => {
        const { data, error } = await (api.api.inventory.warehouses as any)({ id }).restore.patch();
        if (error) throwApiError(error);
        return data!;
    },
};
