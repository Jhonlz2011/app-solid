import { Show } from 'solid-js';
import { ColumnDef } from '@tanstack/solid-table';
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import { Badge, StatusBadge } from '@shared/ui/Badge';
import ActionMenu from '@shared/ui/ActionMenu';
import { ChevronRightIcon, ChevronDownIcon, PlusIcon, FolderIcon } from '@shared/ui/icons';
import { cn } from '@shared/lib/utils';
import type { CategoryNode } from '../data/categories.api';

interface CategoryColumnHandlers {
    onEdit: (id: number) => void;
    onAddChild: (parentId: number) => void;
    onDelete: (id: number) => void;
    onRestore: (id: number) => void;
}

export function createCategoryColumns(handlers: CategoryColumnHandlers): ColumnDef<CategoryNode>[] {
    return [
        // ── Name + Description col with expand toggle ──
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
                        class="flex items-center gap-2 min-w-0"
                        style={{ 'padding-left': `${depth * 20}px` }}
                    >
                        {/* Expand/Collapse chevron */}
                        <Show
                            when={hasChildren}
                            fallback={
                                <span class="size-6 shrink-0 flex items-center justify-center">
                                    <span class="size-1.5 rounded-full bg-border/60" />
                                </span>
                            }
                        >
                            <button
                                type="button"
                                class={cn(
                                    'size-6 shrink-0 flex items-center justify-center rounded-md',
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
                                    fallback={<ChevronRightIcon class="size-3.5" />}
                                >
                                    <ChevronDownIcon class="size-3.5" />
                                </Show>
                            </button>
                        </Show>

                        {/* Folder icon */}
                        <FolderIcon
                            class={cn(
                                'size-4 shrink-0 transition-colors',
                                hasChildren
                                    ? isExpanded()
                                        ? 'text-amber-500'
                                        : 'text-amber-400/70'
                                    : 'text-muted/50',
                            )}
                        />

                        {/* Name + Description + inline badges */}
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
                                <Show when={hasChildren && (cat as any).subRows?.length}>
                                    <span class="text-[10px] font-mono text-muted bg-surface px-1 py-px rounded tabular-nums shrink-0">
                                        {(cat as any).subRows?.length}
                                    </span>
                                </Show>

                                {/* Template indicator */}
                                <Show when={cat.name_template}>
                                    <span class="text-[9px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-px rounded-sm uppercase tracking-wider shrink-0" title={`Template: ${cat.name_template}`}>
                                        TPL
                                    </span>
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
            size: 100,
            enableSorting: false,
            cell: ({ row }) => (
                <Show
                    when={row.original.attributeCount > 0}
                    fallback={<span class="text-xs text-muted">—</span>}
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
            header: 'Estado',
            size: 90,
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
                        module="catalogs"
                        isActive={cat.is_active}
                        onDelete={() => handlers.onDelete(cat.id)}
                        onRestore={() => handlers.onRestore(cat.id)}
                    >
                        {/* Add child action */}
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
