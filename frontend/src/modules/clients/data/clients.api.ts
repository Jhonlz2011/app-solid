import { createQuery, createInfiniteQuery, createMutation, useQueryClient, keepPreviousData } from '@tanstack/solid-query';
import { createEffect } from 'solid-js';
import { api } from '@shared/lib/eden';
import type { EntityFormData } from '@app/schema/frontend';
import { addOptimisticItem, removeCacheItems, updateCacheItem, type CacheShape } from '@shared/utils/query.utils';
import { throwApiError } from '@shared/utils/api-errors';

// =============================================================================
// Typed API Wrappers (isolate Eden dynamic route type quirks)
// =============================================================================

export const clientsApi = {
    list: async (params: ClientFilters) => {
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
        if (error) throw new Error(String(error.value));
        return data!;
    },
    get: async (id: number) => {
        const { data, error } = await api.api.clients({ id }).get();
        if (error) throw new Error(String(error.value));
        return data!;
    },
    deactivate: async (id: number) => {
        const { error } = await (api.api.clients as any)({ id }).deactivate.patch();
        if (error) throw new Error(String(error.value));
    },
    restore: async (id: number) => {
        const { error } = await (api.api.clients as any)({ id }).restore.patch();
        if (error) throw new Error(String(error.value));
    },
    hardDelete: async (id: number) => {
        const { error } = await (api.api.clients as any)({ id }).delete();
        if (error) throw new Error(String(error.value));
    },
    bulkRestore: async (ids: number[]) => {
        const { data, error } = await (api.api.clients.bulk.restore as any).patch({ ids });
        if (error) throw new Error(String(error.value));
        return data!;
    },
    canDelete: async (id: number): Promise<ClientReferences> => {
        const { data, error } = await (api.api.clients as any)({ id })['can-delete'].get();
        if (error) throw new Error(String(error.value));
        return data as ClientReferences;
    },
};

// =============================================================================
// Type Utilities - Extract types from Eden
// =============================================================================

type ClientsListResponse = Awaited<ReturnType<typeof api.api.clients.get>>['data'];
export type ClientListItem = NonNullable<ClientsListResponse>['data'][number];
export type ClientBody = EntityFormData;

