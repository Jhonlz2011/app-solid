import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';

// =============================================================================
// Types
// =============================================================================

export interface BrandItem {
    id: number;
    name: string;
    website: string | null;
    is_active: boolean | null;
}

// =============================================================================
// API Wrappers — Brands
// =============================================================================

export const brandsApi = {
    list: async (): Promise<BrandItem[]> => {
        const { data, error } = await api.api.catalogs.brands.get();
        if (error) throw new Error(String(error.value));
        return data as BrandItem[];
    },

    create: async (body: { name: string; website?: string }) => {
        const { data, error } = await api.api.catalogs.brands.post(body as any);
        if (error) throwApiError(error);
        return data!;
    },

    update: async (id: number, body: Partial<{ name: string; website: string; is_active: boolean }>) => {
        const { data, error } = await (api.api.catalogs.brands as any)({ id }).put(body);
        if (error) throwApiError(error);
        return data!;
    },

    deactivate: async (id: number) => {
        const { data, error } = await (api.api.catalogs.brands as any)({ id }).deactivate.patch();
        if (error) throwApiError(error);
        return data!;
    },

    restore: async (id: number) => {
        const { data, error } = await (api.api.catalogs.brands as any)({ id }).restore.patch();
        if (error) throwApiError(error);
        return data!;
    },
};
