import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { UomItem, UomReferences, UomPayload, UomUpdatePayload } from '@app/schema/dto';

// Re-export shared contracts for local module consumers
export type { UomItem, UomReferences, UomPayload, UomUpdatePayload };

export const uomApi = {
    list: async (): Promise<UomItem[]> => {
        const { data, error } = await api.uom.get();
        if (error) throwApiError(error);
        return data as unknown as UomItem[];
    },

    get: async (id: number): Promise<UomItem> => {
        const { data, error } = await api.uom({ id }).get();
        if (error) throwApiError(error);
        return data as unknown as UomItem;
    },

    create: async (body: UomPayload): Promise<UomItem> => {
        const { data, error } = await api.uom.post(body as any);
        if (error) throwApiError(error);
        return data as unknown as UomItem;
    },

    /** Update by integer id */
    update: async (id: number, body: UomUpdatePayload): Promise<UomItem> => {
        const { data, error } = await (api.uom as any)({ id }).put(body);
        if (error) throwApiError(error);
        return data as unknown as UomItem;
    },

    /** Soft delete (deactivate) — PATCH /:id/deactivate */
    deactivate: async (id: number): Promise<void> => {
        const { error } = await (api.uom as any)({ id }).deactivate.patch();
        if (error) throwApiError(error);
    },

    /** Restore a soft-deleted UOM — PATCH /:id/restore */
    restore: async (id: number): Promise<UomItem> => {
        const { data, error } = await (api.uom as any)({ id }).restore.patch();
        if (error) throwApiError(error);
        return data as unknown as UomItem;
    },

    /** Check references before hard delete */
    checkReferences: async (id: number): Promise<UomReferences> => {
        const { data, error } = await (api.uom as any)({ id }).references.get();
        if (error) throwApiError(error);
        return data! as UomReferences;
    },

    /** Hard delete by integer id (non-system UOMs only) */
    hardDelete: async (id: number): Promise<{ success: boolean }> => {
        const { data, error } = await (api.uom as any)({ id }).delete();
        if (error) throwApiError(error);
        return data as unknown as { success: boolean };
    },
};
