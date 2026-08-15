import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { AttributeFormData } from '@app/schema/frontend';
import type { AttributeItem, AttributeDetail, AttributeReferences } from '@app/schema/dto';

// Re-export shared contracts for local module consumers
export type { AttributeItem, AttributeDetail, AttributeReferences };

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

    create: async (body: AttributeFormData): Promise<AttributeItem> => {
        const { data, error } = await api.api.attributes.post(body as any);
        if (error) throwApiError(error);
        return data as unknown as AttributeItem;
    },

    update: async (id: number, body: AttributeFormData): Promise<AttributeItem> => {
        // Extract renamedOptions before sending — they're part of the form data
        const { renamedOptions, ...rest } = body;
        const payload: Record<string, any> = { ...rest };
        if (renamedOptions && renamedOptions.length > 0) {
            payload.renamedOptions = renamedOptions;
        }
        const { data, error } = await api.api.attributes({ id }).put(payload as any);
        if (error) throwApiError(error);
        return data as unknown as AttributeItem;
    },

    deactivate: async (id: number): Promise<void> => {
        const { error } = await (api.api.attributes as any)({ id }).deactivate.patch();
        if (error) throwApiError(error);
    },

    restore: async (id: number): Promise<AttributeItem> => {
        const { data, error } = await (api.api.attributes as any)({ id }).restore.patch();
        if (error) throwApiError(error);
        return data as unknown as AttributeItem;
    },

    checkReferences: async (id: number): Promise<AttributeReferences> => {
        const { data, error } = await (api.api.attributes as any)({ id }).references.get();
        if (error) throwApiError(error);
        return data as unknown as AttributeReferences;
    },

    hardDelete: async (id: number): Promise<{ success: boolean }> => {
        const { data, error } = await (api.api.attributes as any)({ id }).delete();
        if (error) throwApiError(error);
        return data as unknown as { success: boolean };
    },
};
