import { createQuery, keepPreviousData } from '@tanstack/solid-query';
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';

// =============================================================================
// Types
// =============================================================================

export interface GeoNameCity {
    ciudad: string;
    pais: string;
    codigo: string;
    bandera: string;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Debounced city search via GeoNames backend proxy.
 * Results are cached 24h on both backend (Redis) and frontend (TanStack Query).
 *
 * @example
 * const { query: cityQuery, search, setSearch } = useGeoNamesCities();
 * <Autocomplete
 *   value={search()}
 *   onInputChange={setSearch}
 *   options={cityQuery.data ?? []}
 *   ...
 * />
 */
export function useGeoNamesCities(querySignal: () => string) {
    return createQuery(() => ({
        queryKey: ['geonames', 'cities', querySignal()],
        queryFn: async () => {
            const q = querySignal();
            if (q.length < 2) return [];
            
            const { data, error } = await (api.geonames.cities as any).get({ query: { q } });
            if (error) throwApiError(error);
            return (data ?? []) as GeoNameCity[];
        },
        enabled: querySignal().length >= 2,
        staleTime: STALE_TIME.DAY,
        gcTime: GC_TIME.WEEK,
        placeholderData: keepPreviousData,
    }));
}
