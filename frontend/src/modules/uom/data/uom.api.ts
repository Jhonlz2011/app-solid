import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';

// =============================================================================
// Types
// =============================================================================

export interface UomItem {
    id: number;
    code: string;
    name: string;
    uom_group: string;
    base_factor: string | null;
    company_id: number | null;
    is_system: boolean;
    is_active: boolean | null;
    created_at: string;
    updated_at: string;
}

export interface UomReferences {
    products: number;
    variants: number;
    supplierProducts: number;
    conversions: number;
    workOrderItems: number;
    quoteItems: number;
    total: number;
}

export const uomApi = {
    list: async (): Promise<UomItem[]> => {
        const { data, error } = await api.api.uom.get();
        if (error) throwApiError(error);
        return data as unknown as UomItem[];
    },

    create: async (body: { code: string; name: string; uom_group: string; base_factor?: string }) => {
        const { data, error } = await api.api.uom.post(body as any);
        if (error) throwApiError(error);
        return data!;
    },

    /** Update by integer id */
    update: async (id: number, body: Partial<{ name: string; uom_group: string; base_factor: string; is_active: boolean }>) => {
        const { data, error } = await (api.api.uom as any)({ id }).put(body);
        if (error) throwApiError(error);
        return data!;
    },

    /** Soft delete (deactivate) — PATCH /:id/deactivate */
    deactivate: async (id: number) => {
        const { error } = await (api.api.uom as any)({ id }).deactivate.patch();
        if (error) throwApiError(error);
    },

    /** Restore a soft-deleted UOM — PATCH /:id/restore */
    restore: async (id: number) => {
        const { data, error } = await (api.api.uom as any)({ id }).restore.patch();
        if (error) throwApiError(error);
        return data!;
    },

    /** Check references before hard delete */
    checkReferences: async (id: number): Promise<UomReferences> => {
        const { data, error } = await (api.api.uom as any)({ id }).references.get();
        if (error) throwApiError(error);
        return data! as UomReferences;
    },

    /** Hard delete by integer id (non-system UOMs only) */
    hardDelete: async (id: number) => {
        const { data, error } = await (api.api.uom as any)({ id }).delete();
        if (error) throwApiError(error);
        return data!;
    },
};
