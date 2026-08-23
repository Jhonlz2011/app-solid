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
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';
import { productsApi } from './products.api';
import { productKeys } from './products.keys';
import type { ProductFilters, ProductReferences } from './products.api';
import type { FacetData } from '@app/schema/dto';

// =============================================================================
// List with Cursor Pagination + Auto-prefetch
// =============================================================================

export function useProducts(filters: () => ProductFilters) {
    const queryClient = useQueryClient();
    const query = createQuery(() => ({
        queryKey: productKeys.list(filters()),
        queryFn: () => productsApi.list(filters()),
        staleTime: STALE_TIME.SHORT,
        gcTime: GC_TIME.DEFAULT,
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
                staleTime: STALE_TIME.SHORT,
            });
        }

        if (data.meta.prevCursor && data.meta.hasPrevPage) {
            queryClient.prefetchQuery({
                queryKey: productKeys.list({ ...currentFilters, cursor: data.meta.prevCursor, direction: 'prev' }),
                queryFn: () => productsApi.list({ ...currentFilters, cursor: data.meta.prevCursor!, direction: 'prev' }),
                staleTime: STALE_TIME.SHORT,
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
            const { data, error } = await api.products.facets.get({
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
        staleTime: STALE_TIME.MEDIUM,
        gcTime: GC_TIME.DEFAULT,
        retry: 2,
        placeholderData: keepPreviousData,
    }));
}

// =============================================================================
// Single Product Detail
// =============================================================================

export function useProduct(id: () => number | null | undefined) {
    return createQuery(() => ({
        queryKey: productKeys.detail(id() ?? 0),
        queryFn: () => productsApi.get(id()!),
        enabled: Boolean(id() && id()! > 0),
        staleTime: STALE_TIME.MEDIUM,
        gcTime: GC_TIME.DEFAULT,
    }));
}

// =============================================================================
// Reference Check (pre-flight for hard delete)
// =============================================================================

export function useCheckProductReferences(id: () => number | null | undefined, enabled: () => boolean) {
    return createQuery(() => ({
        queryKey: productKeys.references(id() ?? 0),
        queryFn: async (): Promise<ProductReferences> => productsApi.canDelete(id()!),
        enabled: enabled() && Boolean(id()),
        staleTime: 10_000,
        gcTime: GC_TIME.PREFLIGHT,
        retry: false,
    }));
}
