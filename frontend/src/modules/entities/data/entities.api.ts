/**
 * entities.api.ts — Pure Eden API fetchers for Generic Entities
 *
 * This acts as a generic factory for creating typed API clients for
 * suppliers, clients, employees, and carriers using Elysia/Eden.
 */
import { throwApiError } from '@shared/utils/api-errors';
import type { EntityFilters, EntityReferencesType } from '@app/schema/dto';
import type { api } from '@shared/lib/eden';

export type AnyEntityEndpoint = typeof api.suppliers;

export function createEntityApi(endpoint: AnyEntityEndpoint) {
    return {
        list: async (params: EntityFilters) => {
            const { data, error } = await endpoint.get({
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

        get: async (id: string | number) => {
            const { data, error } = await endpoint({ id }).get();
            if (error) throwApiError(error);
            return data!;
        },

        deactivate: async (id: string | number) => {
            const { error } = await endpoint({ id }).deactivate.patch();
            if (error) throwApiError(error);
        },

        restore: async (id: string | number) => {
            const { error } = await endpoint({ id }).restore.patch();
            if (error) throwApiError(error);
        },

        hardDelete: async (id: string | number) => {
            const { error } = await endpoint({ id }).delete();
            if (error) throwApiError(error);
        },

        bulkDelete: async (ids: (number | string)[]) => {
            const { data, error } = await endpoint.bulk.delete({ ids });
            if (error) throwApiError(error);
            return data!;
        },

        bulkRestore: async (ids: (number | string)[]) => {
            const { data, error } = await endpoint.bulk.restore.patch({ ids });
            if (error) throwApiError(error);
            return data!;
        },

        canDelete: async (id: string | number): Promise<EntityReferencesType> => {
            const { data, error } = await endpoint({ id })['can-delete'].get();
            if (error) throwApiError(error);
            return data!;
        },
    };
}

export type EntityApi = ReturnType<typeof createEntityApi>;
export type EntityListItem = Awaited<ReturnType<EntityApi['list']>>['data'][number];
export type EntityListResponse = Awaited<ReturnType<EntityApi['list']>>;
