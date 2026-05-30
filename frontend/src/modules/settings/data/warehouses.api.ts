import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';

// =============================================================================
// Types
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

// =============================================================================
// API Wrappers — Warehouses
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

    create: async (body: { code: string; name: string; address?: string; is_mobile?: boolean; manager_id?: number }) => {
        const { data, error } = await api.api.inventory.warehouses.post(body as any);
        if (error) throwApiError(error);
        return data!;
    },

    update: async (id: number, body: Partial<{ code: string; name: string; address: string | null; is_mobile: boolean; manager_id: number | null; is_active: boolean }>) => {
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
