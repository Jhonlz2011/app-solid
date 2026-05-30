/**
 * Category Tree Columns — Full-featured with select, filters, and pinning support.
 *
 * Design decisions:
 * - Select column pinned left for batch operations
 * - Actions column pinned right for consistent access
 * - Status filter via DataTableColumnHeader
 * - Badge component for attribute counts
 */
import { Show } from 'solid-js';
import type { ColumnDef } from '@tanstack/solid-table';
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import type { FilterOption } from '@shared/ui/DataTable/DataTableColumnFilter';
import { Badge, StatusBadge, CounterBadge } from '@shared/ui/Badge';
import Checkbox from '@shared/ui/Checkbox';
import ActionMenu from '@shared/ui/ActionMenu';
import { ChevronRightIcon, ChevronDownIcon, PlusIcon, FolderIcon, FolderOpenIcon } from '@shared/ui/icons';
import { cn } from '@shared/lib/utils';
import type { CategoryNode } from './categories.api';

export interface ColumnFilterConfig {
    options: () => FilterOption[];
    selected: () => string[];
    onChange: (selected: string[]) => void;
    isLoading: () => boolean;
}

export interface CategoryColumnHandlers {
    onEdit: (id: number) => void;
    onAddChild: (parentId: number) => void;
    onDelete: (id: number) => void;
    onRestore: (id: number) => void;
    filters?: {
        status?: ColumnFilterConfig;
    };
}

export function createCategoryColumns(handlers: CategoryColumnHandlers): ColumnDef<CategoryNode>[] {
    return [
        // ── Select Checkbox ──
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

        // ── Name + Description + expand toggle + badges ──
        {
            id: 'name',
            accessorKey: 'name',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre" />
            ),
            meta: { title: 'Nombre' },
            size: 420,
            cell: ({ row }) => {
                const depth = row.depth;
                const hasChildren = row.getCanExpand();
                const isExpanded = () => row.getIsExpanded();
                const cat = row.original;

                return (
                    <div
                        class="flex items-center gap-2 min-w-0 w-full h-full cursor-pointer select-none group/name"
                        style={{ 'padding-left': `${depth * 1.5}rem` }}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (hasChildren) {
                                row.toggleExpanded();
                            } else {
                                handlers.onEdit(cat.id);
                            }
                        }}
                    >
                        {/* Expand/Collapse chevron */}
                        <Show
                            when={hasChildren}
                            fallback={
                                <span class="size-5 shrink-0 flex items-center justify-center">
                                    <span class="size-1.5 rounded-full bg-muted/40 dark:bg-muted/30 group-hover/name:bg-amber-500 transition-transform duration-200 group-hover/name:scale-125" />
                                </span>
                            }
                        >
                            <button
                                type="button"
                                class={cn(
                                    'size-5 shrink-0 flex items-center justify-center rounded-md cursor-pointer',
                                    'hover:bg-surface transition-colors text-muted hover:text-text',
                                )}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    row.toggleExpanded();
                                }}
                                title={isExpanded() ? 'Colapsar' : 'Expandir'}
                            >
                                <Show
                                    when={isExpanded()}
                                    fallback={<ChevronRightIcon stroke-width="3" class="size-3.5" />}
                                >
                                    <ChevronDownIcon stroke-width="3" class="size-3.5" />
                                </Show>
                            </button>
                        </Show>

                        {/* Folder icon — Rendered only for parent nodes (with children) */}
                        <Show when={hasChildren}>
                            <Show
                                when={isExpanded()}
                                fallback={
                                    <FolderIcon
                                        class={cn(
                                            'size-4.5 shrink-0 group-hover/name:scale-110',
                                            'text-amber-500/80 group-hover/name:text-amber-500'
                                        )}
                                    />
                                }
                            >
                                <FolderOpenIcon
                                    class={cn(
                                        'size-4.5 shrink-0 text-amber-500 ',
                                        'group-hover/name:scale-110'
                                    )}
                                />
                            </Show>
                        </Show>

                        {/* Name + description + inline badges */}
                        <div class="flex flex-col min-w-0 gap-0.5">
                            <div class="flex items-center gap-1.5 min-w-0">
                                <span
                                    class={cn(
                                        'text-sm font-medium truncate',
                                        !cat.is_active && 'line-through text-muted',
                                    )}
                                    title={cat.name}
                                >
                                    {cat.name}
                                </span>

                                {/* Child count badge */}
                                <Show when={hasChildren && cat.subRows?.length}>
                                    <CounterBadge
                                        count={cat.subRows?.length}
                                        variant="default"
                                        class="text-[10px] font-mono tabular-nums shrink-0 transition-colors group-hover/name:bg-surface/80"
                                    />
                                </Show>

                                {/* Template indicator */}
                                <Show when={cat.name_template}>
                                    <Badge
                                        variant="orange"
                                        class="text-[9px] font-bold uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded-md"
                                        title={`Plantilla: ${cat.name_template}`}
                                    >
                                        PLT
                                    </Badge>
                                </Show>
                            </div>

                            {/* Description as secondary text */}
                            <Show when={cat.description}>
                                <span class="text-[11px] text-muted/70 truncate leading-tight" title={cat.description!}>
                                    {cat.description}
                                </span>
                            </Show>
                        </div>
                    </div>
                );
            },
        },

        // ── Attribute count ──
        {
            id: 'attributes',
            header: 'Atributos',
            meta: { title: 'Atributos' },
            size: 100,
            enableSorting: false,
            cell: ({ row }) => (
                <Show
                    when={row.original.attributeCount > 0}
                    fallback={<span class="text-xs text-muted/40 italic">—</span>}
                >
                    <Badge
                        variant="primary"
                        class="text-[10px] px-1.5 py-0 font-mono tabular-nums"
                    >
                        {row.original.attributeCount} attr
                    </Badge>
                </Show>
            ),
        },

        // ── Status ──
        {
            id: 'status',
            accessorKey: 'is_active',
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Estado"
                    filterOptions={handlers.filters?.status?.options()}
                    selectedFilters={handlers.filters?.status?.selected()}
                    onFilterChange={handlers.filters?.status?.onChange}
                    isFilterLoading={handlers.filters?.status?.isLoading()}
                />
            ),
            meta: { title: 'Estado' },
            size: 118,
            cell: ({ row }) => <StatusBadge isActive={row.original.is_active} />,
        },

        // ── Actions ──
        {
            id: 'actions',
            header: '',
            size: 50,
            enableHiding: false,
            enableSorting: false,
            cell: ({ row }) => {
                const cat = row.original;
                return (
                    <ActionMenu
                        module="categories"
                        isActive={cat.is_active}
                        showTo={`/categories/${cat.id}/show`}
                        editTo={`/categories/${cat.id}/edit`}
                        onDelete={() => handlers.onDelete(cat.id)}
                        onRestore={() => handlers.onRestore(cat.id)}
                    >
                        {/* Add subcategory */}
                        <Show when={cat.is_active}>
                            <button
                                type="button"
                                class="flex w-full items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-dropdown-hover transition-colors"
                                onClick={() => handlers.onAddChild(cat.id)}
                            >
                                <PlusIcon class="size-4 text-muted" />
                                <span>Agregar subcategoría</span>
                            </button>
                        </Show>
                    </ActionMenu>
                );
            },
        },
    ];
}
