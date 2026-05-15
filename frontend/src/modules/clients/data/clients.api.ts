/**
 * clients.api.ts — Pure Eden API fetchers for Clients module
 *
 * Strictly fetchers — no hooks, no types, no mutations.
 * All response types inferred from backend response schemas.
 */
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { EntityFilters, EntityReferences } from '@app/schema/shared-dto';

export const clientsApi = {
    list: async (params: EntityFilters) => {
        const { data, error } = await api.api.clients.get({
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
        const { data, error } = await api.api.clients({ id }).get();
        if (error) throwApiError(error);
        return data!;
    },

    deactivate: async (id: number) => {
        const path = api.api.clients({ id });
        const { error } = await (path as any).deactivate.patch();
        if (error) throwApiError(error);
    },

    restore: async (id: number) => {
        const path = api.api.clients({ id });
        const { error } = await (path as any).restore.patch();
        if (error) throwApiError(error);
    },

    hardDelete: async (id: number) => {
        const path = api.api.clients({ id });
        const { error } = await (path as any).delete();
        if (error) throwApiError(error);
    },

    bulkDelete: async (ids: number[]) => {
        const { data, error } = await api.api.clients.bulk.delete({ ids });
        if (error) throwApiError(error);
        return data!;
    },

    bulkRestore: async (ids: number[]) => {
        const { data, error } = await (api.api.clients.bulk.restore as any).patch({ ids });
        if (error) throwApiError(error);
        return data!;
    },

    canDelete: async (id: number): Promise<EntityReferences> => {
        const path = api.api.clients({ id });
        const { data, error } = await (path as any)['can-delete'].get();
        if (error) throwApiError(error);
        return data as EntityReferences;
    },

    // ─── SRI (Ecuador tax authority) ──────────────────────────────
    sriSearchByRuc: async (ruc: string) => {
        const { data, error } = await api.api.sri['by-ruc'].get({
            query: { q: ruc },
        });
        if (error) throwApiError(error);
        return data!;
    },

    sriSearchByName: async (name: string) => {
        const { data, error } = await api.api.sri['by-name'].get({
            query: { q: name },
        });
        if (error) throwApiError(error);
        return data!;
    },
};

// =============================================================================
// Eden-inferred types (zero manual interfaces)
// =============================================================================

type ClientsListResponse = Awaited<ReturnType<typeof api.api.clients.get>>['data'];
export type ClientListItem = NonNullable<ClientsListResponse>['data'][number];

/** SRI response type — inferred from Eden */
export type SriClientResponse = Awaited<ReturnType<typeof clientsApi.sriSearchByRuc>>[number];
