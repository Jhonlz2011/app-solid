import { sql } from '@app/schema';
import { referenceDb } from '../../core/db';
import { localidades } from '@app/schema/localidades';

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
// Service
// =============================================================================

export const geonamesService = {
    /**
     * Search cities by partial name in local DB.
     */
    async searchCities(query: string): Promise<GeoNameCity[]> {
        const cleanQuery = query.trim();
        if (cleanQuery.length === 0) return [];

        const searchTerms = cleanQuery
            .replace(/[^\p{L}\p{N}\s]/gu, '') 
            .split(/\s+/)
            .filter(word => word.length > 0);
        
        if (searchTerms.length === 0) return [];
        
        const formattedQuery = searchTerms.map(word => `${word}:*`).join(' & ');
        const tsQuery = sql`to_tsquery('spanish'::regconfig, f_unaccent(${formattedQuery}))`;

        const results = await referenceDb
            .select({
                ciudad: localidades.ciudad,
                pais: localidades.pais,
                codigo_pais: localidades.codigo_pais,
            })
            .from(localidades)
            .where(sql`${localidades.vector_busqueda} @@ ${tsQuery}`)
            .limit(10);

        return results.map(row => ({
            ciudad: row.ciudad,
            pais: row.pais,
            codigo: row.codigo_pais,
            bandera: `https://flagcdn.com/${row.codigo_pais.toLowerCase()}.svg`,
        }));
    },
};
