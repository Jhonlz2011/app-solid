import { env } from '../config/env';
import { cacheService } from './cache.service';

// =============================================================================
// Types
// =============================================================================

export interface GeoNameCity {
    ciudad: string;
    pais: string;
    codigo: string;
    bandera: string;
}

interface GeoNamesApiResponse {
    geonames: Array<{
        name: string;
        countryName: string;
        countryCode: string;
        population: number;
    }>;
}

// =============================================================================
// Service
// =============================================================================

const GEONAMES_BASE_URL = 'https://secure.geonames.org/searchJSON';
const CACHE_TTL = 86400; // 24 hours — city data is static

export const geonamesService = {
    /**
     * Search cities by partial name.
     * Results are cached for 24h to minimize external API calls.
     */
    async searchCities(query: string): Promise<GeoNameCity[]> {
        const cacheKey = `geonames:cities:${query.toLowerCase().trim()}`;

        return cacheService.getOrSet(cacheKey, async () => {
            const params = new URLSearchParams({
                name_startsWith: query,
                maxRows: '6',
                lang: 'es',
                featureClass: 'P',
                // cities: 'cities15000',
                orderby: 'population',
                countryBias:'EC',
                username: env.GEONAMES_USERNAME || 'demo',
            });

            const response = await fetch(`${GEONAMES_BASE_URL}?${params}`);

            if (!response.ok) {
                throw new Error(`GeoNames API error: ${response.statusText}`);
            }

            const data: GeoNamesApiResponse = await response.json();

            if (!data.geonames) return [];

            // Deduplicate by city name + country code (GeoNames can return duplicates)
            const seen = new Map<string, GeoNameCity>();
            for (const lugar of data.geonames) {
                const countryCode = (lugar.countryCode || 'EC').toLowerCase();
                const key = `${lugar.name}_${lugar.countryCode || 'EC'}`;
                if (!seen.has(key)) {
                    seen.set(key, {
                        ciudad: lugar.name,
                        pais: lugar.countryName,
                        codigo: lugar.countryCode || 'EC',
                        bandera: `https://flagcdn.com/${countryCode}.svg`,
                    });
                }
            }
            return Array.from(seen.values());
        }, CACHE_TTL);
    },
};
