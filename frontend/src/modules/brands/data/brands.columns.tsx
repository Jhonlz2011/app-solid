/**
 * Brand Column Definitions
 */
import type { ColumnDef } from '@tanstack/solid-table';
import type { BrandItem } from '@app/schema/dto';
import Checkbox from '@form/Checkbox';
import { StatusBadge } from '@display/Badge';
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import { ActionButtons } from '@/shared/ui/overlay/ActionButtons';

export interface BrandColumnHandlers {
    onDelete: (brand: BrandItem) => void;
    onRestore: (brand: BrandItem) => void;
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
            size: 84,
            enableHiding: false,
            enableSorting: false,
            cell: (info) => {
                const brand = info.row.original;
                return (
                    <ActionButtons
                        module="brands"
                        isActive={brand.is_active ?? true}
                        editTo={`/brands/${brand.id}/edit`}
                        onDelete={() => handlers.onDelete(brand)}
                        onRestore={() => handlers.onRestore(brand)}
                    />
                );
            },
        },
    ];
}
