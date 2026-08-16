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
        if (!data || !('nextCursor' in data.meta)) return;

        const cursorMeta = data.meta;
        if (cursorMeta.nextCursor && cursorMeta.hasNextPage) {
            queryClient.prefetchQuery({
                queryKey: brandKeys.list({ ...currentFilters, cursor: cursorMeta.nextCursor, direction: 'next' }),
                queryFn: () => brandsApi.list({ ...currentFilters, cursor: cursorMeta.nextCursor!, direction: 'next' }),
                staleTime: 1000 * 60 * 2,
            });
        }
        if (cursorMeta.prevCursor && cursorMeta.hasPrevPage) {
            queryClient.prefetchQuery({
                queryKey: brandKeys.list({ ...currentFilters, cursor: cursorMeta.prevCursor, direction: 'prev' }),
                queryFn: () => brandsApi.list({ ...currentFilters, cursor: cursorMeta.prevCursor!, direction: 'prev' }),
                staleTime: 1000 * 60 * 2,
            });
        }
    });

    return query;
}

/**
 * Single brand detail query by ID.
 */
export function useBrand(id: () => number) {
    return createQuery(() => ({
        queryKey: brandKeys.detail(id()),
        queryFn: () => brandsApi.get(id()),
        enabled: id() > 0,
        staleTime: 1000 * 60 * 5,
    }));
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
