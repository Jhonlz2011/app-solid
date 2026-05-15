import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';

// =============================================================================
// Types
// =============================================================================

export interface FamilyItem {
    id: number;
    name: string;
    category_id: number | null;
    categoryName: string | null;
    description: string | null;
    is_active: boolean | null;
}

// =============================================================================
// API Wrappers — Families
// =============================================================================

export const familiesApi = {
    list: async (): Promise<FamilyItem[]> => {
        const { data, error } = await (api.api.catalogs as any).families.get();
        if (error) throw new Error(String(error.value));
        return data as FamilyItem[];
    },

    create: async (body: { name: string; categoryId?: number; description?: string }) => {
        const { data, error } = await (api.api.catalogs as any).families.post(body);
        if (error) throwApiError(error);
        return data!;
    },

    update: async (id: number, body: Partial<{ name: string; categoryId: number | null; description: string | null }>) => {
        const { data, error } = await (api.api.catalogs as any).families({ id }).put(body);
        if (error) throwApiError(error);
        return data!;
    },

    deactivate: async (id: number) => {
        const { data, error } = await (api.api.catalogs as any).families({ id }).deactivate.patch();
        if (error) throwApiError(error);
        return data!;
    },

    restore: async (id: number) => {
        const { data, error } = await (api.api.catalogs as any).families({ id }).restore.patch();
        if (error) throwApiError(error);
        return data!;
    },
};
