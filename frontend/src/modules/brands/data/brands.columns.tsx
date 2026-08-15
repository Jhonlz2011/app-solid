/**
 * Brand Column Definitions
 *
 * Uses ActionMenu (same pattern as supplier.columns.tsx) for row actions.
 * ActionMenu handles RBAC internally via useAuth().
 */
import { Show } from 'solid-js';
import type { ColumnDef } from '@tanstack/solid-table';
import type { BrandItem } from './brands.api';
import Checkbox from '@shared/ui/Checkbox';
import { StatusBadge } from '@shared/ui/Badge';
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import { EditIcon, TrashIcon, RotateCcwIcon } from '@shared/ui/icons';
import Button from '@shared/ui/Button';
import LinkButton from '@shared/ui/LinkButton';

export interface BrandColumnHandlers {
    onDelete: (brand: BrandItem) => void;
    onRestore: (brand: BrandItem) => void;
    canEdit: boolean;
    canDelete: boolean;
}

export function createBrandColumns(handlers: BrandColumnHandlers): ColumnDef<BrandItem>[] {
    return [
        // Select checkbox
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
        },

        // Name
        {
            accessorKey: 'name',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
            meta: { title: 'Nombre' },
            size: 250,
            cell: (info) => (
                <span
                    class="font-medium text-text"
                    classList={{ 'text-muted line-through': !(info.row.original.is_active ?? true) }}
                >
                    {info.getValue<string>()}
                </span>
            ),
        },

        // Website
        {
            accessorKey: 'website',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Website" />,
            meta: { title: 'Website' },
            size: 250,
            cell: (info) => {
                const val = info.getValue<string | null>();
                return val
                    ? <a href={val} target="_blank" rel="noopener noreferrer" class="text-sm text-primary hover:underline truncate" onClick={(e: any) => e.stopPropagation()}>{val}</a>
                    : <span class="text-sm text-muted">—</span>;
            },
        },

        // Status
        {
            accessorKey: 'is_active',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
            meta: { title: 'Estado' },
            size: 120,
            cell: (info) => <StatusBadge isActive={info.getValue<boolean>() ?? true} />,
        },

        // Actions
        {
            id: 'actions',
            header: '',
            size: 80,
            enableHiding: false,
            cell: (info) => {
                const brand = info.row.original;
                const isActive = brand.is_active ?? true;
                return (
                    <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100" onClick={(e) => e.stopPropagation()}>
                        <Show when={handlers.canEdit && isActive}>
                            <LinkButton variant="ghost" size="icon_md" to={`/brands/${brand.id}/edit`} preload="intent" icon={<EditIcon class="size-4"/>} />
                        </Show>
                        <Show when={handlers.canDelete && isActive}>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon_md"
                                class="hover:text-danger hover:bg-danger/10"
                                onClick={() => handlers.onDelete(brand)}
                                icon={<TrashIcon class="size-4" />}
                            />
                        </Show>
                        <Show when={handlers.canDelete && !isActive}>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon_md"
                                class="hover:text-success hover:bg-success/10"
                                onClick={() => handlers.onRestore(brand)}
                                icon={<RotateCcwIcon class="size-4" />}
                            />
                        </Show>
                    </div>
                );
            },
        },
    ];
}
