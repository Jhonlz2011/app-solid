import { Show } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import type { ColumnDef } from '@tanstack/solid-table';
import Checkbox from '@shared/ui/Checkbox';
import { StatusBadge } from '@shared/ui/Badge';
import ActionMenu from '@shared/ui/ActionMenu';
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import type { FilterOption } from '@shared/ui/DataTable/DataTableColumnFilter';

export interface ColumnFilterConfig {
    options: () => FilterOption[];
    selected: () => string[];
    onChange: (selected: string[]) => void;
    isLoading: () => boolean;
}

export interface BaseEntityHandlers<T> {
    onDelete: (entity: T) => void;
    onRestore: (entity: T) => void;
    baseRoute: string;
    filters?: {
        isActive?: ColumnFilterConfig;
        businessName?: ColumnFilterConfig;
        taxIdType?: ColumnFilterConfig;
        [key: string]: ColumnFilterConfig | undefined;
    };
}

export interface BaseEntityListItem {
    id: number;
    is_active: boolean;
    business_name: string;
    tax_id: string;
    tax_id_type?: string;
    email_billing?: string | null;
    phone?: string | null;
    trade_name?: string | null;
}

export function createBaseEntityColumns<T extends BaseEntityListItem>(
    handlers: BaseEntityHandlers<T>
): {
    select: ColumnDef<T>;
    businessName: ColumnDef<T>;
    taxId: ColumnDef<T>;
    contactInfo: ColumnDef<T>;
    isActive: ColumnDef<T>;
    actions: ColumnDef<T>;
} {
    return {
        select: {
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
        },
        isActive: {
            accessorKey: 'is_active',
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Estado"
                    filterOptions={handlers.filters?.isActive?.options()}
                    selectedFilters={handlers.filters?.isActive?.selected()}
                    onFilterChange={handlers.filters?.isActive?.onChange}
                    isFilterLoading={handlers.filters?.isActive?.isLoading?.()}
                />
            ),
            meta: { title: 'Estado' },
            size: 110,
            cell: (info) => <StatusBadge isActive={info.getValue<boolean>()} />,
        },
        businessName: {
            accessorKey: 'business_name',
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Razón Social"
                    filterOptions={handlers.filters?.businessName?.options()}
                    selectedFilters={handlers.filters?.businessName?.selected()}
                    onFilterChange={handlers.filters?.businessName?.onChange}
                    isFilterLoading={handlers.filters?.businessName?.isLoading?.()}
                />
            ),
            meta: { title: 'Razón Social' },
            size: 210,
            cell: (info) => (
                <Link
                    to={`/${handlers.baseRoute}/${info.row.original.id}/show`}
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
        } as ColumnDef<T>,
        taxId: {
            accessorKey: 'tax_id',
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Identificación"
                    filterOptions={handlers.filters?.taxIdType?.options()}
                    selectedFilters={handlers.filters?.taxIdType?.selected()}
                    onFilterChange={handlers.filters?.taxIdType?.onChange}
                    isFilterLoading={handlers.filters?.taxIdType?.isLoading?.()}
                />
            ),
            meta: { title: 'Identificación' },
            size: 170,
            cell: (info) => (
                <Link
                    to={`/${handlers.baseRoute}/${info.row.original.id}/show`}
                    preload="intent"
                    class="block cursor-pointer group/cell"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div class="font-mono text-sm font-semibold text-primary group-hover/cell:underline underline-offset-2 transition-colors duration-150">
                        {info.getValue<string>()}
                    </div>
                    <div class="text-xs text-muted">{info.row.original.tax_id_type}</div>
                </Link>
            ),
        } as ColumnDef<T>,
        contactInfo: {
            accessorKey: 'email_billing',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Contacto" />,
            meta: { title: 'Contacto' },
            size: 200,
            cell: (info) => {
                const email = info.getValue<string>();
                const phone = info.row.original.phone;
                return (
                    <div class="min-w-0">
                        <Show when={email}>
                            <div class="text-sm truncate" title={email}>
                                <a href={`mailto:${email}`} class="hover:underline text-primary" onClick={(e) => e.stopPropagation()}>
                                    {email}
                                </a>
                            </div>
                        </Show>
                        <Show when={phone}>
                            <div class="text-xs text-muted truncate" title={phone}>{phone}</div>
                        </Show>
                        <Show when={!email && !phone}>
                            <span class="text-muted/50 text-xs">—</span>
                        </Show>
                    </div>
                );
            },
        } as ColumnDef<T>,
        actions: {
            id: 'actions',
            size: 50,
            enableHiding: false,
            cell: ({ row }) => {
                const entity = row.original;
                return (
                    <ActionMenu
                        module={handlers.baseRoute}
                        isActive={entity.is_active ?? false}
                        showTo={`/${handlers.baseRoute}/${entity.id}/show`}
                        editTo={`/${handlers.baseRoute}/${entity.id}/edit`}
                        onRestore={() => handlers.onRestore(entity)}
                        onDelete={() => handlers.onDelete(entity)}
                    />
                );
            },
        },
        
    };
}
