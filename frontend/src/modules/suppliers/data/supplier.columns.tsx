/**
 * Supplier Column Definitions
 *
 * Extracted from SuppliersPage for reusability and testability.
 * Creates column definitions with proper handlers.
 */
import { Show } from 'solid-js';
import type { ColumnDef } from '@tanstack/solid-table';
import type { SupplierListItem } from '../data/suppliers.api';
import Checkbox from '@shared/ui/Checkbox';
import { Badge, StatusBadge } from '@shared/ui/Badge';
import { DataTableColumnHeader } from '@shared/ui/DataTableColumnHeader';
import type { FilterOption } from '@shared/ui/DataTableColumnFilter';
import { EditIcon, TrashIcon } from '@shared/ui/icons';

/** Filter configuration for a single column - uses accessors for SolidJS reactivity */
export interface ColumnFilterConfig {
    options: () => FilterOption[];
    selected: () => string[];
    onChange: (selected: string[]) => void;
    isLoading: () => boolean;
}

export interface SupplierColumnHandlers {
    onEdit: (supplier: SupplierListItem) => void;
    onDelete: (supplier: SupplierListItem) => void;
    // Column filter configs (optional per column)
    filters?: {
        businessName?: ColumnFilterConfig;
        taxIdType?: ColumnFilterConfig;
        personType?: ColumnFilterConfig;
        isActive?: ColumnFilterConfig;
    };
}

/**
 * Creates supplier table columns with provided handlers
 */
export function createSupplierColumns(handlers: SupplierColumnHandlers): ColumnDef<SupplierListItem>[] {
    return [
        // Selection column
        {
            id: 'select',
            header: ({ table }) => (
                <Checkbox
                    indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
                    checked={table.getIsAllPageRowsSelected()}
                    onChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                />
            ),
            cell: ({ row }) => (
                <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={row.getIsSelected()}
                        onChange={(checked) => row.toggleSelected(checked)}
                    />
                </div>
            ),
            size: 36,
            enableSorting: false,
            enableHiding: false,
            enablePinning: false,
        },

        // Business Name
        {
            accessorKey: 'business_name',
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Razón Social"
                    filterOptions={handlers.filters?.businessName?.options()}
                    selectedFilters={handlers.filters?.businessName?.selected()}
                    onFilterChange={handlers.filters?.businessName?.onChange}
                    isFilterLoading={handlers.filters?.businessName?.isLoading()}
                />
            ),
            meta: { title: 'Razón Social' },
            size: 210,
            cell: (info) => (
                <div class="min-w-0">
                    <div class="font-medium text-text truncate">{info.getValue<string>()}</div>
                    <Show when={info.row.original.trade_name}>
                        <div class="text-xs text-muted truncate">{info.row.original.trade_name}</div>
                    </Show>
                </div>
            ),
        },

        // Tax ID
        {
            accessorKey: 'tax_id',
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Identificación"
                    filterOptions={handlers.filters?.taxIdType?.options()}
                    selectedFilters={handlers.filters?.taxIdType?.selected()}
                    onFilterChange={handlers.filters?.taxIdType?.onChange}
                    isFilterLoading={handlers.filters?.taxIdType?.isLoading()}
                />
            ),
            meta: { title: 'Identificación' },
            size: 170,
            cell: (info) => (
                <div>
                    <div class="font-mono text-sm font-semibold text-primary">{info.getValue<string>()}</div>
                    <div class="text-xs text-muted">{info.row.original.tax_id_type}</div>
                </div>
            ),
        },

        // Contact (Email + Phone)
        {
            accessorKey: 'email_billing',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Contacto" />,
            meta: { title: 'Contacto' },
            size: 200,
            cell: (info) => (
                <div class="min-w-0">
                    <div class="text-sm truncate">{info.getValue<string>()}</div>
                    <div class="text-xs text-muted truncate">{info.row.original.phone}</div>
                </div>
            ),
        },

        // Address
        {
            accessorKey: 'address_fiscal',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Dirección" />,
            meta: { title: 'Dirección' },
            size: 200,
            cell: (info) => (
                <span class="text-sm text-muted truncate block max-w-full">
                    {info.getValue<string>()}
                </span>
            ),
        },

        // Person Type
        {
            accessorKey: 'person_type',
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Tipo"
                    filterOptions={handlers.filters?.personType?.options()}
                    selectedFilters={handlers.filters?.personType?.selected()}
                    onFilterChange={handlers.filters?.personType?.onChange}
                    isFilterLoading={handlers.filters?.personType?.isLoading()}
                />
            ),
            meta: { title: 'Tipo' },
            size: 120,
            cell: (info) => {
                const type = info.getValue<string>();
                return (
                    <Badge variant={type === 'JURIDICA' ? 'primary' : 'info'}>
                        {type === 'JURIDICA' ? 'Jurídica' : 'Natural'}
                    </Badge>
                );
            },
        },

        // Status
        {
            accessorKey: 'is_active',
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Estado"
                    filterOptions={handlers.filters?.isActive?.options()}
                    selectedFilters={handlers.filters?.isActive?.selected()}
                    onFilterChange={handlers.filters?.isActive?.onChange}
                    isFilterLoading={handlers.filters?.isActive?.isLoading()}
                />
            ),
            meta: { title: 'Estado' },
            size: 120,
            cell: (info) => <StatusBadge isActive={info.getValue<boolean>()} />,
        },

        // Actions
        {
            id: 'actions',
            header: '',
            size: 78,
            enableHiding: false,
            enablePinning: false,
            cell: (info) => (
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handlers.onEdit(info.row.original);
                        }}
                        class="p-1.5 rounded-lg hover:bg-blue-500/20 text-muted hover:text-blue-400"
                        title="Editar"
                    >
                        <EditIcon class="size-4" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handlers.onDelete(info.row.original);
                        }}
                        class="p-1.5 rounded-lg hover:bg-red-500/20 text-muted hover:text-red-400"
                        title="Eliminar"
                    >
                        <TrashIcon class='size-4' />
                    </button>
                </div>
            ),
        },
    ];
}
