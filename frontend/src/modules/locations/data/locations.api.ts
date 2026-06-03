import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { LocationType } from '@app/schema/enums';

// =============================================================================
// Types
// =============================================================================

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
    // Joined from warehouses table
    warehouse_name: string | null;
    warehouse_code: string | null;
    /** Cantidad total de productos con stock en esta ubicación */
    product_count: number;
}

/** Extended with subRows for TanStack Table tree rendering */
export interface LocationNode extends LocationItem {
    subRows?: LocationNode[];
}

export interface LocationReferences {
    stock: number;
    movementsSrc: number;
    movementsDest: number;
    dimensionalItems: number;
    total: number;
}

// =============================================================================
// API Client
// =============================================================================

export const locationsApi = {
    list: async (warehouseId?: number): Promise<LocationItem[]> => {
        const query = warehouseId ? { warehouseId: String(warehouseId) } : {};
        const { data, error } = await api.api.locations.get({ query });
        if (error) throwApiError(error);
        return data as unknown as LocationItem[];
    },

    create: async (body: {
        warehouse_id?: number | null;
        parent_id?: number | null;
        name: string;
        type?: LocationType;
    }) => {
        const { data, error } = await api.api.locations.post(body);
        if (error) throwApiError(error);
        return data!;
    },

    update: async (id: number, body: Partial<{ name: string; type: LocationType; warehouse_id: number | null; parent_id: number | null; is_active: boolean }>) => {
        const { data, error } = await (api.api.locations as any)({ id }).put(body);
        if (error) throwApiError(error);
        return data!;
    },

    reparent: async (id: number, parentId: number | null) => {
        const { data, error } = await (api.api.locations as any)({ id }).reparent.patch({ parent_id: parentId });
        if (error) throwApiError(error);
        return data!;
    },

    deactivate: async (id: number) => {
        const { error } = await (api.api.locations as any)({ id }).deactivate.patch();
        if (error) throwApiError(error);
    },

    restore: async (id: number) => {
        const { data, error } = await (api.api.locations as any)({ id }).restore.patch();
        if (error) throwApiError(error);
        return data!;
    },

    checkReferences: async (id: number): Promise<LocationReferences> => {
        const { data, error } = await (api.api.locations as any)({ id }).references.get();
        if (error) throwApiError(error);
        return data! as LocationReferences;
    },

    hardDelete: async (id: number) => {
        const { data, error } = await (api.api.locations as any)({ id }).delete();
        if (error) throwApiError(error);
        return data!;
    },

    bulkDeactivate: async (ids: number[]) => {
        const { data, error } = await api.api.locations.bulk.delete({ ids });
        if (error) throwApiError(error);
        return data!;
    },

    bulkRestore: async (ids: number[]) => {
        const { data, error } = await (api.api.locations.bulk.restore as any).patch({ ids });
        if (error) throwApiError(error);
        return data!;
    },
};
