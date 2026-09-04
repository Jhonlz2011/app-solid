import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type {
    WarehouseItem,
    WarehouseBodyType,
    WarehouseUpdateType,
    WarehouseReferencesResponseType,
} from '@app/schema/dto';

export type { WarehouseItem };
export type CreateWarehouseBody = WarehouseBodyType;
export type UpdateWarehouseBody = WarehouseUpdateType;

// =============================================================================
// API Wrappers — Warehouses (100% Type-Safe E2E via Eden Treaty)
// =============================================================================

export const warehousesApi = {
    list: async (): Promise<WarehouseItem[]> => {
        const { data, error } = await api.settings.warehouses.get();
        if (error) throwApiError(error);
        return (data || []) as WarehouseItem[];
    },

    get: async (id: number): Promise<WarehouseItem> => {
        const { data, error } = await api.settings.warehouses({ id }).get();
        if (error) throwApiError(error);
        return data as WarehouseItem;
    },

    create: async (body: WarehouseBodyType): Promise<WarehouseItem> => {
        const { data, error } = await api.settings.warehouses.post(body);
        if (error) throwApiError(error);
        return data as WarehouseItem;
    },

    update: async (id: number, body: WarehouseUpdateType): Promise<WarehouseItem> => {
        const { data, error } = await api.settings.warehouses({ id }).put(body);
        if (error) throwApiError(error);
        return data as WarehouseItem;
    },

    deactivate: async (id: number): Promise<void> => {
        const { error } = await api.settings.warehouses({ id }).deactivate.patch();
        if (error) throwApiError(error);
    },

    restore: async (id: number): Promise<WarehouseItem> => {
        const { data, error } = await api.settings.warehouses({ id }).restore.patch();
        if (error) throwApiError(error);
        return data as WarehouseItem;
    },

    checkReferences: async (id: number): Promise<WarehouseReferencesResponseType> => {
        const { data, error } = await api.settings.warehouses({ id }).references.get();
        if (error) throwApiError(error);
        return data as WarehouseReferencesResponseType;
    },

    delete: async (id: number): Promise<void> => {
        const { error } = await api.settings.warehouses({ id }).delete();
        if (error) throwApiError(error);
    },
};
