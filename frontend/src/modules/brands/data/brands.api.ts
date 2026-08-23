import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type {
    BrandItem,
    BrandBodyType,
    BrandUpdateType,
    BrandFilters,
    BrandReferencesType,
    PaginatedResult,
} from '@app/schema/dto';

// Re-export shared contracts for local module consumers
export type { BrandItem, BrandBodyType, BrandUpdateType, BrandFilters, BrandReferencesType, PaginatedResult };

// =============================================================================
// API Wrappers — Brands (/api/brands)
// =============================================================================

export const brandsApi = {
    list: async (params: BrandFilters = {}): Promise<PaginatedResult<BrandItem>> => {
        const { data, error } = await api.brands.get({
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
        return data as PaginatedResult<BrandItem>;
    },

    /** Get single brand by ID */
    get: async (id: number): Promise<BrandItem> => {
        const { data, error } = await api.brands({ id }).get();
        if (error) throwApiError(error);
        return data as BrandItem;
    },

    /** Simple list for selectors (all active) */
    listAll: async (): Promise<BrandItem[]> => {
        const { data, error } = await api.brands.all.get();
        if (error) throwApiError(error);
        return (data as BrandItem[]) || [];
    },

    create: async (body: BrandBodyType): Promise<BrandItem> => {
        const { data, error } = await api.brands.post(body);
        if (error) throwApiError(error);
        return data as BrandItem;
    },

    update: async (id: number, body: BrandUpdateType): Promise<BrandItem> => {
        const { data, error } = await api.brands({ id }).put(body);
        if (error) throwApiError(error);
        return data as BrandItem;
    },

    deactivate: async (id: number): Promise<BrandItem> => {
        const { data, error } = await api.brands({ id }).deactivate.patch();
        if (error) throwApiError(error);
        return data as BrandItem;
    },

    restore: async (id: number): Promise<BrandItem> => {
        const { data, error } = await api.brands({ id }).restore.patch();
        if (error) throwApiError(error);
        return data as BrandItem;
    },

    checkReferences: async (id: number): Promise<BrandReferencesType> => {
        const { data, error } = await api.brands({ id }).references.get();
        if (error) throwApiError(error);
        return data as BrandReferencesType;
    },

    hardDelete: async (id: number): Promise<{ success: boolean }> => {
        const { data, error } = await api.brands({ id }).delete();
        if (error) throwApiError(error);
        return data as { success: boolean };
    },

    bulkDeactivate: async (ids: number[]): Promise<{ success: boolean; count: number }> => {
        const { data, error } = await api.brands.bulk.delete({ ids });
        if (error) throwApiError(error);
        return data as { success: boolean; count: number };
    },

    bulkRestore: async (ids: number[]): Promise<{ success: boolean; count: number }> => {
        const { data, error } = await api.brands.bulk.restore.patch({ ids });
        if (error) throwApiError(error);
        return data as { success: boolean; count: number };
    },
};
