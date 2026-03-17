import { createQuery, createInfiniteQuery, createMutation, useQueryClient, keepPreviousData } from '@tanstack/solid-query';
import { createEffect } from 'solid-js';
import { api } from '@shared/lib/eden';
import type { SupplierFormData } from '@app/schema/frontend';
import { addOptimisticItem, removeCacheItems, updateCacheItem, type CacheShape } from '@shared/utils/query.utils';
import { throwApiError } from '@shared/utils/api-errors';

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
        queryFn: () => suppliersApi.list(filters()),
        staleTime: 1000 * 60 * 2,       // 2 minutes — aligned with backend 120s TTL
        gcTime: 1000 * 60 * 30,          // 30 minutes — keep in cache
        placeholderData: keepPreviousData,
    }));

    // Auto-prefetch NEXT and PREVIOUS pages in a single reactive effect
    createEffect(() => {
        const data = query.data;
        const currentFilters = filters();
        if (!data) return;

        if (data.meta.nextCursor && data.meta.hasNextPage) {
            queryClient.prefetchQuery({
                queryKey: supplierKeys.list({ ...currentFilters, cursor: data.meta.nextCursor, direction: 'next' }),
                queryFn: () => suppliersApi.list({ ...currentFilters, cursor: data.meta.nextCursor!, direction: 'next' }),
                staleTime: 1000 * 60 * 2,
            });
        }

        if (data.meta.prevCursor && data.meta.hasPrevPage) {
            queryClient.prefetchQuery({
                queryKey: supplierKeys.list({ ...currentFilters, cursor: data.meta.prevCursor, direction: 'prev' }),
                queryFn: () => suppliersApi.list({ ...currentFilters, cursor: data.meta.prevCursor!, direction: 'prev' }),
                staleTime: 1000 * 60 * 2,
            });
        }
    });

    return query;
}

/**
 * Hook for infinite scroll — mobile card view.
 * Accumulates pages in memory as the user scrolls down.
 * Compatible with @tanstack/solid-virtual (createVirtualizer).
 */
export function useInfiniteSuppliers(filters: () => Omit<SupplierFilters, 'cursor' | 'direction'>) {
    return createInfiniteQuery(() => ({
        queryKey: [...supplierKeys.lists(), 'infinite', filters()] as const,
        queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
            return suppliersApi.list({
                ...filters(),
                cursor: pageParam,
                direction: pageParam ? 'next' : 'first',
                limit: 20,
            });
        },
        getNextPageParam: (lastPage: Awaited<ReturnType<typeof suppliersApi.list>>) =>
            lastPage.meta.hasNextPage ? lastPage.meta.nextCursor ?? undefined : undefined,
        initialPageParam: undefined as string | undefined,
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 30,
    }));
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
        // Keep previous filter options visible while new ones load
        // Prevents filter popover from blanking out on each selection
        placeholderData: keepPreviousData,
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
            if (error) throwApiError(error);
            return data!;
        },
        onMutate: async (newSupplier) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: supplierKeys.lists() });

            // Snapshot previous state for rollback
            const previousLists = queryClient.getQueriesData({ queryKey: supplierKeys.lists() });

            // Optimistically add to all list caches
            queryClient.setQueriesData<CacheShape<SupplierListItem>>({ queryKey: supplierKeys.lists() }, (old) => {
                if (!old) return old;
                const optimisticSupplier = {
                    id: -Date.now(), // Negative temp ID
                    business_name: newSupplier.businessName,
                    trade_name: newSupplier.tradeName,
                    tax_id: newSupplier.taxId,
                    is_active: true,
                    _optimistic: true, // Mark as optimistic
                } as unknown as SupplierListItem;

                return addOptimisticItem(old, optimisticSupplier);
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
            // Refetch list to get accurate server data
            queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
            // Also refresh filter options/counts (clientId guard in WS silences own events)
            queryClient.invalidateQueries({ queryKey: [...supplierKeys.all, 'facets'], exact: false });
        },
    }));
}

export function useUpdateSupplier() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async ({ id, data: body }: { id: number; data: Partial<SupplierBody> }) => {
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
        onSettled: (data) => {
            queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
            if (data?.id) queryClient.invalidateQueries({ queryKey: supplierKeys.detail(data.id) });
            // Also refresh filter options/counts
            queryClient.invalidateQueries({ queryKey: [...supplierKeys.all, 'facets'], exact: false });
        },
    }));
}

// =============================================================================
// Shared Mutation Invalidation
// =============================================================================

/** Shared onSettled for all supplier mutations — invalidates list + facet caches */
function supplierOnSettled(queryClient: ReturnType<typeof useQueryClient>) {
    return () => {
        queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
        queryClient.invalidateQueries({ queryKey: [...supplierKeys.all, 'facets'], exact: false });
    };
}

/**
 * Applies `is_active` patch for multiple IDs via sequential updateCacheItem calls.
 */
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

