import { Show } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import type { ColumnDef } from '@tanstack/solid-table';
import Checkbox from '@shared/ui/Checkbox';
import { StatusBadge, Badge } from '@shared/ui/Badge';
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
    tax_regime_type?: string | null;
    obligado_contabilidad?: boolean | null;
    is_retention_agent?: boolean | null;
    is_special_contributor?: boolean | null;
}

export function createBaseEntityColumns<T extends BaseEntityListItem>(
    handlers: BaseEntityHandlers<T>
): {
    select: ColumnDef<T>;
    businessName: ColumnDef<T>;
    taxId: ColumnDef<T>;
    contactInfo: ColumnDef<T>;
    fiscal: ColumnDef<T>;
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
                                <a href={`mailto:${email}`} class="hover:underline text-primary-strong" onClick={(e) => e.stopPropagation()}>
                                    {email}
                                </a>
                            </div>
                        </Show>
                        <Show when={phone}>
                            <div class="text-xs text-muted truncate">{phone}</div>
                        </Show>
                        <Show when={!email && !phone}>
                            <span class="text-muted/50 text-xs">—</span>
                        </Show>
                    </div>
                );
            },
        } as ColumnDef<T>,
        fiscal: {
            id: 'fiscal',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fiscal" />,
            meta: { title: 'Fiscal' },
            size: 160,
            cell: (info) => {
                const entity = info.row.original;
                const hasRegime = () => !!entity.tax_regime_type && entity.tax_regime_type !== 'GENERAL';
                const hasFlags = () => !!entity.obligado_contabilidad || !!entity.is_retention_agent || !!entity.is_special_contributor;
                const hasAny = () => hasRegime() || hasFlags();

                return (
                    <div class="flex flex-col gap-1 min-w-0">
                        <Show when={hasRegime()}>
                            <Badge
                                variant="default"
                                class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0 rounded w-max border-border/60"
                                title={`Régimen: ${entity.tax_regime_type}`}
                            >
                                {entity.tax_regime_type}
                            </Badge>
                        </Show>
                        <Show when={hasFlags()}>
                            <div class="flex flex-wrap gap-1">
                                <Show when={entity.obligado_contabilidad}>
                                    <Badge
                                        variant="success"
                                        class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0 rounded"
                                        title="Obligado a llevar contabilidad"
                                    >
                                        Obl. Cont.
                                    </Badge>
                                </Show>
                                <Show when={entity.is_retention_agent}>
                                    <Badge
                                        variant="info"
                                        class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0 rounded"
                                        title="Agente de Retención"
                                    >
                                        Ag. Ret.
                                    </Badge>
                                </Show>
                                <Show when={entity.is_special_contributor}>
                                    <Badge
                                        variant="warning"
                                        class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0 rounded"
                                        title="Contribuyente Especial"
                                    >
                                        Contr. Esp.
                                    </Badge>
                                </Show>
                            </div>
                        </Show>
                        <Show when={!hasAny()}>
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
