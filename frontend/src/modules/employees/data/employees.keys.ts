// =============================================================================
// Query Keys
// =============================================================================
import type { EntityFilters } from '@app/schema/shared-dto';

export const employeeKeys = {
    all: ['employees'] as const,
    lists: () => [...employeeKeys.all, 'list'] as const,
    list: (filters: EntityFilters) => [...employeeKeys.lists(), filters] as const,
    details: () => [...employeeKeys.all, 'detail'] as const,
    detail: (id: number) => [...employeeKeys.details(), id] as const,
    facets: (search?: string, filters?: Record<string, string[] | undefined>) =>
        [...employeeKeys.all, 'facets', { search, ...filters }] as const,
    references: (id: number) => [...employeeKeys.all, 'references', id] as const,
};
