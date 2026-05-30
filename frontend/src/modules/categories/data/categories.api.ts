import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { CategoryFormData, CategoryUpdateData, AttributeDataType } from '@app/schema/frontend';

// =============================================================================
// Types
// =============================================================================

export interface CategoryNode {
    id: number;
    name: string;
    parent_id: number | null;
    description: string | null;
    icon: string | null;
    name_template: string | null;
    sort_order: number | null;
    is_active: boolean;
    path: string;
    depth: number;
    attributeCount: number;
    children: CategoryNode[];
    subRows?: CategoryNode[];
}

export interface CategoryDetail extends Omit<CategoryNode, 'children' | 'attributeCount' | 'subRows'> {
    attributes: Array<{
        id: number;
        attributeDefId: number;
        required: boolean;
        order: number;
        specificOptions: any;
        key: string;
        label: string;
        type: AttributeDataType;
        defaultOptions: any;
    }>;
}

export interface CategoryReferences {
    products: number;
    total: number;
}

// =============================================================================
// API Client
// =============================================================================

export const categoriesApi = {
    listCategories: async (flat = false) => {
        const { data, error } = await api.api.categories.get({ query: { flat: flat ? 'true' : undefined } });
        if (error) throwApiError(error);
        return data!;
    },

    getCategory: async (id: number) => {
        const { data, error } = await api.api.categories({ id }).get();
        if (error) throwApiError(error);
        return data!;
    },

    getCategoryFormSchema: async (id: number) => {
        const { data, error } = await (api.api.categories as any)({ id })['form-schema'].get();
        if (error) throwApiError(error);
        return data as any;
    },

    createCategory: async (body: CategoryFormData) => {
        const { data, error } = await api.api.categories.post(body as any);
        if (error) throwApiError(error);
        return data!;
    },

    updateCategory: async (id: number, body: CategoryUpdateData) => {
        const { data, error } = await api.api.categories({ id }).put(body as any);
        if (error) throwApiError(error);
        return data!;
    },

    reparent: async (id: number, parentId: number | null) => {
        const { data, error } = await (api.api.categories as any)({ id }).reparent.patch({ parent_id: parentId });
        if (error) throwApiError(error);
        return data!;
    },

    deactivateCategory: async (id: number) => {
        const { data, error } = await (api.api.categories as any)({ id }).deactivate.patch();
        if (error) throwApiError(error);
        return data!;
    },

    restoreCategory: async (id: number) => {
        const { data, error } = await (api.api.categories as any)({ id }).restore.patch();
        if (error) throwApiError(error);
        return data!;
    },

    checkReferences: async (id: number): Promise<CategoryReferences> => {
        const { data, error } = await (api.api.categories as any)({ id }).references.get();
        if (error) throwApiError(error);
        return data! as CategoryReferences;
    },

    hardDelete: async (id: number) => {
        const { data, error } = await (api.api.categories as any)({ id }).delete();
        if (error) throwApiError(error);
        return data!;
    },

    reorderCategories: async (items: Array<{ id: number; sort_order: number }>) => {
        const { data, error } = await (api.api.categories as any).reorder.patch({ items });
        if (error) throwApiError(error);
        return data!;
    },

    bulkDeactivate: async (ids: number[]) => {
        const { data, error } = await (api.api.categories as any).bulk.delete({ ids });
        if (error) throwApiError(error);
        return data!;
    },

    bulkRestore: async (ids: number[]) => {
        const { data, error } = await (api.api.categories as any).bulk.restore.patch({ ids });
        if (error) throwApiError(error);
        return data!;
    },
};
