/**
 * Location Tree Columns — Depth-aware with expand/collapse chevrons + checkbox selection.
 * Mirrors CategoryColumns + UomColumns select pattern.
 */
import { Show } from 'solid-js';
import type { ColumnDef } from '@tanstack/solid-table';
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import { StatusBadge } from '@shared/ui/Badge';
import Checkbox  from '@shared/ui/Checkbox';
import ActionMenu from '@shared/ui/ActionMenu';
import { ChevronRightIcon, ChevronDownIcon, PlusIcon, MapPinIcon } from '@shared/ui/icons';
import { cn } from '@shared/lib/utils';
import type { LocationNode } from './locations.api';
import { LOCATION_TYPE_META } from './locations.constants';
import type { LocationType } from '@app/schema/enums';

interface LocationColumnHandlers {
    onEdit: (id: number) => void;
    onAddChild: (parentId: number) => void;
    onDelete: (id: number) => void;
    onRestore: (id: number) => void;
}

export function createLocationColumns(handlers: LocationColumnHandlers): ColumnDef<LocationNode>[] {
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

        // ── Name with tree indent + expand/collapse ──
        {
            id: 'name',
            accessorKey: 'name',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre" />
            ),
            meta: { title: 'Nombre' },
            size: 380,
            cell: ({ row }) => {
                const depth = row.depth;
                const hasChildren = row.getCanExpand();
                const isExpanded = () => row.getIsExpanded();
                const loc = row.original;
                const typeMeta = LOCATION_TYPE_META[loc.type as LocationType];

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

                        {/* Location icon — color by type */}
                        <MapPinIcon
                            class={cn(
                                'size-4 shrink-0 transition-colors',
                                loc.type === 'VIEW'
                                    ? 'text-purple-500'
                                    : hasChildren
                                        ? 'text-blue-500'
                                        : 'text-muted/50',
                            )}
                        />

                        {/* Name + type badge */}
                        <div class="flex flex-col min-w-0 gap-0.5">
                            <div class="flex items-center gap-1.5 min-w-0">
                                <span
                                    class={cn(
                                        'text-sm font-medium truncate',
                                        !loc.is_active && 'line-through text-muted',
                                    )}
                                    title={loc.name}
                                >
                                    {loc.name}
                                </span>

                                {/* Children count */}
                                <Show when={hasChildren && loc.subRows?.length}>
                                    <span class="text-[10px] font-mono text-muted bg-surface px-1 py-px rounded tabular-nums shrink-0">
                                        {loc.subRows?.length}
                                    </span>
                                </Show>

                                {/* Type indicator */}
                                <Show when={typeMeta}>
                                    <span class={`text-[9px] font-bold px-1.5 py-px rounded-sm uppercase tracking-wider shrink-0 ${typeMeta.color}`}>
                                        {typeMeta.label}
                                    </span>
                                </Show>
                            </div>

                            {/* Barcode as secondary text */}
                            <Show when={loc.barcode}>
                                <span class="text-[11px] text-muted/70 font-mono truncate leading-tight" title={loc.barcode!}>
                                    {loc.barcode}
                                </span>
                            </Show>
                        </div>
                    </div>
                );
            },
        },

        // ── Path ──
        {
            id: 'path',
            accessorKey: 'path',
            header: 'Ruta',
            size: 200,
            cell: ({ row }) => {
                const segments = row.original.path.split('.');
                return (
                    <span class="flex items-center gap-0.5 text-[11px] text-muted font-mono truncate">
                        {segments.map((seg, i) => (
                            <>
                                {i > 0 && <span class="text-border mx-0.5">›</span>}
                                <span class="text-text/60">{seg}</span>
                            </>
                        ))}
                    </span>
                );
            },
        },

        // ── Status ──
        {
            id: 'status',
            accessorKey: 'is_active',
            header: 'Estado',
            size: 90,
            cell: ({ row }) => <StatusBadge isActive={row.original.is_active ?? true} />,
        },

        // ── Actions ──
        {
            id: 'actions',
            header: '',
            size: 50,
            enableHiding: false,
            enableSorting: false,
            cell: ({ row }) => {
                const loc = row.original;
                return (
                    <ActionMenu
                        module="locations"
                        isActive={loc.is_active ?? true}
                        onDelete={() => handlers.onDelete(loc.id)}
                        onRestore={() => handlers.onRestore(loc.id)}
                    >
                        {/* Add child location */}
                        <Show when={loc.is_active ?? true}>
                            <button
                                type="button"
                                class="flex w-full items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-dropdown-hover transition-colors"
                                onClick={() => handlers.onAddChild(loc.id)}
                            >
                                <PlusIcon class="size-4 text-muted" />
                                <span>Agregar sub-ubicación</span>
                            </button>
                        </Show>
                    </ActionMenu>
                );
            },
        },
    ];
}
