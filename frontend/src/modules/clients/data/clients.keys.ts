// =============================================================================
// Query Keys — Clients
// =============================================================================
import type { EntityFilters } from '@app/schema/shared-dto';

export const clientKeys = {
    all: ['clients'] as const,
    lists: () => [...clientKeys.all, 'list'] as const,
    list: (filters: EntityFilters) => [...clientKeys.lists(), filters] as const,
    details: () => [...clientKeys.all, 'detail'] as const,
    detail: (id: number) => [...clientKeys.details(), id] as const,
    facets: (search?: string, filters?: Record<string, string[] | undefined>) =>
        [...clientKeys.all, 'facets', { search, ...filters }] as const,
};
