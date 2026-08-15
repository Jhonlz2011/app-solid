import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { CategoryFormData, CategoryUpdateData } from '@app/schema/frontend';
import type {
    CategoryNode,
    CategoryDetail,
    CategoryFormSchemaData,
    CategoryReferences,
    CategoryPayload,
    CategoryUpdatePayload,
} from '@app/schema/dto';

// Re-export shared contracts for local module consumers
export type {
    CategoryNode,
    CategoryDetail,
    CategoryFormSchemaData,
    CategoryReferences,
    CategoryPayload,
    CategoryUpdatePayload,
};

// =============================================================================
// API Client
// =============================================================================

export const categoriesApi = {
    listCategories: async (flat = false): Promise<CategoryNode[]> => {
        const { data, error } = await api.api.categories.get({ query: { flat: flat ? 'true' : undefined } });
        if (error) throwApiError(error);
        return data as unknown as CategoryNode[];
    },

    getCategory: async (id: number): Promise<CategoryDetail> => {
        const { data, error } = await api.api.categories({ id }).get();
        if (error) throwApiError(error);
        return data as unknown as CategoryDetail;
    },

    getCategoryFormSchema: async (id: number): Promise<CategoryFormSchemaData> => {
        const { data, error } = await (api.api.categories as any)({ id })['form-schema'].get();
        if (error) throwApiError(error);
        return data as unknown as CategoryFormSchemaData;
    },

    createCategory: async (body: CategoryFormData): Promise<CategoryNode> => {
        const { data, error } = await api.api.categories.post(body as any);
        if (error) throwApiError(error);
        return data as unknown as CategoryNode;
    },

    updateCategory: async (id: number, body: CategoryUpdateData): Promise<CategoryNode> => {
        const { data, error } = await api.api.categories({ id }).put(body as any);
        if (error) throwApiError(error);
        return data as unknown as CategoryNode;
    },

    reparent: async (id: number, parentId: number | null): Promise<CategoryNode> => {
        const { data, error } = await (api.api.categories as any)({ id }).reparent.patch({ parent_id: parentId });
        if (error) throwApiError(error);
        return data as unknown as CategoryNode;
    },

    deactivateCategory: async (id: number): Promise<CategoryNode> => {
        const { data, error } = await (api.api.categories as any)({ id }).deactivate.patch();
        if (error) throwApiError(error);
        return data as unknown as CategoryNode;
    },

    restoreCategory: async (id: number): Promise<CategoryNode> => {
        const { data, error } = await (api.api.categories as any)({ id }).restore.patch();
        if (error) throwApiError(error);
        return data as unknown as CategoryNode;
    },

    checkReferences: async (id: number): Promise<CategoryReferences> => {
        const { data, error } = await (api.api.categories as any)({ id }).references.get();
        if (error) throwApiError(error);
        return data as unknown as CategoryReferences;
    },

    hardDelete: async (id: number): Promise<{ success: boolean }> => {
        const { data, error } = await (api.api.categories as any)({ id }).delete();
        if (error) throwApiError(error);
        return data as unknown as { success: boolean };
    },

    reorderCategories: async (items: Array<{ id: number; sort_order: number }>): Promise<{ updated: number }> => {
        const { data, error } = await (api.api.categories as any).reorder.patch({ items });
        if (error) throwApiError(error);
        return data as unknown as { updated: number };
    },

    bulkDeactivate: async (ids: number[]): Promise<{ success: boolean; count: number }> => {
        const { data, error } = await (api.api.categories as any).bulk.delete({ ids });
        if (error) throwApiError(error);
        return data as unknown as { success: boolean; count: number };
    },

    bulkRestore: async (ids: number[]): Promise<{ success: boolean; count: number }> => {
        const { data, error } = await (api.api.categories as any).bulk.restore.patch({ ids });
        if (error) throwApiError(error);
        return data as unknown as { success: boolean; count: number };
    },
};
