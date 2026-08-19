import { createQuery, keepPreviousData } from '@tanstack/solid-query';
import { createSignal, onCleanup } from 'solid-js';
import { api } from '@shared/lib/eden';

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
            if (error) throw new Error(String(error.value));
            return (data ?? []) as GeoNameCity[];
        },
        enabled: querySignal().length >= 2,
        staleTime: 1000 * 60 * 60 * 24, // 24h — city data is static
        gcTime: 1000 * 60 * 60 * 24,
        placeholderData: keepPreviousData,
    }));
}
