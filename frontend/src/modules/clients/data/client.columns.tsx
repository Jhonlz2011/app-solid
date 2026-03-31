/**
 * Client Column Definitions
 *
 * Extracted from ClientsPage for reusability and testability.
 * Creates column definitions with proper handlers.
 */
import { Show } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import type { ColumnDef } from '@tanstack/solid-table';
import type { ClientListItem } from '../data/clients.api';
import { useAuth } from '@/modules/auth/store/auth.store';
import Checkbox from '@shared/ui/Checkbox';
import { Badge, StatusBadge } from '@shared/ui/Badge';
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import type { FilterOption } from '@shared/ui/DataTable/DataTableColumnFilter';
import ActionMenu from '@shared/ui/ActionMenu';

/** Filter configuration for a single column - uses accessors for SolidJS reactivity */
export interface ColumnFilterConfig {
    options: () => FilterOption[];
    selected: () => string[];
    onChange: (selected: string[]) => void;
    isLoading: () => boolean;
}

export interface ClientColumnHandlers {
    onDelete: (client: ClientListItem) => void;
    onRestore: (client: ClientListItem) => void;
    auth: ReturnType<typeof useAuth>;
    filters?: {
        businessName?: ColumnFilterConfig;
        taxIdType?: ColumnFilterConfig;
        personType?: ColumnFilterConfig;
        isActive?: ColumnFilterConfig;
    };
}

/**
 * Creates client table columns with provided handlers
 */
export function createClientColumns(handlers: ClientColumnHandlers): ColumnDef<ClientListItem>[] {
    return [
        {
            id: 'select',
            header: ({ table }) => (
                <Checkbox
                    indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
                    checked={table.getIsAllPageRowsSelected()}
                    onChange={(checked) => table.toggleAllPageRowsSelected(checked)}/>
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
        },

        // Business Name — click navigates to detail view
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
                <Link
                    to={`/clients/${info.row.original.id}/show`}
                    preload="intent"
                    class="min-w-0 block cursor-pointer group/cell"
                    title={info.getValue<string>()}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div class="font-medium text-text truncate group-hover/cell:text-primary transition-colors duration-150">
                        {info.getValue<string>()}
                    </div>
                    <Show when={info.row.original.trade_name}>
                        <div class="text-xs text-muted truncate">{info.row.original.trade_name}</div>
                    </Show>
                </Link>
            ),
        },

        // Tax ID — click navigates to detail view
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
                <Link
                    to={'/clients/' + String(info.row.original.id) + '/show'}
                    preload="intent"
                    class="block cursor-pointer group/cell"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div class="font-mono text-sm font-semibold text-primary group-hover/cell:underline underline-offset-2 transition-all duration-150">
                        {info.getValue<string>()}
                    </div>
                    <div class="text-xs text-muted">{info.row.original.tax_id_type}</div>
                </Link>
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
            size: 110,
            cell: (info) => {
                const type = info.getValue<string>();
                return (
                    <Badge variant={type === 'JURIDICA' ? 'primary' : 'info'} class="text-[11px] uppercase tracking-wider border-primary/20">
                        {type === 'JURIDICA' ? 'Jurídica' : 'Natural'}
                    </Badge>
                );
            },
        },

        // Fiscal Info
        {
            id: 'fiscal',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fiscal" />,
            meta: { title: 'Fiscal' },
            size: 160,
            cell: (info) => {
                const client = info.row.original;
                return (
                    <div class="flex flex-col gap-1">
                        <Show when={client.tax_regime_type && client.tax_regime_type !== 'GENERAL'}>
                            <span class="text-[10px] font-bold uppercase tracking-wider bg-surface/50 border border-border/60 text-muted px-1.5 py-0.5 rounded w-max shadow-sm">
                                {client.tax_regime_type}
                            </span>
                        </Show>
                        <div class="flex flex-wrap gap-1">
                            <Show when={client.obligado_contabilidad}>
                                <span class="text-[9px] font-bold uppercase tracking-wider bg-success/10 text-success border border-success/20 px-1.5 py-0.5 rounded shadow-sm" title="Obligado a llevar contabilidad">Obl. Cont.</span>
                            </Show>
                            <Show when={client.is_retention_agent}>
                                <span class="text-[9px] font-bold uppercase tracking-wider bg-info/10 text-info border border-info/20 px-1.5 py-0.5 rounded shadow-sm" title="Agente de Retención">Ag. Ret.</span>
                            </Show>
                            <Show when={client.is_special_contributor}>
                                <span class="text-[9px] font-bold uppercase tracking-wider bg-warning/10 text-warning border border-warning/20 px-1.5 py-0.5 rounded shadow-sm" title="Contribuyente Especial">Contr. Esp.</span>
                            </Show>
                        </div>
                    </div>
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

        // Actions — adapts based on is_active state
        {
            id: 'actions',
            header: '',
            size: 50,
            enableHiding: false,
            cell: (info) => {
                const client = info.row.original;
                return (
                    <ActionMenu
                        module="clients"
                        isActive={client.is_active ?? false}
                        showTo={`/clients/${client.id}/show`}
                        editTo={`/clients/${client.id}/edit`}
                        onRestore={() => handlers.onRestore(client)}
                        onDelete={() => handlers.onDelete(client)}
                    />
                );
            },
        },
    ];
}
