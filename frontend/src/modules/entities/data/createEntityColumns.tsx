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
    auth: { canDelete: (key: string) => boolean; canEdit: (key: string) => boolean };
    permissionKey: string;
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
            cell: (info) => {
                const isActive = info.getValue<boolean>();
                return (
                    <StatusBadge
                        status={isActive ? 'active' : 'inactive'}
                        label={isActive ? 'Activo' : 'Inactivo'}
                    />
                );
            },
        },
        actions: {
            id: 'actions',
            size: 50,
            enableHiding: false,
            cell: ({ row }) => {
                const entity = row.original;
                const pKey = handlers.permissionKey;
                return (
                    <ActionMenu
                        items={[
                            {
                                label: entity.is_active ? 'Eliminar' : 'Restaurar',
                                icon: entity.is_active ? 'trash' : 'rotate-ccw',
                                onClick: () => entity.is_active ? handlers.onDelete(entity) : handlers.onRestore(entity),
                                destructive: entity.is_active,
                                show: entity.is_active ? handlers.auth.canDelete(pKey) : handlers.auth.canEdit(pKey),
                            }
                        ]}
                    />
                );
            },
        },
    };
}
