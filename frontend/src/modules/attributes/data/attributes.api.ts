import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { AttributeFormData, AttributeDataType } from '@app/schema/frontend';

// =============================================================================
// Types
// =============================================================================

export interface AttributeItem {
    id: number;
    company_id: number;
    key: string;
    label: string;
    type: AttributeDataType;
    default_options: string[] | null;
    is_active: boolean | null;
    created_at: string;
    updated_at: string;
}

export interface AttributeDetail extends AttributeItem {
    usedInCategories: Array<{
        categoryId: number;
        categoryName: string;
        required: boolean | null;
    }>;
}

export interface AttributeReferences {
    categories: number;
    total: number;
}

// =============================================================================
// API Wrappers
// =============================================================================

export const attributesApi = {
    list: async (): Promise<AttributeItem[]> => {
        const { data, error } = await api.api.attributes.get();
        if (error) throwApiError(error);
        return data as unknown as AttributeItem[];
    },

    get: async (id: number): Promise<AttributeDetail> => {
        const { data, error } = await api.api.attributes({ id }).get();
        if (error) throwApiError(error);
        return data as unknown as AttributeDetail;
    },

    create: async (body: AttributeFormData) => {
        const { data, error } = await api.api.attributes.post(body as any);
        if (error) throwApiError(error);
        return data!;
    },

    update: async (id: number, body: AttributeFormData) => {
        // Extract renamedOptions before sending — they're part of the form data
        const { renamedOptions, ...rest } = body;
        const payload: Record<string, any> = { ...rest };
        if (renamedOptions && renamedOptions.length > 0) {
            payload.renamedOptions = renamedOptions;
        }
        const { data, error } = await api.api.attributes({ id }).put(payload as any);
        if (error) throwApiError(error);
        return data!;
    },

    deactivate: async (id: number) => {
        const { error } = await (api.api.attributes as any)({ id }).deactivate.patch();
        if (error) throwApiError(error);
    },

    restore: async (id: number) => {
        const { data, error } = await (api.api.attributes as any)({ id }).restore.patch();
        if (error) throwApiError(error);
        return data!;
    },

    checkReferences: async (id: number): Promise<AttributeReferences> => {
        const { data, error } = await (api.api.attributes as any)({ id }).references.get();
        if (error) throwApiError(error);
        return data! as AttributeReferences;
    },

    hardDelete: async (id: number) => {
        const { data, error } = await (api.api.attributes as any)({ id }).delete();
        if (error) throwApiError(error);
        return data!;
    },
};
