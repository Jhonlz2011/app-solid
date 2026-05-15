import type { BrandFilters } from './brands.api';

export const brandKeys = {
    all: ['brands'] as const,
    lists: () => [...brandKeys.all, 'list'] as const,
    list: (filters: BrandFilters) => [...brandKeys.lists(), filters] as const,
    details: () => [...brandKeys.all, 'detail'] as const,
    detail: (id: number) => [...brandKeys.details(), id] as const,
};
