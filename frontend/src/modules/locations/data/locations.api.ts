import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type {
    LocationItem,
    LocationNode,
    LocationPayload,
    LocationUpdatePayload,
    LocationReferences,
} from '@app/schema/dto';

// Re-export shared contracts for local module consumers
export type { LocationItem, LocationNode, LocationPayload, LocationUpdatePayload, LocationReferences };

export const locationsApi = {
    list: async (warehouseId?: number): Promise<LocationItem[]> => {
        const query = warehouseId !== undefined ? { warehouseId: String(warehouseId) } : {};
        const { data, error } = await api.locations.get({ query });
        if (error) throwApiError(error);
        return data as unknown as LocationItem[];
    },

    get: async (id: number): Promise<LocationItem> => {
        const { data, error } = await api.locations({ id }).get();
        if (error) throwApiError(error);
        return data as unknown as LocationItem;
    },

    create: async (body: LocationPayload): Promise<LocationItem> => {
        const { data, error } = await api.locations.post(body as any);
        if (error) throwApiError(error);
        return data as unknown as LocationItem;
    },

    update: async (id: number, body: LocationUpdatePayload): Promise<LocationItem> => {
        const { data, error } = await (api.locations as any)({ id }).put(body);
        if (error) throwApiError(error);
        return data as unknown as LocationItem;
    },

    reparent: async (id: number, parentId: number | null): Promise<LocationItem> => {
        const { data, error } = await (api.locations as any)({ id }).reparent.patch({ parent_id: parentId });
        if (error) throwApiError(error);
        return data as unknown as LocationItem;
    },

    deactivate: async (id: number): Promise<void> => {
        const { error } = await (api.locations as any)({ id }).deactivate.patch();
        if (error) throwApiError(error);
    },

    restore: async (id: number): Promise<LocationItem> => {
        const { data, error } = await (api.locations as any)({ id }).restore.patch();
        if (error) throwApiError(error);
        return data as unknown as LocationItem;
    },

    checkReferences: async (id: number): Promise<LocationReferences> => {
        const { data, error } = await (api.locations as any)({ id }).references.get();
        if (error) throwApiError(error);
        return data! as LocationReferences;
    },

    hardDelete: async (id: number): Promise<{ success: boolean }> => {
        const { data, error } = await (api.locations as any)({ id }).delete();
        if (error) throwApiError(error);
        return data as unknown as { success: boolean };
    },

    bulkDeactivate: async (ids: number[]) => {
        const { data, error } = await api.locations.bulk.delete({ ids });
        if (error) throwApiError(error);
        return data!;
    },

    bulkRestore: async (ids: number[]) => {
        const { data, error } = await (api.locations.bulk.restore as any).patch({ ids });
        if (error) throwApiError(error);
        return data!;
    },
};
