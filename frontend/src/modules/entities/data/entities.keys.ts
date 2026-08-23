import type { EntityFilters } from '@app/schema/dto';

export function createEntityKeys(entityName: string) {
    const all = [entityName] as const;
    const lists = () => [...all, 'list'] as const;
    
    return {
        all,
        lists,
        list: (filters: EntityFilters) => [...lists(), filters] as const,
        details: () => [...all, 'detail'] as const,
        detail: (id: string | number) => [...all, 'detail', id] as const,
        facets: (search?: string, filters?: Record<string, string[] | undefined>) =>
            [...all, 'facets', { search, ...filters }] as const,
    };
}

export type EntityKeys = ReturnType<typeof createEntityKeys>;
