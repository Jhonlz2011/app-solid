/**
 * clients.queries.ts — TanStack Query Hooks (read-only) for Clients module
 *
 * Only `createQuery` / `createInfiniteQuery` hooks live here.
 * All mutations are in `clients.mutations.ts`.
 */
import { createQuery, createInfiniteQuery, keepPreviousData, useQueryClient } from '@tanstack/solid-query';
import { createEffect } from 'solid-js';
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import { clientsApi } from './clients.api';
import { clientKeys } from './clients.keys';
import type { EntityFilters, FacetData, EntityReferences } from '@app/schema/shared-dto';

// =============================================================================
// List with Cursor Pagination + Auto-prefetch
// =============================================================================

export function useClients(filters: () => EntityFilters) {
    const queryClient = useQueryClient();
    const query = createQuery(() => ({
        queryKey: clientKeys.list(filters()),
        queryFn: () => clientsApi.list(filters()),
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 30,
        placeholderData: keepPreviousData,
    }));

    // Auto-prefetch NEXT and PREVIOUS pages
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

// =============================================================================
// Infinite Scroll (mobile card view)
// =============================================================================

export function useInfiniteClients(filters: () => Omit<EntityFilters, 'cursor' | 'direction'>) {
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
            if (error) throwApiError(error);
            return data as unknown as FacetData;
        },
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        retry: 2,
        placeholderData: keepPreviousData,
    }));
}

// =============================================================================
// Single Client Detail
// =============================================================================

export function useClient(id: () => number) {
    return createQuery(() => ({
        queryKey: clientKeys.detail(id()),
        queryFn: () => clientsApi.get(id()),
        enabled: !!id(),
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
    }));
}

// =============================================================================
// Reference Check (pre-flight for hard delete)
// =============================================================================

export function useCheckClientReferences(id: () => number | null, enabled: () => boolean) {
    return createQuery(() => ({
        queryKey: [...clientKeys.all, 'can-delete', id()],
        queryFn: async (): Promise<EntityReferences> => {
            return await clientsApi.canDelete(id()!);
        },
        enabled: enabled() && id() !== null,
        staleTime: 10_000,
        gcTime: 30_000,
        retry: false,
    }));
}

// =============================================================================
// SRI (Ecuador tax authority) Search
// =============================================================================

export function useSriSearchByRuc(querySignal: () => string) {
    return createQuery(() => ({
        queryKey: ['sri', 'by-ruc', querySignal()],
        queryFn: () => clientsApi.sriSearchByRuc(querySignal()),
        enabled: querySignal().length === 13,
        staleTime: 1000 * 60 * 60 * 24,      // 24 hours
        gcTime: 1000 * 60 * 60 * 24 * 7,     // 7 days
        retry: 1,
    }));
}

export function useSriSearchByName(querySignal: () => string) {
    return createQuery(() => ({
        queryKey: ['sri', 'by-name', querySignal()],
        queryFn: () => clientsApi.sriSearchByName(querySignal()),
        enabled: querySignal().length >= 3,
        staleTime: 1000 * 60 * 60 * 24,
        gcTime: 1000 * 60 * 60 * 24 * 7,
        retry: 1,
        placeholderData: keepPreviousData,
    }));
}
