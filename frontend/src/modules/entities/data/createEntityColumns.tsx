import { Show } from 'solid-js';
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
        [key: string]: ColumnFilterConfig | undefined;
    };
}

export function createBaseEntityColumns<T extends { id: number; is_active: boolean }>(
    handlers: BaseEntityHandlers<T>
): {
    select: ColumnDef<T>;
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
                    isFilterLoading={handlers.filters?.isActive?.isLoading()}
                />
            ),
            meta: { title: 'Estado' },
            size: 110,
            cell: (info) => <StatusBadge isActive={info.getValue<boolean>()} />,
        },
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
