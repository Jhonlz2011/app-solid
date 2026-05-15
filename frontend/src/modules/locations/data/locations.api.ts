import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';

// =============================================================================
// Types
// =============================================================================

export interface LocationItem {
    id: number;
    warehouse_id: number | null;
    parent_id: number | null;
    name: string;
    path: string;
    barcode: string | null;
    type: 'VIEW' | 'INTERNAL';
    depth: number;
    is_active: boolean | null;
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
        barcode?: string | null;
        type?: 'VIEW' | 'INTERNAL';
    }) => {
        const { data, error } = await api.api.locations.post(body as any);
        if (error) throwApiError(error);
        return data!;
    },

    update: async (id: number, body: Partial<{ name: string; barcode: string | null; type: 'VIEW' | 'INTERNAL'; is_active: boolean }>) => {
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
};
