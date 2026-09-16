import { createQuery } from '@tanstack/solid-query';
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';
import { taxonomyApi } from './taxonomy.api';
import type {
    TaxonomyCategoryResponseType,
    TaxonomyAttributeResponseType,
} from './taxonomy.api';

export type {
    TaxonomyCategoryResponseType,
    TaxonomyAttributeResponseType,
};

// =============================================================================
// Query Keys — Taxonomy Reference Data
// =============================================================================

export const taxonomyKeys = {
    all: ['references', 'taxonomy'] as const,
    categories: () => [...taxonomyKeys.all, 'categories'] as const,
    categoriesSearch: (q: string, limit?: number) =>
        [...taxonomyKeys.categories(), 'search', q, limit ?? 'default'] as const,
    categoryAttributes: (categoryId: number) =>
        [...taxonomyKeys.all, 'attributes', categoryId] as const,
};

// =============================================================================
// TanStack Query Hooks — Reference Taxonomy
// =============================================================================

/**
 * Hook to search Shopify standard global taxonomy categories by keyword.
 * Uses 24-hour cache (STALE_TIME.DAY) because taxonomy categories are static canonical dictionaries.
 */
export function useTaxonomyCategoriesSearch(
    query: () => string,
    limit?: () => number | undefined,
) {
    return createQuery(() => {
        const q = query().trim();
        const lim = limit?.();

        return {
            queryKey: taxonomyKeys.categoriesSearch(q, lim),
            queryFn: () => taxonomyApi.searchCategories(q, lim),
            enabled: q.length >= 1,
            staleTime: STALE_TIME.DAY,
            gcTime: GC_TIME.DEFAULT,
        };
    });
}

/**
 * Hook to fetch recommended taxonomy attributes (Color, Talla, Material, etc.)
 * and canonical values for a category ID.
 */
export function useTaxonomyCategoryAttributes(
    categoryId: () => number | null | undefined,
) {
    return createQuery(() => {
        const id = categoryId();

        return {
            queryKey: taxonomyKeys.categoryAttributes(id ?? 0),
            queryFn: () => taxonomyApi.getCategoryAttributes(id!),
            enabled: Boolean(id && id > 0),
            staleTime: STALE_TIME.DAY,
            gcTime: GC_TIME.DEFAULT,
        };
    });
}
