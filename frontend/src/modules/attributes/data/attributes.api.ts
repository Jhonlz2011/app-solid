import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { AttributeFormData } from '@app/schema/frontend';
import type { AttributeItem, AttributeDetail, AttributeReferences } from '@app/schema/dto';

// Re-export shared contracts for local module consumers
export type { AttributeItem, AttributeDetail, AttributeReferences };

// =============================================================================
// API Wrappers — Attributes (/api/attributes)
// =============================================================================

export const attributesApi = {
    list: async (): Promise<AttributeItem[]> => {
        const { data, error } = await api.attributes.get();
        if (error) throwApiError(error);
        return (data as AttributeItem[]) || [];
    },

    get: async (id: number): Promise<AttributeDetail> => {
        const { data, error } = await api.attributes({ id }).get();
        if (error) throwApiError(error);
        return data as AttributeDetail;
    },

    create: async (body: AttributeFormData): Promise<AttributeItem> => {
        const { data, error } = await api.attributes.post(body as any);
        if (error) throwApiError(error);
        return data as AttributeItem;
    },

    update: async (id: number, body: AttributeFormData): Promise<AttributeItem> => {
        const { renamedOptions, ...rest } = body;
        const payload: Record<string, any> = { ...rest };
        if (renamedOptions && renamedOptions.length > 0) {
            payload.renamedOptions = renamedOptions;
        }
        const { data, error } = await api.attributes({ id }).put(payload as any);
        if (error) throwApiError(error);
        return data as AttributeItem;
    },

    deactivate: async (id: number): Promise<void> => {
        const { error } = await api.attributes({ id }).deactivate.patch();
        if (error) throwApiError(error);
    },

    restore: async (id: number): Promise<AttributeItem> => {
        const { data, error } = await api.attributes({ id }).restore.patch();
        if (error) throwApiError(error);
        return data as AttributeItem;
    },

    checkReferences: async (id: number): Promise<AttributeReferences> => {
        const { data, error } = await api.attributes({ id }).references.get();
        if (error) throwApiError(error);
        return data as AttributeReferences;
    },

    hardDelete: async (id: number): Promise<{ success: boolean }> => {
        const { data, error } = await api.attributes({ id }).delete();
        if (error) throwApiError(error);
        return data as { success: boolean };
    },
};
