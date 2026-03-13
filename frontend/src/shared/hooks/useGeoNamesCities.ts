import { createQuery } from '@tanstack/solid-query';
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
export function useGeoNamesCities() {
    const [search, setSearch] = createSignal('');
    const [debouncedSearch, setDebouncedSearch] = createSignal('');

    let debounceTimer: ReturnType<typeof setTimeout>;
    onCleanup(() => clearTimeout(debounceTimer));

    const updateSearch = (value: string) => {
        setSearch(value);
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            setDebouncedSearch(value.trim());
        }, 400);
    };

    const query = createQuery(() => ({
        queryKey: ['geonames', 'cities', debouncedSearch()],
        queryFn: async () => {
            const q = debouncedSearch();
            const { data, error } = await (api.api.geonames.cities as any).get({ query: { q } });
            if (error) throw new Error(String(error.value));
            return (data ?? []) as GeoNameCity[];
        },
        enabled: debouncedSearch().length >= 2,
        staleTime: 1000 * 60 * 60 * 24, // 24h — city data is static
        gcTime: 1000 * 60 * 60 * 24,
    }));

    return {
        /** Current input value (raw, not debounced) */
        search,
        /** Update the search input — automatically debounces the API call */
        setSearch: updateSearch,
        /** TanStack Query result with city options */
        query,
    };
}