// Cursor-based pagination filters
export interface ClientFilters {
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

export const clientKeys = {
    all: ['clients'] as const,
    lists: () => [...clientKeys.all, 'list'] as const,
    list: (filters: ClientFilters) => [...clientKeys.lists(), filters] as const,
    details: () => [...clientKeys.all, 'detail'] as const,
    detail: (id: number) => [...clientKeys.details(), id] as const,
    facets: (search?: string, filters?: Record<string, string[] | undefined>) =>
        [...clientKeys.all, 'facets', { search, ...filters }] as const,
};

// =============================================================================
// Query Hooks with Cursor Pagination
// =============================================================================

/**
 * Hook for listing clients with cursor pagination
 * Features:
 * - Auto-prefetch next AND previous pages
 * - keepPreviousData for flash-free transitions
 * - Extended staleTime and gcTime for better caching
 */
export function useClients(filters: () => ClientFilters) {
    const queryClient = useQueryClient();
    const query = createQuery(() => ({
        queryKey: clientKeys.list(filters()),
        queryFn: () => clientsApi.list(filters()),
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
                queryKey: clientKeys.list({ ...currentFilters, cursor: data.meta.nextCursor, direction: 'next' }),
                queryFn: () => clientsApi.list({ ...currentFilters, cursor: data.meta.nextCursor!, direction: 'next' }),
                staleTime: 1000 * 60 * 2,
            });
        }

        if (data.meta.prevCursor && data.meta.hasPrevPage) {
            queryClient.prefetchQuery({
                queryKey: clientKeys.list({ ...currentFilters, cursor: data.meta.prevCursor, direction: 'prev' }),
                queryFn: () => clientsApi.list({ ...currentFilters, cursor: data.meta.prevCursor!, direction: 'prev' }),
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
export function useInfiniteClients(filters: () => Omit<ClientFilters, 'cursor' | 'direction'>) {
    return createInfiniteQuery(() => ({
        queryKey: [...clientKeys.lists(), 'infinite', filters()] as const,
        queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
            return clientsApi.list({
                ...filters(),
                cursor: pageParam,
                direction: pageParam ? 'next' : 'first',
                limit: 20,
            });
        },
        getNextPageParam: (lastPage: Awaited<ReturnType<typeof clientsApi.list>>) =>
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
 * Hook for getting filter facets (distinct values + counts) for client columns.
 * Supports cross-filtering via column filter params.
 * Uses Eden treaty for type-safe API calls.
 */
export function useClientFacets(
    search: () => string | undefined,
    columnFilters?: () => {
        personType?: string[];
        taxIdType?: string[];
        isActive?: string[];
        businessName?: string[];
    }
) {
    return createQuery(() => ({
        queryKey: clientKeys.facets(search(), columnFilters?.()),
        queryFn: async (): Promise<FacetData> => {
            const cf = columnFilters?.();
            const { data, error } = await api.api.clients.facets.get({
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

export function useClient(id: () => number) {
    return createQuery(() => ({
        queryKey: clientKeys.detail(id()),
        queryFn: async () => {
            const { data, error } = await api.api.clients({ id: id() }).get();
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
 * Create client with optimistic update
 * Immediately adds placeholder to cache for instant feedback
 */
export function useCreateClient() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (body: ClientBody) => {
            const { data, error } = await api.api.clients.post(body);
            if (error) throwApiError(error);
            return data!;
        },
        onMutate: async (newClient) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: clientKeys.lists() });

            // Snapshot previous state for rollback
            const previousLists = queryClient.getQueriesData({ queryKey: clientKeys.lists() });

            // Optimistically add to all list caches
            queryClient.setQueriesData<CacheShape<ClientListItem>>({ queryKey: clientKeys.lists() }, (old) => {
                if (!old) return old;
                const optimisticClient = {
                    id: -Date.now(), // Negative temp ID
                    business_name: newClient.businessName,
                    trade_name: newClient.tradeName,
                    tax_id: newClient.taxId,
                    is_active: true,
                    _optimistic: true, // Mark as optimistic
                } as unknown as ClientListItem;

                return addOptimisticItem(old, optimisticClient);
            });

            return { previousLists };
        },
        onError: (_err, _newClient, context) => {
            // Rollback on error
            context?.previousLists?.forEach(([key, data]) => {
                queryClient.setQueryData(key, data);
            });
        },
        onSettled: () => {
            // Refetch list to get accurate server data
            queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
            // Also refresh filter options/counts (clientId guard in WS silences own events)
            queryClient.invalidateQueries({ queryKey: [...clientKeys.all, 'facets'], exact: false });
        },
    }));
}

export function useUpdateClient() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async ({ id, data: body }: { id: number; data: Partial<ClientBody> }) => {
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
            // Also refresh filter options/counts
            queryClient.invalidateQueries({ queryKey: [...clientKeys.all, 'facets'], exact: false });
        },
    }));
}

// =============================================================================
// Shared Mutation Invalidation
// =============================================================================

/** Shared onSettled for all client mutations — invalidates list + facet caches */
function clientOnSettled(queryClient: ReturnType<typeof useQueryClient>) {
    return () => {
        queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
        queryClient.invalidateQueries({ queryKey: [...clientKeys.all, 'facets'], exact: false });
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
    queryClient.setQueriesData<CacheShape<ClientListItem>>({ queryKey: clientKeys.lists() }, (old) => {
        if (!old) return old;
        return ids.reduce<CacheShape<ClientListItem>>(
            (acc, id) => updateCacheItem(acc, { id, is_active: isActive } as unknown as ClientListItem) ?? acc,
            old
        );
    });
}

export function useDeleteClient() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (id: number) => {
            await clientsApi.deactivate(id);
            return id;
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: clientKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: clientKeys.lists() });
            applyIsActiveToCache(queryClient, [id], false);
            return { previousLists };
        },
        onError: (_err, _id, context) => {
            context?.previousLists?.forEach(([key, data]) => queryClient.setQueryData(key, data));
        },
        onSettled: clientOnSettled(queryClient),
    }));
}

export function useBulkDeleteClient() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (ids: number[]) => {
            const { data, error } = await api.api.clients.bulk.delete({ ids });
            if (error) throw new Error(String(error.value));
            return data!;
        },
        onMutate: async (ids) => {
            await queryClient.cancelQueries({ queryKey: clientKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: clientKeys.lists() });
            applyIsActiveToCache(queryClient, ids, false);
            return { previousLists };
        },
        onError: (_err, _ids, context) => {
            context?.previousLists?.forEach(([key, data]) => queryClient.setQueryData(key, data));
        },
        onSettled: clientOnSettled(queryClient),
    }));
}

