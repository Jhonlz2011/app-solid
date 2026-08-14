import { Show } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import type { ColumnDef } from '@tanstack/solid-table';
import type { ClientListItem } from '../data/clients.api';
import { Badge } from '@shared/ui/Badge';
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import type { ColumnFilterConfig } from '@modules/entities/data/createEntityColumns';
import { createBaseEntityColumns } from '@modules/entities/data/createEntityColumns';

export interface ClientColumnHandlers {
    onDelete: (client: ClientListItem) => void;
    onRestore: (client: ClientListItem) => void;
    filters?: {
        businessName?: ColumnFilterConfig;
        taxIdType?: ColumnFilterConfig;
        personType?: ColumnFilterConfig;
        isActive?: ColumnFilterConfig;
    };
}

export function createClientColumns(handlers: ClientColumnHandlers): ColumnDef<ClientListItem>[] {
    const base = createBaseEntityColumns<ClientListItem>({
        ...handlers,
        baseRoute: 'clients',
    });

    return [
        base.select,
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
                    to={`/clients/${info.row.original.id}/show`}
                    preload="intent"
                    class="min-w-0 block cursor-pointer group/cell"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div class="font-medium text-text truncate group-hover/cell:text-primary transition-colors duration-150">
                        {info.getValue<string>()}
                    </div>
                    <div class="text-xs text-muted truncate">{info.row.original.tax_id_type}</div>
                </Link>
            ),
        },
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
            meta: { title: 'Tipo de Persona' },
            size: 120,
            cell: (info) => (
                <Badge variant="outline" class="font-normal border-border/50 text-muted bg-surface/30">
                    {info.getValue<string>() === 'natural' ? 'Natural' : 'Jurídica'}
                </Badge>
            ),
        },
        {
            id: 'contact_info',
            header: () => (
                <div class="flex items-center gap-1.5 h-full px-2 font-medium text-muted">
                    <span>Contacto</span>
                </div>
            ),
            meta: { title: 'Contacto' },
            size: 180,
            enableSorting: false,
            cell: ({ row }) => {
                const p = row.original;
                return (
                    <div class="flex flex-col min-w-0">
                        <Show when={p.email_billing}>
                            <div class="text-xs text-text truncate" title={p.email_billing!}>{p.email_billing}</div>
                        </Show>
                        <Show when={p.phone}>
                            <div class="text-xs text-muted truncate" title={p.phone!}>{p.phone}</div>
                        </Show>
                        <Show when={!p.email_billing && !p.phone}>
                            <span class="text-muted/50 text-xs">—</span>
                        </Show>
                    </div>
                );
            },
        },
        base.isActive,
        base.actions,
    ];
}
