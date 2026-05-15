/**
 * UOM Column Definitions
 *
 * - Code cell uses Link with preload="intent" for 0ms edit sheet opening
 * - Inline action buttons instead of ActionMenu dropdown
 * - base_factor with visual conversion indicator
 * - Server-side filter support via DataTableColumnHeader props
 * - RBAC-aware action visibility
 */
import { Show } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import type { ColumnDef } from '@tanstack/solid-table';
import type { UomItem } from './uom.api';
import { UOM_GROUP_META, formatBaseFactor } from './uom.constants';
import type { UomGroup } from '@app/schema/enums';
import type { FilterOption } from '@shared/ui/DataTable/DataTableColumnFilter';

/** Filter configuration for a column — uses accessors for SolidJS reactivity */
export interface ColumnFilterConfig {
    options: () => FilterOption[];
    selected: () => string[];
    onChange: (selected: string[]) => void;
    isLoading: () => boolean;
}
import Checkbox from '@shared/ui/Checkbox';
import { StatusBadge } from '@shared/ui/Badge';
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import { Tooltip } from '@shared/ui/Tooltip';
import Button from '@shared/ui/Button';
import {
    LockIcon, EditIcon, TrashIcon, RotateCcwIcon,
} from '@shared/ui/icons';

export interface UomColumnHandlers {
    onEdit: (uom: UomItem) => void;
    onDelete: (uom: UomItem) => void;
    onRestore: (uom: UomItem) => void;
    canEdit: boolean;
    canDelete: boolean;
    filters?: {
        uomGroup?: ColumnFilterConfig;
        isActive?: ColumnFilterConfig;
    };
}

export function createUomColumns(handlers: UomColumnHandlers): ColumnDef<UomItem>[] {
    return [
        // Select
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

        // Code — Link with prefetch opens EditSheet on click
        {
            accessorKey: 'code',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
            meta: { title: 'Código' },
            size: 120,
            cell: (info) => {
                const item = info.row.original;
                const isActive = item.is_active ?? true;
                return (
                    <Link
                        to={`/uom/${item.id}/edit`}
                        preload="intent"
                        class="flex items-center gap-1.5 cursor-pointer group/code"
                        onClick={(e: MouseEvent) => e.stopPropagation()}
                    >
                        <span 
                            class="font-mono font-semibold group-hover/code:underline underline-offset-2 transition-colors duration-150"
                            classList={{
                                'text-primary group-hover/code:text-accent': isActive,
                                'text-muted': !isActive
                            }}
                        >
                            {info.getValue<string>()}
                        </span>
                        <Show when={item.is_system}>
                            <Tooltip content="Unidad del sistema">
                                <LockIcon class="size-3 text-muted/50 group-hover/code:text-muted transition-colors" />
                            </Tooltip>
                        </Show>
                    </Link>
                );
            },
        },

        // Name
        {
            accessorKey: 'name',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
            meta: { title: 'Nombre' },
            size: 200,
            cell: (info) => (
                <span
                    class="font-medium text-text"
                    classList={{ 'text-muted line-through': !(info.row.original.is_active ?? true) }}
                >
                    {info.getValue<string>()}
                </span>
            ),
        },

        // Group — server-side filter via DataTableColumnHeader
        {
            accessorKey: 'uom_group',
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Grupo"
                    filterOptions={handlers.filters?.uomGroup?.options()}
                    selectedFilters={handlers.filters?.uomGroup?.selected()}
                    onFilterChange={handlers.filters?.uomGroup?.onChange}
                    isFilterLoading={handlers.filters?.uomGroup?.isLoading()}
                />
            ),
            meta: { title: 'Grupo' },
            size: 140,
            cell: (info) => {
                const groupKey = info.getValue<string>() as UomGroup;
                const meta = UOM_GROUP_META[groupKey];
                if (!meta) return <span class="text-sm text-muted">{groupKey}</span>;
                const Icon = meta.icon;
                return (
                    <span class={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                        <Icon class="size-3" />
                        {meta.label}
                    </span>
                );
            },
        },

        // Base Factor — visual conversion indicator with improved UX
        {
            accessorKey: 'base_factor',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Factor Base" />
            ),
            meta: { title: 'Factor Base' },
            size: 140,
            cell: (info) => {
                const raw = info.getValue<string | null>();
                return (
                    <span class="font-mono text-sm text-text font-medium">
                        {formatBaseFactor(raw)}
                    </span>
                );
            },
        },

        // Status — server-side filter via DataTableColumnHeader
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
            cell: (info) => <StatusBadge isActive={info.getValue<boolean>() ?? true} />,
        },

        // Actions — inline buttons, hidden for system UOMs
        {
            id: 'actions',
            header: '',
            size: 80,
            enableHiding: false,
            cell: (info) => {
                const item = info.row.original;
                if (item.is_system) return null;
                const isActive = item.is_active ?? true;
                return (
                    <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100" onClick={(e) => e.stopPropagation()}>
                        <Show when={handlers.canEdit && isActive}>
                                <Button
                                    to={`/uom/${item.id}/edit`}
                                    preload="intent"
                                    variant="ghost"
                                    size="icon_md"
                                    icon={<EditIcon class="size-4" />}
                                />
                        </Show>
                        <Show when={handlers.canDelete && isActive}>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon_md"
                                    class="hover:text-danger hover:bg-danger/10"
                                    onClick={() => handlers.onDelete(item)}
                                    icon={<TrashIcon class="size-4" />}
                                />
                        </Show>
                        <Show when={handlers.canDelete && !isActive}>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon_md"
                                    class="hover:text-success hover:bg-success/10"
                                    onClick={() => handlers.onRestore(item)}
                                    icon={<RotateCcwIcon class="size-4" />}
                                />
                        </Show>
                    </div>
                );
            },
        },
    ];
}
