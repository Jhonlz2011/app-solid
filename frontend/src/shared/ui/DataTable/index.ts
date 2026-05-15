export { DataTable } from './DataTable';
export type { DataTableProps, DataTableRowProps } from './DataTable';
export type { FilterOption } from './DataTableColumnFilter';

/** Shared filter configuration for column headers — DRY across all modules */
export interface ColumnFilterConfig {
    options: () => FilterOption[];
    selected: () => string[];
    onChange: (selected: string[]) => void;
    isLoading: () => boolean;
}
