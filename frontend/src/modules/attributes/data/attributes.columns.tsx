/**
 * Attribute Column Definitions — DataTable columns for the Attributes module.
 *
 * - Label cell uses Link with preload="intent" for 0ms show panel opening
 * - Inline action buttons (edit, deactivate, restore)
 * - Type badge with per-type colors
 * - Options inline preview (max 4 badges)
 * - RBAC-aware action visibility
 */
import { Show, For } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import type { ColumnDef } from '@tanstack/solid-table';
import type { AttributeItem } from './attributes.api';
import type { AttributeDataType } from '@app/schema/frontend';
import { ATTRIBUTE_TYPE_LABELS } from './attributes.constants';
import type { ColumnFilterConfig } from '@shared/ui/DataTable';



import Checkbox from '@shared/ui/Checkbox';
import { StatusBadge, Badge } from '@shared/ui/Badge';
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import Button from '@shared/ui/Button';
import { EditIcon, TrashIcon, RotateCcwIcon } from '@shared/ui/icons';

const TYPE_COLORS: Record<AttributeDataType, string> = {
    TEXT: 'primary',
    NUMBER: 'info',
    SELECT: 'warning',
    BOOLEAN: 'accent',
};

export interface AttributeColumnHandlers {
    onEdit: (attr: AttributeItem) => void;
    onDelete: (attr: AttributeItem) => void;
    onRestore: (attr: AttributeItem) => void;
    canEdit: boolean;
    canDelete: boolean;
    filters?: {
        type?: ColumnFilterConfig;
        isActive?: ColumnFilterConfig;
    };
}

export function createAttributeColumns(handlers: AttributeColumnHandlers): ColumnDef<AttributeItem>[] {
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

        // Label — Link with prefetch opens ShowPanel on click
        {
            accessorKey: 'label',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Etiqueta" />,
            meta: { title: 'Etiqueta' },
            size: 200,
            cell: (info) => {
                const item = info.row.original;
                const isActive = item.is_active ?? true;
                return (
                    <Link
                        to={`/attributes/${item.id}/show`}
                        preload="intent"
                        class="flex flex-col min-w-0 cursor-pointer group/label"
                        onClick={(e: MouseEvent) => e.stopPropagation()}
                    >
                        <span
                            class="font-medium group-hover/label:underline underline-offset-2 transition-colors duration-150 truncate"
                            classList={{
                                'text-text group-hover/label:text-primary': isActive,
                                'text-muted line-through': !isActive,
                            }}
                        >
                            {item.label}
                        </span>
                        <span class="text-[11px] font-mono text-muted">{item.key}</span>
                    </Link>
                );
            },
        },

        // Type — badge + filter
        {
            accessorKey: 'type',
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Tipo"
                    filterOptions={handlers.filters?.type?.options()}
                    selectedFilters={handlers.filters?.type?.selected()}
                    onFilterChange={handlers.filters?.type?.onChange}
                    isFilterLoading={handlers.filters?.type?.isLoading()}
                />
            ),
            meta: { title: 'Tipo' },
            size: 120,
            cell: (info) => {
                const typeKey = info.getValue<string>() as AttributeDataType;
                const typeLabel = ATTRIBUTE_TYPE_LABELS[typeKey] ?? typeKey;
                const typeColor = TYPE_COLORS[typeKey] ?? 'outline';
                return (
                    <Badge variant={typeColor as any} class="text-[10px] px-1.5 py-0">
                        {typeLabel}
                    </Badge>
                );
            },
        },

        // Options — inline preview
        {
            id: 'options',
            header: 'Opciones',
            meta: { title: 'Opciones' },
            size: 200,
            enableSorting: false,
            cell: (info) => {
                const item = info.row.original;
                const options = (item.default_options ?? []) as string[];
                return (
                    <div class="flex flex-wrap gap-1 min-w-0">
                        <Show when={options.length > 0} fallback={<span class="text-xs text-muted">—</span>}>
                            <For each={options.slice(0, 4)}>
                                {(opt) => (
                                    <span class="text-[11px] bg-surface px-1.5 py-0.5 rounded border border-border text-muted truncate max-w-[80px]">
                                        {opt}
                                    </span>
                                )}
                            </For>
                            <Show when={options.length > 4}>
                                <span class="text-[11px] text-muted">+{options.length - 4}</span>
                            </Show>
                        </Show>
                    </div>
                );
            },
        },

        // Status — filter
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

        // Actions — inline buttons
        {
            id: 'actions',
            header: '',
            size: 80,
            enableHiding: false,
            cell: (info) => {
                const item = info.row.original;
                const isActive = item.is_active ?? true;
                return (
                    <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100" onClick={(e) => e.stopPropagation()}>
                        <Show when={handlers.canEdit && isActive}>
                            <Button
                                to={`/attributes/${item.id}/edit`}
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