export function useBulkRestoreClient() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (ids: number[]) => {
            return await clientsApi.bulkRestore(ids);
        },
        onMutate: async (ids) => {
            await queryClient.cancelQueries({ queryKey: clientKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: clientKeys.lists() });
            applyIsActiveToCache(queryClient, ids, true);
            return { previousLists };
        },
        onError: (_err, _ids, context) => {
            context?.previousLists?.forEach(([key, data]) => queryClient.setQueryData(key, data));
        },
        onSettled: clientOnSettled(queryClient),
    }));
}

// =============================================================================
// Restore Hook
// =============================================================================

export function useRestoreClient() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (id: number) => {
            await clientsApi.restore(id);
            return id;
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: clientKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: clientKeys.lists() });
            applyIsActiveToCache(queryClient, [id], true);
            return { previousLists };
        },
        onError: (_err, _id, context) => {
            context?.previousLists?.forEach(([key, data]) => queryClient.setQueryData(key, data));
        },
        onSettled: clientOnSettled(queryClient),
    }));
}

// =============================================================================
// Hard Delete Hook
// =============================================================================

export function useHardDeleteClient() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (id: number) => {
            await clientsApi.hardDelete(id);
            return id;
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: clientKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: clientKeys.lists() });

            queryClient.setQueriesData<CacheShape<ClientListItem>>({ queryKey: clientKeys.lists() }, (old) => {
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
            queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
            queryClient.invalidateQueries({ queryKey: [...clientKeys.all, 'facets'], exact: false });
        },
    }));
}

// =============================================================================
// Reference Check (pre-flight for hard delete warning)
// =============================================================================

export interface ClientReferences {
    clientProducts: number;
    invoices: number;
    workOrders: number;
    total: number;
    canDelete: boolean;
}

/**
 * Lazy query: only fetches when `enabled` is true.
 * Trigger it by passing `enabled: () => true` when the user switches to hard-delete mode.
 */
export function useCheckClientReferences(id: () => number | null, enabled: () => boolean) {
    return createQuery(() => ({
        queryKey: [...clientKeys.all, 'can-delete', id()],
        queryFn: async (): Promise<ClientReferences> => {
            return await clientsApi.canDelete(id()!);
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

// export const clientsApi = {
//     list: async (filters: ClientFilters) => {
//         const { data, error } = await api.api.clients.get({
//             query: {
//                 cursor: filters.cursor,
//                 direction: filters.direction,
//                 limit: filters.limit,
//                 search: filters.search,
//                 sortBy: filters.sortBy,
//                 sortOrder: filters.sortOrder,
//                 page: filters.page,
//                 personType: filters.personType?.join(','),
//                 taxIdType: filters.taxIdType?.join(','),
//                 isActive: filters.isActive?.join(','),
//                 businessName: filters.businessName?.join(','),
//             }
//         });
//         if (error) throw new Error(String(error.value));
//         return data!;
//     },
//     get: async (id: number) => {
//         const { data, error } = await api.api.clients({ id }).get();
//         if (error) throw new Error(String(error.value));
//         return data!;
//     },
// };

// =============================================================================
// SRI Integration Hooks
// =============================================================================

export type SriClientResponse = {
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
        queryFn: async (): Promise<SriClientResponse[]> => {
            const query = querySignal();
            if (query.length !== 13) return [];
            
            const { data, error } = await api.api.sri['by-ruc'].get({
                query: { q: query }
            });
            
            if (error) throw new Error(String(error.value));
            return data as SriClientResponse[];
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
        queryFn: async (): Promise<SriClientResponse[]> => {
            const query = querySignal();
            if (query.length < 3) return [];
            
            const { data, error } = await api.api.sri['by-name'].get({
                query: { q: query }
            });
            
            if (error) throw new Error(String(error.value));
            return data as SriClientResponse[];
        },
        enabled: querySignal().length >= 3,
        staleTime: 1000 * 60 * 60 * 24, // 24 hours
        gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days in cache
        retry: 1,
        placeholderData: keepPreviousData,
    }));
}

