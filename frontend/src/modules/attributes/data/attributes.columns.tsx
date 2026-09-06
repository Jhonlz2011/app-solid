import { Show, For } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import type { ColumnDef } from '@tanstack/solid-table';
import type { AttributeItem } from './attributes.api';
import type { AttributeDataType } from '@app/schema/enums';
import { ATTRIBUTE_TYPE_LABELS, ATTRIBUTE_TYPE_COLORS } from './attributes.constants';
import type { ColumnFilterConfig } from '@shared/ui/DataTable';
import Checkbox from '@form/Checkbox';
import { StatusBadge, Badge } from '@display/Badge';
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import { ActionButtons } from '@/shared/ui/overlay/ActionButtons';

export interface AttributeColumnHandlers {
    onEdit: (attr: AttributeItem) => void;
    onDelete: (attr: AttributeItem) => void;
    onRestore: (attr: AttributeItem) => void;
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
                const typeColor = ATTRIBUTE_TYPE_COLORS[typeKey] ?? 'outline';
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
                                    <span class="text-[11px] bg-surface px-1.5 py-0.5 rounded border border-border text-muted truncate max-w-20">
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

        // Actions
        {
            id: 'actions',
            header: '',
            size: 84,
            enableHiding: false,
            enableSorting: false,
            cell: (info) => {
                const item = info.row.original;
                return (
                    <ActionButtons
                        module="attributes"
                        isActive={item.is_active ?? true}
                        editTo={`/attributes/${item.id}/edit`}
                        onDelete={() => handlers.onDelete(item)}
                        onRestore={() => handlers.onRestore(item)}
                    />
                );
            },
        },
    ];
}
