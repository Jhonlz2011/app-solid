/**
 * suppliers.mutations.ts — TanStack Mutation Hooks for Suppliers module
 *
 * All `createMutation` hooks with optimistic updates live here.
 */
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { EntityFormData } from '@app/schema/frontend';
import { addOptimisticItem, removeCacheItems, updateCacheItem, type CacheShape } from '@shared/utils/query.utils';
import { suppliersApi, type SupplierListItem } from './suppliers.api';
import { supplierKeys } from './suppliers.keys';

// =============================================================================
// Shared Mutation Helpers (DRY within module)
// =============================================================================

/** Shared onSettled for all supplier mutations — invalidates list + facet caches */
function supplierOnSettled(queryClient: ReturnType<typeof useQueryClient>) {
    return () => {
        queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
        queryClient.invalidateQueries({ queryKey: [...supplierKeys.all, 'facets'], exact: false });
    };
}

/** Applies `is_active` patch for multiple IDs via sequential updateCacheItem calls. */
function applyIsActiveToCache(
    queryClient: ReturnType<typeof useQueryClient>,
    ids: number[],
    isActive: boolean
) {
    queryClient.setQueriesData<CacheShape<SupplierListItem>>({ queryKey: supplierKeys.lists() }, (old) => {
        if (!old) return old;
        return ids.reduce<CacheShape<SupplierListItem>>(
            (acc, id) => updateCacheItem(acc, { id, is_active: isActive } as unknown as SupplierListItem) ?? acc,
            old
        );
    });
}

// =============================================================================
// Create
// =============================================================================

export function useCreateSupplier() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationKey: ['suppliers', 'create'],
        mutationFn: async (body: EntityFormData) => {
            const { data, error } = await api.api.suppliers.post(body);
            if (error) throwApiError(error);
            return data!;
        },
        onMutate: async (newSupplier) => {
            await queryClient.cancelQueries({ queryKey: supplierKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: supplierKeys.lists() });

            queryClient.setQueriesData<CacheShape<SupplierListItem>>({ queryKey: supplierKeys.lists() }, (old) => {
                if (!old) return old;
                const optimisticSupplier = {
                    id: -Date.now(),
                    business_name: newSupplier.businessName,
                    trade_name: newSupplier.tradeName,
                    tax_id: newSupplier.taxId,
                    is_active: true,
                    _optimistic: true,
                } as unknown as SupplierListItem;

                return addOptimisticItem(old, optimisticSupplier);
            });

            return { previousLists };
        },
        onError: (_err: unknown, _newSupplier: EntityFormData, context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => {
                queryClient.setQueryData(key as any, data);
            });
        },
        onSettled: supplierOnSettled(queryClient),
    }));
}

// =============================================================================
// Update
// =============================================================================

export function useUpdateSupplier() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationKey: ['suppliers', 'update'],
        mutationFn: async ({ id, data: body }: { id: number; data: Partial<EntityFormData> }) => {
            const { data, error } = await api.api.suppliers({ id }).put(body);
            if (error) throwApiError(error);
            return data!;
        },
        onMutate: async ({ id, data: updates }) => {
            await queryClient.cancelQueries({ queryKey: supplierKeys.detail(id) });
            const previousSupplier = queryClient.getQueryData(supplierKeys.detail(id));

            if (previousSupplier) {
                queryClient.setQueryData(supplierKeys.detail(id), (old: unknown) => {
                    if (!old || typeof old !== 'object') return old;
                    return { ...old as object, ...updates };
                });
            }

            return { previousSupplier };
        },
        onError: (_err, { id }, context) => {
            if (context?.previousSupplier) {
                queryClient.setQueryData(supplierKeys.detail(id), context.previousSupplier);
            }
        },
        onSettled: (_data, _err, { id }) => {
            queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
            queryClient.invalidateQueries({ queryKey: supplierKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: [...supplierKeys.all, 'facets'], exact: false });
        },
    }));
}

// =============================================================================
// Deactivate (soft delete)
// =============================================================================

export function useDeleteSupplier() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (id: number) => {
            await suppliersApi.deactivate(id);
            return id;
        },
        onMutate: async (id: number) => {
            await queryClient.cancelQueries({ queryKey: supplierKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: supplierKeys.lists() });
            applyIsActiveToCache(queryClient, [id], false);
            return { previousLists };
        },
        onError: (_err: unknown, _id: number, context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
        },
        onSettled: supplierOnSettled(queryClient),
    }));
}

// =============================================================================
// Bulk Deactivate
// =============================================================================

export function useBulkDeleteSupplier() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (ids: number[]) => {
            return await suppliersApi.bulkDelete(ids);
        },
        onMutate: async (ids: number[]) => {
            await queryClient.cancelQueries({ queryKey: supplierKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: supplierKeys.lists() });
            applyIsActiveToCache(queryClient, ids, false);
            return { previousLists };
        },
        onError: (_err: unknown, _ids: number[], context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
        },
        onSettled: supplierOnSettled(queryClient),
    }));
}

// =============================================================================
// Bulk Restore
// =============================================================================

export function useBulkRestoreSupplier() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (ids: number[]) => {
            return await suppliersApi.bulkRestore(ids);
        },
        onMutate: async (ids: number[]) => {
            await queryClient.cancelQueries({ queryKey: supplierKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: supplierKeys.lists() });
            applyIsActiveToCache(queryClient, ids, true);
            return { previousLists };
        },
        onError: (_err: unknown, _ids: number[], context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
        },
        onSettled: supplierOnSettled(queryClient),
    }));
}

// =============================================================================
// Restore (single)
// =============================================================================

export function useRestoreSupplier() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (id: number) => {
            await suppliersApi.restore(id);
            return id;
        },
        onMutate: async (id: number) => {
            await queryClient.cancelQueries({ queryKey: supplierKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: supplierKeys.lists() });
            applyIsActiveToCache(queryClient, [id], true);
            return { previousLists };
        },
        onError: (_err: unknown, _id: number, context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
        },
        onSettled: supplierOnSettled(queryClient),
    }));
}

// =============================================================================
// Hard Delete (permanent)
// =============================================================================

export function useHardDeleteSupplier() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (id: number) => {
            await suppliersApi.hardDelete(id);
            return id;
        },
        onMutate: async (id: number) => {
            await queryClient.cancelQueries({ queryKey: supplierKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: supplierKeys.lists() });

            queryClient.setQueriesData<CacheShape<SupplierListItem>>({ queryKey: supplierKeys.lists() }, (old) => {
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
        onSettled: supplierOnSettled(queryClient),
    }));
}
