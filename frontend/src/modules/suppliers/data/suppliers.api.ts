/**
 * suppliers.api.ts — Pure Eden API fetchers for Suppliers module
 *
 * Strictly fetchers — no hooks, no types, no mutations.
 * All response types inferred from backend response schemas.
 */
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { EntityFilters, EntityReferences } from '@app/schema/shared-dto';

export const suppliersApi = {
    list: async (params: EntityFilters) => {
        const { data, error } = await api.api.suppliers.get({
            query: {
                cursor: params.cursor,
                direction: params.direction,
                limit: params.limit,
                search: params.search,
                sortBy: params.sortBy,
                sortOrder: params.sortOrder,
                page: params.page,
                personType: params.personType?.join(','),
                taxIdType: params.taxIdType?.join(','),
                isActive: params.isActive?.join(','),
                businessName: params.businessName?.join(','),
            },
        });
        if (error) throwApiError(error);
        return data!;
    },

    get: async (id: number) => {
        const { data, error } = await api.api.suppliers({ id }).get();
        if (error) throwApiError(error);
        return data!;
    },

    deactivate: async (id: number) => {
        const path = api.api.suppliers({ id });
        const { error } = await (path as any).deactivate.patch();
        if (error) throwApiError(error);
    },

    restore: async (id: number) => {
        const path = api.api.suppliers({ id });
        const { error } = await (path as any).restore.patch();
        if (error) throwApiError(error);
    },

    hardDelete: async (id: number) => {
        const path = api.api.suppliers({ id });
        const { error } = await (path as any).delete();
        if (error) throwApiError(error);
    },

    bulkDelete: async (ids: number[]) => {
        const { data, error } = await api.api.suppliers.bulk.delete({ ids });
        if (error) throwApiError(error);
        return data!;
    },

    bulkRestore: async (ids: number[]) => {
        const { data, error } = await (api.api.suppliers.bulk.restore as any).patch({ ids });
        if (error) throwApiError(error);
        return data!;
    },

    canDelete: async (id: number): Promise<EntityReferences> => {
        const path = api.api.suppliers({ id });
        const { data, error } = await (path as any)['can-delete'].get();
        if (error) throwApiError(error);
        return data as EntityReferences;
    },
};

// =============================================================================
// Eden-inferred types (zero manual interfaces)
// =============================================================================

type SuppliersListResponse = Awaited<ReturnType<typeof api.api.suppliers.get>>['data'];
export type SupplierListItem = NonNullable<SuppliersListResponse>['data'][number];
