// =============================================================================
// Query Keys
// =============================================================================
import type { EntityFilters } from '@app/schema/shared-dto';

export const supplierKeys = {
    all: ['suppliers'] as const,
    lists: () => [...supplierKeys.all, 'list'] as const,
    list: (filters: EntityFilters) => [...supplierKeys.lists(), filters] as const,
    details: () => [...supplierKeys.all, 'detail'] as const,
    detail: (id: number) => [...supplierKeys.details(), id] as const,
    facets: (search?: string, filters?: Record<string, string[] | undefined>) =>
        [...supplierKeys.all, 'facets', { search, ...filters }] as const,
};
