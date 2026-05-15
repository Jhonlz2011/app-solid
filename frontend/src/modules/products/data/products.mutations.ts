/**
 * products.mutations.ts — TanStack Mutation Hooks for Products module
 *
 * All `createMutation` hooks with optimistic updates live here.
 */
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { ProductFormData } from '@app/schema/frontend';
import { addOptimisticItem, removeCacheItems, updateCacheItem, type CacheShape } from '@shared/utils/query.utils';
import { productsApi, productKeys, type ProductListItem } from './products.api';

// =============================================================================
// Shared Mutation Helpers (DRY within module)
// =============================================================================

/** Shared onSettled for all product mutations — invalidates list + facet caches */
function productOnSettled(queryClient: ReturnType<typeof useQueryClient>) {
    return () => {
        queryClient.invalidateQueries({ queryKey: productKeys.lists() });
        queryClient.invalidateQueries({ queryKey: [...productKeys.all, 'facets'], exact: false });
    };
}

/** Applies `is_active` patch for multiple IDs via sequential updateCacheItem calls. */
function applyIsActiveToCache(
    queryClient: ReturnType<typeof useQueryClient>,
    ids: number[],
    isActive: boolean
) {
    queryClient.setQueriesData<CacheShape<ProductListItem>>({ queryKey: productKeys.lists() }, (old) => {
        if (!old) return old;
        return ids.reduce<CacheShape<ProductListItem>>(
            (acc, id) => updateCacheItem(acc, { id, is_active: isActive } as unknown as ProductListItem) ?? acc,
            old
        );
    });
}

// =============================================================================
// Create
// =============================================================================

export function useCreateProduct() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (body: ProductFormData) => {
            const { data, error } = await api.api.products.post(body as any);
            if (error) throwApiError(error);
            return data!;
        },
        onMutate: async (newProduct: ProductFormData) => {
            await queryClient.cancelQueries({ queryKey: productKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: productKeys.lists() });

            queryClient.setQueriesData<CacheShape<ProductListItem>>({ queryKey: productKeys.lists() }, (old) => {
                if (!old) return old;
                const optimistic = {
                    id: -Date.now(),
                    name: newProduct.name,
                    slug: newProduct.slug,
                    product_type: newProduct.product_type,
                    default_base_price: String(newProduct.default_base_price),
                    is_active: true,
                    _optimistic: true,
                } as unknown as ProductListItem;
                return addOptimisticItem(old, optimistic);
            });

            return { previousLists };
        },
        onError: (_err: unknown, _body: ProductFormData, context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => {
                queryClient.setQueryData(key as any, data);
            });
        },
        onSettled: productOnSettled(queryClient),
    }));
}

// =============================================================================
// Update
// =============================================================================

export function useUpdateProduct() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async ({ id, data: body }: { id: number; data: Partial<ProductFormData> }) => {
            const { data, error } = await api.api.products({ id }).put(body as any);
            if (error) throwApiError(error);
            return data!;
        },
        onMutate: async (vars: { id: number; data: Partial<ProductFormData> }) => {
            const { id, data: updates } = vars;
            await queryClient.cancelQueries({ queryKey: productKeys.detail(id) });
            const previousProduct = queryClient.getQueryData(productKeys.detail(id));
            if (previousProduct) {
                queryClient.setQueryData(productKeys.detail(id), (old: unknown) => {
                    if (!old || typeof old !== 'object') return old;
                    return { ...old as object, ...updates };
                });
            }
            return { previousProduct };
        },
        onError: (_err: unknown, vars: { id: number; data: Partial<ProductFormData> }, context: any) => {
            if (context?.previousProduct) {
                queryClient.setQueryData(productKeys.detail(vars.id), context.previousProduct);
            }
        },
        onSettled: (_data: unknown, _err: unknown, vars: { id: number; data: Partial<ProductFormData> }) => {
            queryClient.invalidateQueries({ queryKey: productKeys.lists() });
            queryClient.invalidateQueries({ queryKey: productKeys.detail(vars.id) });
            queryClient.invalidateQueries({ queryKey: [...productKeys.all, 'facets'], exact: false });
        },
    }));
}

// =============================================================================
// Deactivate (soft delete)
// =============================================================================

export function useDeleteProduct() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (id: number) => {
            await productsApi.deactivate(id);
            return id;
        },
        onMutate: async (id: number) => {
            await queryClient.cancelQueries({ queryKey: productKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: productKeys.lists() });
            applyIsActiveToCache(queryClient, [id], false);
            return { previousLists };
        },
        onError: (_err: unknown, _id: number, context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
        },
        onSettled: productOnSettled(queryClient),
    }));
}

// =============================================================================
// Bulk Deactivate
// =============================================================================

export function useBulkDeleteProduct() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (ids: number[]) => {
            return await productsApi.bulkDelete(ids);
        },
        onMutate: async (ids: number[]) => {
            await queryClient.cancelQueries({ queryKey: productKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: productKeys.lists() });
            applyIsActiveToCache(queryClient, ids, false);
            return { previousLists };
        },
        onError: (_err: unknown, _ids: number[], context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
        },
        onSettled: productOnSettled(queryClient),
    }));
}

// =============================================================================
// Bulk Restore
// =============================================================================

export function useBulkRestoreProduct() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (ids: number[]) => {
            return await productsApi.bulkRestore(ids);
        },
        onMutate: async (ids: number[]) => {
            await queryClient.cancelQueries({ queryKey: productKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: productKeys.lists() });
            applyIsActiveToCache(queryClient, ids, true);
            return { previousLists };
        },
        onError: (_err: unknown, _ids: number[], context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
        },
        onSettled: productOnSettled(queryClient),
    }));
}

// =============================================================================
// Restore (single)
// =============================================================================

export function useRestoreProduct() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (id: number) => {
            await productsApi.restore(id);
            return id;
        },
        onMutate: async (id: number) => {
            await queryClient.cancelQueries({ queryKey: productKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: productKeys.lists() });
            applyIsActiveToCache(queryClient, [id], true);
            return { previousLists };
        },
        onError: (_err: unknown, _id: number, context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
        },
        onSettled: productOnSettled(queryClient),
    }));
}

// =============================================================================
// Hard Delete (permanent)
// =============================================================================

export function useHardDeleteProduct() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (id: number) => {
            await productsApi.hardDelete(id);
            return id;
        },
        onMutate: async (id: number) => {
            await queryClient.cancelQueries({ queryKey: productKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: productKeys.lists() });

            queryClient.setQueriesData<CacheShape<ProductListItem>>({ queryKey: productKeys.lists() }, (old) => {
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
        onSettled: productOnSettled(queryClient),
    }));
}
