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
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import type { FilterOption } from '@shared/ui/DataTable/DataTableColumnFilter';
import { EditIcon, TrashIcon, RotateCcwIcon, MoreVerticalIcon, EyeIcon } from '@shared/ui/icons';
import DropdownMenu from '@shared/ui/DropdownMenu';

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
    onView: (supplier: SupplierListItem) => void;
    onRestore: (supplier: SupplierListItem) => void;
    auth: {
        hasPermission: (perm: string) => boolean;
        canEdit: (resource: string) => boolean;
        canDelete: (resource: string) => boolean;
    };
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
                <div
                    class="min-w-0 cursor-pointer group/cell"
                    title={info.getValue<string>()}
                    onClick={(e) => { e.stopPropagation(); handlers.onView(info.row.original); }}
                >
                    <div class="font-medium text-text truncate group-hover/cell:text-primary transition-colors duration-150">
                        {info.getValue<string>()}
                    </div>
                    <Show when={info.row.original.trade_name}>
                        <div class="text-xs text-muted truncate">{info.row.original.trade_name}</div>
                    </Show>
                </div>
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
                <div
                    class="cursor-pointer group/cell"
                    onClick={(e) => { e.stopPropagation(); handlers.onView(info.row.original); }}
                >
                    <div class="font-mono text-sm font-semibold text-primary group-hover/cell:underline underline-offset-2 transition-all duration-150">
                        {info.getValue<string>()}
                    </div>
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
                const supplier = info.row.original;
                return (
                    <div class="flex flex-col gap-1">
                        <Show when={supplier.tax_regime_type && supplier.tax_regime_type !== 'GENERAL'}>
                            <span class="text-[10px] font-bold uppercase tracking-wider bg-surface/50 border border-border/60 text-muted px-1.5 py-0.5 rounded w-max shadow-sm">
                                {supplier.tax_regime_type}
                            </span>
                        </Show>
                        <div class="flex flex-wrap gap-1">
                            <Show when={supplier.obligado_contabilidad}>
                                <span class="text-[9px] font-bold uppercase tracking-wider bg-success/10 text-success border border-success/20 px-1.5 py-0.5 rounded shadow-sm" title="Obligado a llevar contabilidad">Obl. Cont.</span>
                            </Show>
                            <Show when={supplier.is_retention_agent}>
                                <span class="text-[9px] font-bold uppercase tracking-wider bg-info/10 text-info border border-info/20 px-1.5 py-0.5 rounded shadow-sm" title="Agente de Retención">Ag. Ret.</span>
                            </Show>
                            <Show when={supplier.is_special_contributor}>
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
                const supplier = info.row.original;
                const isActive = () => supplier.is_active;
                const canDestroy = () => handlers.auth.hasPermission('suppliers:destroy');
                const canRestore = () => handlers.auth.hasPermission('suppliers:restore') && !isActive();
                const canEdit = () => handlers.auth.canEdit('suppliers');
                const canDelete = () => handlers.auth.canDelete('suppliers') && isActive();
               

                return (
                    <div class="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <DropdownMenu placement="bottom-end">
                            <DropdownMenu.Trigger variant="ghost" class="size-8 p-0 data-[expanded]:bg-card-alt data-[expanded]:opacity-100" title="Acciones">
                                <MoreVerticalIcon class="size-4" />
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content class="min-w-[160px]">
                                <DropdownMenu.Item onSelect={() => handlers.onView(supplier)}>
                                    <EyeIcon class="size-4 mr-2" />
                                    <span>Ver detalles</span>
                                </DropdownMenu.Item>
                                
                                <Show when={canEdit()}>
                                    <DropdownMenu.Item onSelect={() => handlers.onEdit(supplier)}>
                                        <EditIcon class="size-4 mr-2" />
                                        <span>Editar</span>
                                    </DropdownMenu.Item>
                                </Show>

                                <Show when={canRestore()}>
                                    <DropdownMenu.Item onSelect={() => handlers.onRestore(supplier)}>
                                        <RotateCcwIcon class="size-4 mr-2 text-emerald-500" />
                                        <span class="text-emerald-500">Restaurar</span>
                                    </DropdownMenu.Item>
                                </Show>

                                <Show when={canDelete() || canDestroy()}>
                                    <DropdownMenu.Separator />
                                    <DropdownMenu.Item onSelect={() => handlers.onDelete(supplier)} destructive>
                                        <TrashIcon class="size-4 mr-2" />
                                        <span>Eliminar</span>
                                    </DropdownMenu.Item>
                                </Show>
                            </DropdownMenu.Content>
                        </DropdownMenu>
                    </div>
                );
            },
        },
    ];
}
