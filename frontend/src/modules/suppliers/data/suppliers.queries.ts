/**
 * suppliers.queries.ts — TanStack Query Hooks (read-only) for Suppliers module
 *
 * Only `createQuery` / `createInfiniteQuery` hooks live here.
 * All mutations are in `suppliers.mutations.ts`.
 */
import { createQuery, createInfiniteQuery, keepPreviousData, useQueryClient } from '@tanstack/solid-query';
import { createEffect } from 'solid-js';
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import { suppliersApi } from './suppliers.api';
import { supplierKeys } from './suppliers.keys';
import type { EntityFilters, FacetData, EntityReferences } from '@app/schema/shared-dto';

// =============================================================================
// List with Cursor Pagination + Auto-prefetch
// =============================================================================

export function useSuppliers(filters: () => EntityFilters) {
    const queryClient = useQueryClient();
    const query = createQuery(() => ({
        queryKey: supplierKeys.list(filters()),
        queryFn: () => suppliersApi.list(filters()),
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

// =============================================================================
// Infinite Scroll (mobile card view)
// =============================================================================

export function useInfiniteSuppliers(filters: () => Omit<EntityFilters, 'cursor' | 'direction'>) {
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
// Single Supplier Detail
// =============================================================================

export function useSupplier(id: () => number) {
    return createQuery(() => ({
        queryKey: supplierKeys.detail(id()),
        queryFn: () => suppliersApi.get(id()),
        enabled: !!id(),
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
    }));
}

// =============================================================================
// Reference Check (pre-flight for hard delete)
// =============================================================================

export function useCheckSupplierReferences(id: () => number | null, enabled: () => boolean) {
    return createQuery(() => ({
        queryKey: [...supplierKeys.all, 'can-delete', id()],
        queryFn: async (): Promise<EntityReferences> => {
            return await suppliersApi.canDelete(id()!);
        },
        enabled: enabled() && id() !== null,
        staleTime: 10_000,
        gcTime: 30_000,
        retry: false,
    }));
}
