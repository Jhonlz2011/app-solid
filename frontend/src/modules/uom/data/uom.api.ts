import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { UomItem, UomReferencesResponseType, UomBodyType, UomUpdateType } from '@app/schema/dto';

// Re-export shared contracts for local module consumers
export type { UomItem, UomReferencesResponseType, UomBodyType, UomUpdateType };

export const uomApi = {
    list: async (): Promise<UomItem[]> => {
        const { data, error } = await api.uom.get();
        if (error) throwApiError(error);
        return (data as UomItem[]) || [];
    },

    get: async (id: number): Promise<UomItem> => {
        const { data, error } = await api.uom({ id }).get();
        if (error) throwApiError(error);
        return data as UomItem;
    },

    create: async (body: UomBodyType): Promise<UomItem> => {
        const { data, error } = await api.uom.post(body);
        if (error) throwApiError(error);
        return data as UomItem;
    },

    /** Update by integer id */
    update: async (id: number, body: UomUpdateType): Promise<UomItem> => {
        const { data, error } = await api.uom({ id }).put(body);
        if (error) throwApiError(error);
        return data as UomItem;
    },

    /** Soft delete (deactivate) — PATCH /:id/deactivate */
    deactivate: async (id: number): Promise<void> => {
        const { error } = await api.uom({ id }).deactivate.patch();
        if (error) throwApiError(error);
    },

    /** Restore a soft-deleted UOM — PATCH /:id/restore */
    restore: async (id: number): Promise<UomItem> => {
        const { data, error } = await api.uom({ id }).restore.patch();
        if (error) throwApiError(error);
        return data as UomItem;
    },

    /** Check references before hard delete */
    checkReferences: async (id: number): Promise<UomReferencesResponseType> => {
        const { data, error } = await api.uom({ id }).references.get();
        if (error) throwApiError(error);
        return data! as UomReferencesResponseType;
    },

    /** Hard delete by integer id (non-system UOMs only) */
    hardDelete: async (id: number): Promise<{ success: boolean }> => {
        const { data, error } = await api.uom({ id }).delete();
        if (error) throwApiError(error);
        return data as { success: boolean };
    },
};
