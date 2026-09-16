import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type {
    TaxonomyCategoryResponseType,
    TaxonomyCategorySearchQueryType,
    TaxonomyAttributeResponseType,
    TaxonomyAttributeValueType,
} from '@app/schema/backend';

export type {
    TaxonomyCategoryResponseType,
    TaxonomyCategorySearchQueryType,
    TaxonomyAttributeResponseType,
    TaxonomyAttributeValueType,
};

// =============================================================================
// API Client — Reference Taxonomy (/api/references/taxonomy/*)
// Consumes Shopify Standard Global Taxonomy in referenceDb via Eden Treaty
// =============================================================================

export const taxonomyApi = {
    /**
     * Search reference taxonomy categories by query string (minimum 1 char).
     * e.g. /api/references/taxonomy/categories?q=camisetas&limit=10
     */
    searchCategories: async (q: string, limit?: number): Promise<TaxonomyCategoryResponseType[]> => {
        const query = q.trim();
        if (!query) return [];

        const { data, error } = await api.references.taxonomy.categories.get({
            query: {
                q: query,
                limit: limit !== undefined ? limit : undefined,
            },
        });

        if (error) throwApiError(error);
        return (data || []) as TaxonomyCategoryResponseType[];
    },

    /**
     * Fetch recommended variant axes (attributes) and canonical values for a category.
     * e.g. /api/references/taxonomy/categories/12/attributes -> [ { name: 'Color', values: [...] }, { name: 'Talla' } ]
     */
    getCategoryAttributes: async (id: number): Promise<TaxonomyAttributeResponseType[]> => {
        if (!id || id <= 0) return [];

        const { data, error } = await api.references.taxonomy.categories({ id }).attributes.get();
        if (error) throwApiError(error);
        return (data || []) as TaxonomyAttributeResponseType[];
    },
};
