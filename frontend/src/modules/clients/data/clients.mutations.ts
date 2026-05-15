/**
 * clients.mutations.ts — TanStack Mutation Hooks for Clients module
 *
 * All `createMutation` hooks with optimistic updates live here.
 */
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { EntityFormData } from '@app/schema/frontend';
import { addOptimisticItem, removeCacheItems, updateCacheItem, type CacheShape } from '@shared/utils/query.utils';
import { clientsApi, type ClientListItem } from './clients.api';
import { clientKeys } from './clients.keys';

// =============================================================================
// Shared Mutation Helpers (DRY within module)
// =============================================================================

/** Shared onSettled for all client mutations — invalidates list + facet caches */
function clientOnSettled(queryClient: ReturnType<typeof useQueryClient>) {
    return () => {
        queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
        queryClient.invalidateQueries({ queryKey: [...clientKeys.all, 'facets'], exact: false });
    };
}

/** Applies `is_active` patch for multiple IDs via sequential updateCacheItem calls. */
function applyIsActiveToCache(
    queryClient: ReturnType<typeof useQueryClient>,
    ids: number[],
    isActive: boolean
) {
    queryClient.setQueriesData<CacheShape<ClientListItem>>({ queryKey: clientKeys.lists() }, (old) => {
        if (!old) return old;
        return ids.reduce<CacheShape<ClientListItem>>(
            (acc, id) => updateCacheItem(acc, { id, is_active: isActive } as unknown as ClientListItem) ?? acc,
            old
        );
    });
}

// =============================================================================
// Create
// =============================================================================

export function useCreateClient() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (body: EntityFormData) => {
            const { data, error } = await api.api.clients.post(body);
            if (error) throwApiError(error);
            return data!;
        },
        onMutate: async (newClient) => {
            await queryClient.cancelQueries({ queryKey: clientKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: clientKeys.lists() });

            queryClient.setQueriesData<CacheShape<ClientListItem>>({ queryKey: clientKeys.lists() }, (old) => {
                if (!old) return old;
                const optimisticClient = {
                    id: -Date.now(),
                    business_name: newClient.businessName,
                    trade_name: newClient.tradeName,
                    tax_id: newClient.taxId,
                    is_active: true,
                    _optimistic: true,
                } as unknown as ClientListItem;

                return addOptimisticItem(old, optimisticClient);
            });

            return { previousLists };
        },
        onError: (_err: unknown, _newClient: EntityFormData, context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => {
                queryClient.setQueryData(key as any, data);
            });
        },
        onSettled: clientOnSettled(queryClient),
    }));
}

// =============================================================================
// Update
// =============================================================================

export function useUpdateClient() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async ({ id, data: body }: { id: number; data: Partial<EntityFormData> }) => {
            const { data, error } = await api.api.clients({ id }).put(body);
            if (error) throwApiError(error);
            return data!;
        },
        onMutate: async ({ id, data: updates }) => {
            await queryClient.cancelQueries({ queryKey: clientKeys.detail(id) });
            const previousClient = queryClient.getQueryData(clientKeys.detail(id));

            if (previousClient) {
                queryClient.setQueryData(clientKeys.detail(id), (old: unknown) => {
                    if (!old || typeof old !== 'object') return old;
                    return { ...old as object, ...updates };
                });
            }

            return { previousClient };
        },
        onError: (_err, { id }, context) => {
            if (context?.previousClient) {
                queryClient.setQueryData(clientKeys.detail(id), context.previousClient);
            }
        },
        onSettled: (_data, _err, { id }) => {
            queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
            queryClient.invalidateQueries({ queryKey: clientKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: [...clientKeys.all, 'facets'], exact: false });
        },
    }));
}

// =============================================================================
// Deactivate (soft delete)
// =============================================================================

export function useDeleteClient() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (id: number) => {
            await clientsApi.deactivate(id);
            return id;
        },
        onMutate: async (id: number) => {
            await queryClient.cancelQueries({ queryKey: clientKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: clientKeys.lists() });
            applyIsActiveToCache(queryClient, [id], false);
            return { previousLists };
        },
        onError: (_err: unknown, _id: number, context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
        },
        onSettled: clientOnSettled(queryClient),
    }));
}

// =============================================================================
// Bulk Deactivate
// =============================================================================

export function useBulkDeleteClient() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (ids: number[]) => {
            return await clientsApi.bulkDelete(ids);
        },
        onMutate: async (ids: number[]) => {
            await queryClient.cancelQueries({ queryKey: clientKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: clientKeys.lists() });
            applyIsActiveToCache(queryClient, ids, false);
            return { previousLists };
        },
        onError: (_err: unknown, _ids: number[], context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
        },
        onSettled: clientOnSettled(queryClient),
    }));
}

// =============================================================================
// Bulk Restore
// =============================================================================

export function useBulkRestoreClient() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (ids: number[]) => {
            return await clientsApi.bulkRestore(ids);
        },
        onMutate: async (ids: number[]) => {
            await queryClient.cancelQueries({ queryKey: clientKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: clientKeys.lists() });
            applyIsActiveToCache(queryClient, ids, true);
            return { previousLists };
        },
        onError: (_err: unknown, _ids: number[], context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
        },
        onSettled: clientOnSettled(queryClient),
    }));
}

// =============================================================================
// Restore (single)
// =============================================================================

export function useRestoreClient() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (id: number) => {
            await clientsApi.restore(id);
            return id;
        },
        onMutate: async (id: number) => {
            await queryClient.cancelQueries({ queryKey: clientKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: clientKeys.lists() });
            applyIsActiveToCache(queryClient, [id], true);
            return { previousLists };
        },
        onError: (_err: unknown, _id: number, context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
        },
        onSettled: clientOnSettled(queryClient),
    }));
}

// =============================================================================
// Hard Delete (permanent)
// =============================================================================

export function useHardDeleteClient() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (id: number) => {
            await clientsApi.hardDelete(id);
            return id;
        },
        onMutate: async (id: number) => {
            await queryClient.cancelQueries({ queryKey: clientKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: clientKeys.lists() });

            queryClient.setQueriesData<CacheShape<ClientListItem>>({ queryKey: clientKeys.lists() }, (old) => {
                if (!old) return old;
                return removeCacheItems(old, [id]);
            });

            return { previousLists };
        },
        onError: (_err: unknown, _id: number, context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => {
                queryClient.setQueryData(key as any, data);
            });
        },
        onSettled: clientOnSettled(queryClient),
    }));
}
