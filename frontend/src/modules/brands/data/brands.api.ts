import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type {
    BrandItem,
    BrandPayload,
    BrandUpdatePayload,
    BrandFilters,
    BrandReferences,
} from '@app/schema/dto';

// Re-export shared contracts for local module consumers
export type { BrandItem, BrandPayload, BrandUpdatePayload, BrandFilters, BrandReferences };

// =============================================================================
// API Wrappers — Brands (/api/brands)
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

    /** Get single brand by ID */
    get: async (id: number): Promise<BrandItem> => {
        const { data, error } = await api.api.brands({ id }).get();
        if (error) throwApiError(error);
        return data as unknown as BrandItem;
    },

    /** Simple list for selectors (all active) */
    listAll: async (): Promise<BrandItem[]> => {
        const { data, error } = await (api.api.brands as any).all.get();
        if (error) throwApiError(error);
        return data as unknown as BrandItem[];
    },

    create: async (body: BrandPayload): Promise<BrandItem> => {
        const { data, error } = await api.api.brands.post(body as any);
        if (error) throwApiError(error);
        return data as unknown as BrandItem;
    },

    update: async (id: number, body: BrandUpdatePayload): Promise<BrandItem> => {
        const { data, error } = await api.api.brands({ id }).put(body as any);
        if (error) throwApiError(error);
        return data as unknown as BrandItem;
    },

    deactivate: async (id: number): Promise<BrandItem> => {
        const { data, error } = await (api.api.brands as any)({ id }).deactivate.patch();
        if (error) throwApiError(error);
        return data as unknown as BrandItem;
    },

    restore: async (id: number): Promise<BrandItem> => {
        const { data, error } = await (api.api.brands as any)({ id }).restore.patch();
        if (error) throwApiError(error);
        return data as unknown as BrandItem;
    },

    checkReferences: async (id: number): Promise<BrandReferences> => {
        const { data, error } = await (api.api.brands as any)({ id }).references.get();
        if (error) throwApiError(error);
        return data! as BrandReferences;
    },

    hardDelete: async (id: number): Promise<{ success: boolean }> => {
        const { data, error } = await (api.api.brands as any)({ id }).delete();
        if (error) throwApiError(error);
        return data as unknown as { success: boolean };
    },

    bulkDeactivate: async (ids: number[]): Promise<{ success: boolean; count: number }> => {
        const { data, error } = await api.api.brands.bulk.delete({ ids });
        if (error) throwApiError(error);
        return data as unknown as { success: boolean; count: number };
    },

    bulkRestore: async (ids: number[]): Promise<{ success: boolean; count: number }> => {
        const { data, error } = await (api.api.brands.bulk.restore as any).patch({ ids });
        if (error) throwApiError(error);
        return data as unknown as { success: boolean; count: number };
    },
};
