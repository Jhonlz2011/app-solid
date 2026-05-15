/**
 * Facet Utilities — Shared helpers for converting backend facet data to filter options.
 *
 * Used by SuppliersPage, UsersRolesPage, and any future module with DataTableColumnFilter.
 */
import type { FilterOption } from '@shared/ui/DataTable/DataTableColumnFilter';
import type { FacetData } from '@app/schema/shared-dto';

// Re-export for backward compatibility
export type { FacetData };

/**
 * Convert a specific facet key from the backend response into FilterOption[].
 *
 * @param facets - Raw facet data from the API
 * @param facetKey - The key to extract (e.g., 'is_active', 'isActive', 'person_type')
 * @param labelMap - Optional mapping from raw values to human-readable labels
 */
export function buildFilterOptions(
    facets: FacetData | undefined,
    facetKey: string,
    labelMap?: Record<string, string>
): FilterOption[] {
    if (!facets || !facets[facetKey]) return [];
    return facets[facetKey].map(f => ({
        value: f.value,
        label: labelMap?.[f.value] ?? f.value,
        count: f.count,
    }));
}
