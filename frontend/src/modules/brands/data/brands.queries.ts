import { createQuery, keepPreviousData, useQueryClient } from '@tanstack/solid-query';
import { createEffect } from 'solid-js';
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';
import { brandsApi, type BrandFilters } from './brands.api';
import { brandKeys } from './brands.keys';

/**
 * Paginated brands query with auto-prefetch of next/prev pages.
 */
export function useBrands(filters: () => BrandFilters) {
    const queryClient = useQueryClient();
    const query = createQuery(() => ({
        queryKey: brandKeys.list(filters()),
        queryFn: () => brandsApi.list(filters()),
        staleTime: STALE_TIME.SHORT,
        gcTime: GC_TIME.DEFAULT,
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
                staleTime: STALE_TIME.SHORT,
            });
        }
        if (cursorMeta.prevCursor && cursorMeta.hasPrevPage) {
            queryClient.prefetchQuery({
                queryKey: brandKeys.list({ ...currentFilters, cursor: cursorMeta.prevCursor, direction: 'prev' }),
                queryFn: () => brandsApi.list({ ...currentFilters, cursor: cursorMeta.prevCursor!, direction: 'prev' }),
                staleTime: STALE_TIME.SHORT,
            });
        }
    });

    return query;
}

/**
 * Single brand detail query by ID.
 */
export function useBrand(id: () => number | null | undefined) {
    return createQuery(() => ({
        queryKey: brandKeys.detail(id() ?? 0),
        queryFn: () => brandsApi.get(id()!),
        enabled: Boolean(id() && id()! > 0),
        staleTime: STALE_TIME.MEDIUM,
        gcTime: GC_TIME.DEFAULT,
    }));
}

/**
 * Simple list of all active brands (for selectors/autocomplete).
 */
export function useBrandsList() {
    return createQuery(() => ({
        queryKey: brandKeys.allList(),
        queryFn: () => brandsApi.listAll(),
        staleTime: STALE_TIME.LONG,
        gcTime: GC_TIME.DEFAULT,
    }));
}
