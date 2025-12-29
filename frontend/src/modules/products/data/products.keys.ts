// products/data/products.keys.ts
// Query key factory for TanStack Query cache management
import type { ProductFilters } from '../models/products.type';

export const productKeys = {
    // Base key
    all: ['products'] as const,

    // Lists
    lists: () => [...productKeys.all, 'list'] as const,
    list: (filters?: ProductFilters) => [...productKeys.lists(), filters] as const,

    // Details
    details: () => [...productKeys.all, 'detail'] as const,
    detail: (id: number) => [...productKeys.details(), id] as const,
};

export const categoryKeys = {
    all: ['categories'] as const,
    lists: () => [...categoryKeys.all, 'list'] as const,
    list: () => [...categoryKeys.lists()] as const,
    details: () => [...categoryKeys.all, 'detail'] as const,
    detail: (id: number) => [...categoryKeys.details(), id] as const,
};

export const brandKeys = {
    all: ['brands'] as const,
    list: () => [...brandKeys.all, 'list'] as const,
};

export const catalogKeys = {
    uom: ['catalogs', 'uom'] as const,
    attributes: ['catalogs', 'attributes'] as const,
};