export function useDeleteSupplier() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (id: number) => {
            const { error } = await (api.api.suppliers as any)({ id }).deactivate.patch();
            if (error) throw new Error(String(error.value));
            return id;
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: supplierKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: supplierKeys.lists() });
            applyIsActiveToCache(queryClient, [id], false);
            return { previousLists };
        },
        onError: (_err, _id, context) => {
            context?.previousLists?.forEach(([key, data]) => queryClient.setQueryData(key, data));
        },
        onSettled: supplierOnSettled(queryClient),
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
            applyIsActiveToCache(queryClient, ids, false);
            return { previousLists };
        },
        onError: (_err, _ids, context) => {
            context?.previousLists?.forEach(([key, data]) => queryClient.setQueryData(key, data));
        },
        onSettled: supplierOnSettled(queryClient),
    }));
}

export function useBulkRestoreSupplier() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (ids: number[]) => {
            const { data, error } = await (api.api.suppliers.bulk.restore as any).patch({ ids });
            if (error) throw new Error(String(error.value));
            return data!;
        },
        onMutate: async (ids) => {
            await queryClient.cancelQueries({ queryKey: supplierKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: supplierKeys.lists() });
            applyIsActiveToCache(queryClient, ids, true);
            return { previousLists };
        },
        onError: (_err, _ids, context) => {
            context?.previousLists?.forEach(([key, data]) => queryClient.setQueryData(key, data));
        },
        onSettled: supplierOnSettled(queryClient),
    }));
}

// =============================================================================
// Restore Hook
// =============================================================================

export function useRestoreSupplier() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (id: number) => {
            const { error } = await (api.api.suppliers as any)({ id }).restore.patch();
            if (error) throw new Error(String(error.value));
            return id;
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: supplierKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: supplierKeys.lists() });
            applyIsActiveToCache(queryClient, [id], true);
            return { previousLists };
        },
        onError: (_err, _id, context) => {
            context?.previousLists?.forEach(([key, data]) => queryClient.setQueryData(key, data));
        },
        onSettled: supplierOnSettled(queryClient),
    }));
}

// =============================================================================
// Hard Delete Hook
// =============================================================================

export function useHardDeleteSupplier() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (id: number) => {
            const { error } = await (api.api.suppliers as any)({ id }).delete();
            if (error) throw new Error(String(error.value));
            return id;
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: supplierKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: supplierKeys.lists() });

            queryClient.setQueriesData<CacheShape<SupplierListItem>>({ queryKey: supplierKeys.lists() }, (old) => {
                if (!old) return old;
                return removeCacheItems(old, [id]);
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
            queryClient.invalidateQueries({ queryKey: [...supplierKeys.all, 'facets'], exact: false });
        },
    }));
}

// =============================================================================
// Reference Check (pre-flight for hard delete warning)
// =============================================================================

export interface SupplierReferences {
    supplierProducts: number;
    invoices: number;
    workOrders: number;
    total: number;
    canDelete: boolean;
}

/**
 * Lazy query: only fetches when `enabled` is true.
 * Trigger it by passing `enabled: () => true` when the user switches to hard-delete mode.
 */
export function useCheckSupplierReferences(id: () => number | null, enabled: () => boolean) {
    return createQuery(() => ({
        queryKey: [...supplierKeys.all, 'can-delete', id()],
        queryFn: async (): Promise<SupplierReferences> => {
            const { data, error } = await (api.api.suppliers as any)({ id: id() })['can-delete'].get();
            if (error) throw new Error(String(error.value));
            return data as SupplierReferences;
        },
        enabled: enabled() && id() !== null,
        staleTime: 10_000, // 10s — fresh enough for a dialog interaction
        gcTime: 30_000,
        retry: false,
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

// =============================================================================
// SRI Integration Hooks
// =============================================================================

export type SriSupplierResponse = {
    ruc: string;
    razonSocial: string;
    nombreComercial: string | null;
    city: string;
    isActive: boolean | null;
    isSociedad: boolean | null;
    isRimpe: boolean | null;
    
    obligadoContabilidad: boolean | null;
    agenteRetencion: boolean | null;
    contribuyenteEspecial: boolean | null;
};

/**
 * Hook to search the SRI database by RUC.
 */
export function useSriSearchByRuc(querySignal: () => string) {
    return createQuery(() => ({
        queryKey: ['sri', 'by-ruc', querySignal()],
        queryFn: async (): Promise<SriSupplierResponse[]> => {
            const query = querySignal();
            if (query.length !== 13) return [];
            
            const { data, error } = await api.api.sri['by-ruc'].get({
                query: { q: query }
            });
            
            if (error) throw new Error(String(error.value));
            return data as SriSupplierResponse[];
        },
        enabled: querySignal().length === 13,
        staleTime: 1000 * 60 * 60 * 24, // 24 hours
        gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days in cache
        retry: 1,
    }));
}

/**
 * Hook to search the SRI database by business name or trade name.
 */
export function useSriSearchByName(querySignal: () => string) {
    return createQuery(() => ({
        queryKey: ['sri', 'by-name', querySignal()],
        queryFn: async (): Promise<SriSupplierResponse[]> => {
            const query = querySignal();
            if (query.length < 3) return [];
            
            const { data, error } = await api.api.sri['by-name'].get({
                query: { q: query }
            });
            
            if (error) throw new Error(String(error.value));
            return data as SriSupplierResponse[];
        },
        enabled: querySignal().length >= 3,
        staleTime: 1000 * 60 * 60 * 24, // 24 hours
        gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days in cache
        retry: 1,
        placeholderData: keepPreviousData,
    }));
}

