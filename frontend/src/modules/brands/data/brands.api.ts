import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';

// =============================================================================
// Types
// =============================================================================

export interface BrandItem {
    id: number;
    company_id: number;
    name: string;
    website: string | null;
    is_active: boolean | null;
    created_at: string;
    updated_at: string;
}

export interface BrandFilters {
    cursor?: string;
    direction?: 'first' | 'next' | 'prev' | 'last';
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    isActive?: string[];
}

// =============================================================================
// API Wrappers — Brands (new top-level /api/brands)
// =============================================================================

export const brandsApi = {
    list: async (params: BrandFilters = {}) => {
        const { data, error } = await api.api.brands.get({
            query: {
                cursor: params.cursor,
                direction: params.direction,
                limit: params.limit,
                search: params.search,
                sortBy: params.sortBy,
                sortOrder: params.sortOrder,
                page: params.page,
                isActive: params.isActive?.join(','),
            },
        });
        if (error) throwApiError(error);
        return data!;
    },

    /** Simple list for selectors (all active) */
    listAll: async (): Promise<BrandItem[]> => {
        const { data, error } = await (api.api.brands as any).all.get();
        if (error) throw new Error(String(error.value));
        return data as BrandItem[];
    },

    create: async (body: { name: string; website?: string }) => {
        const { data, error } = await api.api.brands.post(body as any);
        if (error) throwApiError(error);
        return data!;
    },

    update: async (id: number, body: Partial<{ name: string; website: string; is_active: boolean }>) => {
        const { data, error } = await (api.api.brands as any)({ id }).put(body);
        if (error) throwApiError(error);
        return data!;
    },

    deactivate: async (id: number) => {
        const { data, error } = await (api.api.brands as any)({ id }).deactivate.patch();
        if (error) throwApiError(error);
        return data!;
    },

    restore: async (id: number) => {
        const { data, error } = await (api.api.brands as any)({ id }).restore.patch();
        if (error) throwApiError(error);
        return data!;
    },

    bulkDeactivate: async (ids: number[]) => {
        const { data, error } = await api.api.brands.bulk.delete({ ids });
        if (error) throwApiError(error);
        return data!;
    },

    bulkRestore: async (ids: number[]) => {
        const { data, error } = await (api.api.brands.bulk.restore as any).patch({ ids });
        if (error) throwApiError(error);
        return data!;
    },
};
