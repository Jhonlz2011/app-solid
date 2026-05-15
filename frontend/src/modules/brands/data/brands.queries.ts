import { createQuery, keepPreviousData, useQueryClient } from '@tanstack/solid-query';
import { createEffect } from 'solid-js';
import { brandsApi, type BrandFilters, type BrandItem } from './brands.api';
import { brandKeys } from './brands.keys';

/**
 * Paginated brands query with auto-prefetch of next/prev pages.
 */
export function useBrands(filters: () => BrandFilters) {
    const queryClient = useQueryClient();
    const query = createQuery(() => ({
        queryKey: brandKeys.list(filters()),
        queryFn: () => brandsApi.list(filters()),
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 30,
        placeholderData: keepPreviousData,
    }));

    // Auto-prefetch adjacent pages
    createEffect(() => {
        const data = query.data;
        const currentFilters = filters();
        if (!data) return;

        if (data.meta.nextCursor && data.meta.hasNextPage) {
            queryClient.prefetchQuery({
                queryKey: brandKeys.list({ ...currentFilters, cursor: data.meta.nextCursor, direction: 'next' }),
                queryFn: () => brandsApi.list({ ...currentFilters, cursor: data.meta.nextCursor!, direction: 'next' }),
                staleTime: 1000 * 60 * 2,
            });
        }
        if (data.meta.prevCursor && data.meta.hasPrevPage) {
            queryClient.prefetchQuery({
                queryKey: brandKeys.list({ ...currentFilters, cursor: data.meta.prevCursor, direction: 'prev' }),
                queryFn: () => brandsApi.list({ ...currentFilters, cursor: data.meta.prevCursor!, direction: 'prev' }),
                staleTime: 1000 * 60 * 2,
            });
        }
    });

    return query;
}

/**
 * Simple list of all active brands (for selectors/autocomplete).
 */
export function useBrandsList() {
    return createQuery(() => ({
        queryKey: [...brandKeys.all, 'all'] as const,
        queryFn: () => brandsApi.listAll() as Promise<BrandItem[]>,
        staleTime: 1000 * 60 * 30,
    }));
}
