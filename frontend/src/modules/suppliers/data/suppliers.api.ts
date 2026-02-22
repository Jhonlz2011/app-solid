import { createQuery, createMutation, useQueryClient, keepPreviousData } from '@tanstack/solid-query';
import { createEffect } from 'solid-js';
import { api } from '@shared/lib/eden';
import type { SupplierFormData } from '@app/schema/frontend';

// =============================================================================
// Type Utilities - Extract types from Eden
// =============================================================================

type SuppliersListResponse = Awaited<ReturnType<typeof api.api.suppliers.get>>['data'];
export type SupplierListItem = NonNullable<SuppliersListResponse>['data'][number];
export type SupplierBody = SupplierFormData;

// Cursor-based pagination filters
export interface SupplierFilters {
    cursor?: string;
    direction?: 'first' | 'next' | 'prev' | 'last';
    limit?: number;
    search?: string;
    // Server-side sorting
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    // Page number for offset mode (1-indexed)
    page?: number;
    // Column filters
    personType?: string[];
    taxIdType?: string[];
    isActive?: string[];
    businessName?: string[];
}

// Response meta from cursor pagination
export interface CursorMeta {
    nextCursor: string | null;
    prevCursor: string | null;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    total: number;
    // Offset mode fields
    page: number | null;
    pageCount: number | null;
}

// =============================================================================
// Query Keys - Centralized for consistency
// =============================================================================

export const supplierKeys = {
    all: ['suppliers'] as const,
    lists: () => [...supplierKeys.all, 'list'] as const,
    list: (filters: SupplierFilters) => [...supplierKeys.lists(), filters] as const,
    details: () => [...supplierKeys.all, 'detail'] as const,
    detail: (id: number) => [...supplierKeys.details(), id] as const,
    facets: (search?: string, filters?: Record<string, string[] | undefined>) =>
        [...supplierKeys.all, 'facets', { search, ...filters }] as const,
};

// =============================================================================
// Query Hooks with Cursor Pagination
// =============================================================================

/**
 * Hook for listing suppliers with cursor pagination
 * Features:
 * - Auto-prefetch next AND previous pages
 * - keepPreviousData for flash-free transitions
 * - Extended staleTime and gcTime for better caching
 */
export function useSuppliers(filters: () => SupplierFilters) {
    const queryClient = useQueryClient();

    const query = createQuery(() => ({
        queryKey: supplierKeys.list(filters()),
        queryFn: async () => {
            const f = filters();
            const { data, error } = await api.api.suppliers.get({
                query: {
                    cursor: f.cursor,
                    direction: f.direction,
                    limit: f.limit,
                    search: f.search,
                    sortBy: f.sortBy,
                    sortOrder: f.sortOrder,
                    page: f.page,
                    personType: f.personType?.join(','),
                    taxIdType: f.taxIdType?.join(','),
                    isActive: f.isActive?.join(','),
                    businessName: f.businessName?.join(','),
                }
            });
            if (error) throw new Error(String(error.value));
            return data!;
        },
        staleTime: 1000 * 60 * 2,       // 2 minutes — aligned with backend 120s TTL
        gcTime: 1000 * 60 * 30,          // 30 minutes — keep in cache
        placeholderData: keepPreviousData,
    }));

    // Auto-prefetch NEXT page when current data arrives
    createEffect(() => {
        const data = query.data;
        const currentFilters = filters();

        if (data?.meta.nextCursor && data.meta.hasNextPage) {
            queryClient.prefetchQuery({
                queryKey: supplierKeys.list({
                    ...currentFilters,
                    cursor: data.meta.nextCursor,
                    direction: 'next'
                }),
                queryFn: () => suppliersApi.list({
                    ...currentFilters,
                    cursor: data.meta.nextCursor!,
                    direction: 'next'
                }),
                staleTime: 1000 * 60 * 2,
            });
        }
    });

    // Auto-prefetch PREVIOUS page when current data arrives
    createEffect(() => {
        const data = query.data;
        const currentFilters = filters();

        if (data?.meta.prevCursor && data.meta.hasPrevPage) {
            queryClient.prefetchQuery({
                queryKey: supplierKeys.list({
                    ...currentFilters,
                    cursor: data.meta.prevCursor,
                    direction: 'prev'
                }),
                queryFn: () => suppliersApi.list({
                    ...currentFilters,
                    cursor: data.meta.prevCursor!,
                    direction: 'prev'
                }),
                staleTime: 1000 * 60 * 2,
            });
        }
    });

    return query;
}

// =============================================================================
// Faceted Filter Options
// =============================================================================

/** Facet response type from API */
export type FacetData = Record<string, { value: string; count: number }[]>;

/**
 * Hook for getting filter facets (distinct values + counts) for supplier columns.
 * Supports cross-filtering via column filter params.
 * Uses Eden treaty for type-safe API calls.
 */
export function useSupplierFacets(
    search: () => string | undefined,
    columnFilters?: () => {
        personType?: string[];
        taxIdType?: string[];
        isActive?: string[];
        businessName?: string[];
    }
) {
    return createQuery(() => ({
        queryKey: supplierKeys.facets(search(), columnFilters?.()),
        queryFn: async (): Promise<FacetData> => {
            const cf = columnFilters?.();
            const { data, error } = await api.api.suppliers.facets.get({
                query: {
                    search: search(),
                    personType: cf?.personType?.length ? cf.personType.join(',') : undefined,
                    taxIdType: cf?.taxIdType?.length ? cf.taxIdType.join(',') : undefined,
                    isActive: cf?.isActive?.length ? cf.isActive.join(',') : undefined,
                    businessName: cf?.businessName?.length ? cf.businessName.join(',') : undefined,
                },
            });
            if (error) throw new Error(String(error.value));
            return data as unknown as FacetData;
        },
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        retry: 2,
    }));
}

