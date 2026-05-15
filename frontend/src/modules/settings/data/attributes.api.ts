import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { AttributeFormData, AttributeDataType } from '@app/schema/frontend';

// =============================================================================
// API Wrappers — Attributes
// =============================================================================

export const attributesApi = {
    listAttributes: async () => {
        const { data, error } = await api.api.attributes.get();
        if (error) throwApiError(error);
        return data!;
    },
    getAttribute: async (id: number) => {
        const { data, error } = await api.api.attributes({ id }).get();
        if (error) throwApiError(error);
        return data!;
    },
    createAttribute: async (body: AttributeFormData) => {
        const { data, error } = await api.api.attributes.post(body as any);
        if (error) throwApiError(error);
        return data!;
    },
    updateAttribute: async (id: number, body: AttributeFormData) => {
        const { data, error } = await api.api.attributes({ id }).put(body as any);
        if (error) throwApiError(error);
        return data!;
    },
    deactivateAttribute: async (id: number) => {
        const { data, error } = await (api.api.attributes as any)({ id }).deactivate.patch();
        if (error) throwApiError(error);
        return data!;
    },
    restoreAttribute: async (id: number) => {
        const { data, error } = await (api.api.attributes as any)({ id }).restore.patch();
        if (error) throwApiError(error);
        return data!;
    },
};

// =============================================================================
// Types
// =============================================================================

export interface AttributeDef {
    id: number;
    key: string;
    label: string;
    type: AttributeDataType;
    default_options: string[] | null;
    is_active: boolean;
}

export interface AttributeDetail extends AttributeDef {
    usedInCategories: Array<{
        categoryId: number;
        categoryName: string;
        required: boolean;
    }>;
}
