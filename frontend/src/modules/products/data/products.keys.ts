/**
 * products.keys.ts — Centralized query keys for Products module
 */
import type { ProductFilters } from './products.api';

export const productKeys = {
    all: ['products'] as const,
    lists: () => [...productKeys.all, 'list'] as const,
    list: (filters: ProductFilters) => [...productKeys.lists(), filters] as const,
    details: () => [...productKeys.all, 'detail'] as const,
    detail: (id: number) => [...productKeys.details(), id] as const,
    facets: (search?: string, filters?: Record<string, string[] | undefined>) =>
        [...productKeys.all, 'facets', { search, ...filters }] as const,
    references: (id: number) => [...productKeys.all, 'can-delete', id] as const,
};