export function useSupplier(id: () => number) {
    return createQuery(() => ({
        queryKey: supplierKeys.detail(id()),
        queryFn: async () => {
            const { data, error } = await api.api.suppliers({ id: id() }).get();
            if (error) throw new Error(String(error.value));
            return data!;
        },
        enabled: !!id(),
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
    }));
}

// =============================================================================
// Mutation Hooks with Optimistic Updates
// =============================================================================

/**
 * Create supplier with optimistic update
 * Immediately adds placeholder to cache for instant feedback
 */
export function useCreateSupplier() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (body: SupplierBody) => {
            const { data, error } = await api.api.suppliers.post(body);
            if (error) throw new Error(String(error.value));
            return data!;
        },
        onMutate: async (newSupplier) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: supplierKeys.lists() });

            // Snapshot previous state for rollback
            const previousLists = queryClient.getQueriesData({ queryKey: supplierKeys.lists() });

            // Optimistically add to all list caches
            queryClient.setQueriesData({ queryKey: supplierKeys.lists() }, (old: any) => {
                if (!old) return old;

                // Create optimistic supplier with temp ID
                const optimisticSupplier = {
                    id: -Date.now(), // Negative temp ID
                    business_name: newSupplier.businessName,
                    trade_name: newSupplier.tradeName,
                    tax_id: newSupplier.taxId,
                    is_active: true,
                    _optimistic: true, // Mark as optimistic
                };

                return {
                    ...old,
                    data: [optimisticSupplier, ...old.data],
                    meta: { ...old.meta, total: old.meta.total + 1 }
                };
            });

            return { previousLists };
        },
        onError: (_err, _newSupplier, context) => {
            // Rollback on error
            context?.previousLists?.forEach(([key, data]) => {
                queryClient.setQueryData(key, data);
            });
        },
        onSettled: () => {
            // Refetch to get accurate server data
            queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
        },
    }));
}

export function useUpdateSupplier() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async ({ id, data: body }: { id: number; data: Partial<SupplierBody> }) => {
            const { data, error } = await api.api.suppliers({ id }).put(body);
            if (error) throw new Error(String(error.value));
            return data!;
        },
        onMutate: async ({ id, data: updates }) => {
            await queryClient.cancelQueries({ queryKey: supplierKeys.detail(id) });
            const previousSupplier = queryClient.getQueryData(supplierKeys.detail(id));

            if (previousSupplier) {
                queryClient.setQueryData(supplierKeys.detail(id), (old: any) => ({
                    ...old,
                    ...updates,
                }));
            }

            return { previousSupplier };
        },
        onError: (_err, { id }, context) => {
            if (context?.previousSupplier) {
                queryClient.setQueryData(supplierKeys.detail(id), context.previousSupplier);
            }
        },
        onSettled: (data) => {
            queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
            if (data?.id) queryClient.invalidateQueries({ queryKey: supplierKeys.detail(data.id) });
        },
    }));
}

export function useDeleteSupplier() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (id: number) => {
            const { error } = await api.api.suppliers({ id }).delete();
            if (error) throw new Error(String(error.value));
            return id;
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: supplierKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: supplierKeys.lists() });

            queryClient.setQueriesData({ queryKey: supplierKeys.lists() }, (old: any) => {
                if (!old) return old;
                return {
                    ...old,
                    data: old.data.filter((s: SupplierListItem) => s.id !== id),
                    meta: { ...old.meta, total: Math.max(0, old.meta.total - 1) }
                };
            });

            return { previousLists };
        },
        onError: (_err, _id, context) => {
            context?.previousLists?.forEach(([key, data]) => {
                queryClient.setQueryData(key, data);
            });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
        },
    }));
}

export function useBulkDeleteSupplier() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (ids: number[]) => {
            const { data, error } = await api.api.suppliers.bulk.delete({ ids });
            if (error) throw new Error(String(error.value));
            return data!;
        },
        onMutate: async (ids) => {
            await queryClient.cancelQueries({ queryKey: supplierKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: supplierKeys.lists() });
            const idSet = new Set(ids);

            queryClient.setQueriesData({ queryKey: supplierKeys.lists() }, (old: any) => {
                if (!old) return old;
                return {
                    ...old,
                    data: old.data.filter((s: SupplierListItem) => !idSet.has(s.id)),
                    meta: { ...old.meta, total: Math.max(0, old.meta.total - ids.length) }
                };
            });

            return { previousLists };
        },
        onError: (_err, _ids, context) => {
            context?.previousLists?.forEach(([key, data]) => {
                queryClient.setQueryData(key, data);
            });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
        },
    }));
}

// =============================================================================
// Direct API (for prefetching and non-hook usage)
// =============================================================================

export const suppliersApi = {
    list: async (filters: SupplierFilters) => {
        const { data, error } = await api.api.suppliers.get({
            query: {
                cursor: filters.cursor,
                direction: filters.direction,
                limit: filters.limit,
                search: filters.search,
                sortBy: filters.sortBy,
                sortOrder: filters.sortOrder,
                page: filters.page,
                personType: filters.personType?.join(','),
                taxIdType: filters.taxIdType?.join(','),
                isActive: filters.isActive?.join(','),
                businessName: filters.businessName?.join(','),
            }
        });
        if (error) throw new Error(String(error.value));
        return data!;
    },
    get: async (id: number) => {
        const { data, error } = await api.api.suppliers({ id }).get();
        if (error) throw new Error(String(error.value));
        return data!;
    },
};
