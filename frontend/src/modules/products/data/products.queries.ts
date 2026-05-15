/**
 * products.queries.ts — TanStack Query Hooks (read-only) for Products module
 *
 * Only `createQuery` hooks live here.
 * All mutations are in `products.mutations.ts`.
 */
import { createQuery, keepPreviousData, useQueryClient } from '@tanstack/solid-query';
import { createEffect } from 'solid-js';
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import { productsApi, productKeys } from './products.api';
import type { ProductFilters, FacetData, ProductReferences } from './products.api';

// =============================================================================
// List with Cursor Pagination + Auto-prefetch
// =============================================================================

export function useProducts(filters: () => ProductFilters) {
    const queryClient = useQueryClient();
    const query = createQuery(() => ({
        queryKey: productKeys.list(filters()),
        queryFn: () => productsApi.list(filters()),
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
                queryKey: productKeys.list({ ...currentFilters, cursor: data.meta.nextCursor, direction: 'next' }),
                queryFn: () => productsApi.list({ ...currentFilters, cursor: data.meta.nextCursor!, direction: 'next' }),
                staleTime: 1000 * 60 * 2,
            });
        }

        if (data.meta.prevCursor && data.meta.hasPrevPage) {
            queryClient.prefetchQuery({
                queryKey: productKeys.list({ ...currentFilters, cursor: data.meta.prevCursor, direction: 'prev' }),
                queryFn: () => productsApi.list({ ...currentFilters, cursor: data.meta.prevCursor!, direction: 'prev' }),
                staleTime: 1000 * 60 * 2,
            });
        }
    });

    return query;
}

// =============================================================================
// Faceted Filter Options
// =============================================================================

export function useProductFacets(
    search: () => string | undefined,
    columnFilters?: () => {
        categoryId?: string[];
        brandId?: string[];
        productType?: string[];
        isActive?: string[];
    }
) {
    return createQuery(() => ({
        queryKey: productKeys.facets(search(), columnFilters?.()),
        queryFn: async (): Promise<FacetData> => {
            const cf = columnFilters?.();
            const { data, error } = await api.api.products.facets.get({
                query: {
                    search: search(),
                    categoryId: cf?.categoryId?.length ? cf.categoryId.join(',') : undefined,
                    brandId: cf?.brandId?.length ? cf.brandId.join(',') : undefined,
                    productType: cf?.productType?.length ? cf.productType.join(',') : undefined,
                    isActive: cf?.isActive?.length ? cf.isActive.join(',') : undefined,
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
// Single Product Detail
// =============================================================================

export function useProduct(id: () => number) {
    return createQuery(() => ({
        queryKey: productKeys.detail(id()),
        queryFn: () => productsApi.get(id()),
        enabled: !!id(),
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
    }));
}

// =============================================================================
// Reference Check (pre-flight for hard delete)
// =============================================================================

export function useCheckProductReferences(id: () => number | null, enabled: () => boolean) {
    return createQuery(() => ({
        queryKey: [...productKeys.all, 'can-delete', id()],
        queryFn: async (): Promise<ProductReferences> => productsApi.canDelete(id()!),
        enabled: enabled() && id() !== null,
        staleTime: 10_000,
        gcTime: 30_000,
        retry: false,
    }));
}
