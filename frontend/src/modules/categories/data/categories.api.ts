import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { CategoryFormData, CategoryUpdateData, AttributeDataType } from '@app/schema/frontend';

// =============================================================================
// API Wrappers — Categories
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
    reorderCategories: async (items: Array<{ id: number; sort_order: number }>) => {
        const { data, error } = await (api.api.categories as any).reorder.patch({ items });
        if (error) throwApiError(error);
        return data!;
    },
};

// =============================================================================
// Types — Categories
// =============================================================================

export interface CategoryNode {
    id: number;
    name: string;
    parent_id: number | null;
    description: string | null;
    icon: string | null;
    name_template: string | null;
    sort_order: number;
    is_active: boolean;
    /** Computed by backend from ltree column */
    path: string | null;
    /** Nesting level (0 = root) */
    depth: number;
    attributeCount: number;
    children: CategoryNode[];
}

export interface CategoryDetail extends Omit<CategoryNode, 'children' | 'attributeCount'> {
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
