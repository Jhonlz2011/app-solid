/**
 * LocationTable — Tree DataTable with DnD reparenting + row selection.
 *
 * Uses shared `useTreeDnD` hook for all DnD logic (auto-scroll, hierarchy validation,
 * expand-on-hover, cursor management). Module-specific: column definitions, overlay rendering,
 * row styling, custom collision detector, and the reparent mutation.
 */
import {
    createSignal,
    createMemo,
    createEffect,
    For,
    Show,
    Component,
    onCleanup,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import {
    DragDropProvider,
    DragDropSensors,
    DragOverlay,
    createDraggable,
    createDroppable,
    mostIntersecting,
    useDragDropContext,
    type CollisionDetector,
} from '@thisbeyond/solid-dnd';
import {
    createSolidTable,
    flexRender,
    getCoreRowModel,
    getExpandedRowModel,
    getSortedRowModel,
    type Row,
    type RowSelectionState,
    type ColumnPinningState,
    type SortingState,
} from '@tanstack/solid-table';
import { toast } from 'solid-sonner';
import {
    Table as TableRoot,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@shared/ui/table';
import { Skeleton } from '@shared/ui/Skeleton';
import { EmptyState } from '@shared/ui/EmptyState';
import { MapPinIcon, GripVerticalIcon, InboxIcon, EyeIcon } from '@shared/ui/icons';
import { cn } from '@shared/lib/utils';
import { useTreeDnD, buildSubRows, isDescendantOf } from '@shared/hooks/useTreeDnD';
import { getHeaderPinningStyles, getCellPinningStyles } from '@shared/utils/column-pinning';
import type { LocationItem, LocationNode } from '../data/locations.api';
import { LOCATION_TYPE_META } from '../data/locations.constants';
import type { LocationType } from '@app/schema/enums';
import { useReparentLocation } from '../data/locations.mutations';
import { createLocationColumns, type ColumnFilterConfig } from '../data/locations.columns';

// ─── Props ───────────────────────────────────────────────────────────────────

interface LocationTableProps {
    /** Pre-filtered flat list from useLocationState */
    data: LocationItem[];
    /** Full unfiltered list for hierarchy validation during DnD */
    rawData: LocationItem[];
    isLoading: boolean;
    totalCount: number;
    onEdit: (id: number) => void;
    onAddChild: (parentId: number) => void;
    onDelete: (item: LocationItem) => void;
    onRestore: (item: LocationItem) => void;
    // Row selection (controlled by parent)
    rowSelection: RowSelectionState;
    onRowSelectionChange: (updater: RowSelectionState | ((prev: RowSelectionState) => RowSelectionState)) => void;
    filters?: {
        warehouse?: ColumnFilterConfig;
        type?: ColumnFilterConfig;
        status?: ColumnFilterConfig;
    };
    tableRef?: (table: any) => void;
}

// ─── Root Dropzone (Absolute Floating Overlay) ───────────────────────────────

const RootDropzone: Component<{ active: boolean }> = (props) => {
    const rootDroppable = createDroppable('root-dropzone');

    return (
        <div
            ref={rootDroppable.ref}
            class={cn(
                "absolute top-0 left-1/2 -translate-x-1/2 z-50 w-full h-12 transition-all duration-300",
                props.active 
                    ? "opacity-100 visible pointer-events-auto" 
                    : "opacity-0 invisible pointer-events-none"
            )}
        >
            <div
                class={cn(
                    "w-full h-full rounded-t-2xl flex items-center justify-center gap-3.5 px-4 transition-all duration-300 ease-out transform pointer-events-auto relative",
                    "backdrop-blur-xl border-b",
                    props.active
                        ? "translate-y-0 opacity-100"
                        : "-translate-y-2 opacity-0",
                    rootDroppable.isActiveDroppable
                        ? "bg-linear-to-r from-primary/8 via-primary/[0.14] to-primary/8 border-primary text-primary shadow-[inset_0_-12px_32px_rgba(99,102,241,0.08),0_4px_24px_rgba(99,102,241,0.12)]"
                        : "bg-surface/90 border-primary/15 text-muted-foreground hover:border-primary/35 animate-dropzone-pulse"
                )}
            >
                <div class="flex items-center gap-2.5 min-w-0 max-w-full justify-center">
                    <span class={cn(
                        "px-2 py-0.5 rounded-md text-[9px] font-extrabold tracking-wider uppercase shrink-0 transition-all duration-300",
                        rootDroppable.isActiveDroppable
                            ? "bg-primary/20 border border-primary/40 text-primary shadow-sm"
                            : "bg-primary/10 border border-primary/20 text-primary"
                    )}>
                        Raíz
                    </span>
                    <span class={cn(
                        "text-xs font-semibold truncate transition-colors duration-200 tracking-wide",
                        rootDroppable.isActiveDroppable 
                            ? "text-primary font-bold drop-shadow-[0_0_8px_rgba(99,102,241,0.2)]" 
                            : "text-foreground/90"
                    )}>
                        {rootDroppable.isActiveDroppable
                            ? "¡Suelta para reubicar al nivel principal!"
                            : "Arrastra hasta aquí para establecer como ubicación de primer nivel"}
                    </span>
                </div>
            </div>
        </div>
    );
};

// ─── DnD Active Scroll Handler Helper ────────────────────────────────────────

const DndScrollHandler: Component<{
    scrollContainer: () => HTMLDivElement | undefined;
    active: () => boolean;
}> = (props) => {
    const dndContext = useDragDropContext();
    
    createEffect(() => {
        const container = props.scrollContainer();
        const isActive = props.active();
        if (container && isActive && dndContext) {
            const [, actions] = dndContext;
            let ticking = false;
            
            const handleScroll = () => {
                if (!ticking) {
                    window.requestAnimationFrame(() => {
                        actions.recomputeLayouts();
                        ticking = false;
                    });
                    ticking = true;
                }
            };
            
            container.addEventListener('scroll', handleScroll, { passive: true });
            onCleanup(() => container.removeEventListener('scroll', handleScroll));
        }
    });
    
    return null;
};

// ─── LocationTable Component ──────────────────────────────────────────────────

const LocationTable: Component<LocationTableProps> = (props) => {
    const reparent = useReparentLocation();
    let scrollContainerRef: HTMLDivElement | undefined;

    // ── Shared DnD hook ──
    const dnd = useTreeDnD<LocationItem>({
        rawData: () => props.rawData,
        tableRef: () => table,
        onReparent: (sourceId, targetParentId) => {
            reparent.mutate(
                { id: sourceId, parentId: targetParentId },
                {
                    onSuccess: () => toast.success(targetParentId === null ? 'Ubicación movida a la raíz' : 'Ubicación reubicada correctamente'),
                    onError: (e: Error) => toast.error(e?.message ?? 'Error al reubicar'),
                },
            );
        },
        circularErrorMessage: 'Acción inválida: No puedes mover una ubicación dentro de sus descendientes.',
    });

    // Track pointer coordinates for custom collision detection
    let currentPointerX = 0;
    let currentPointerY = 0;

    createEffect(() => {
        if (dnd.activeItem() !== null) {
            const handlePointerMove = (e: PointerEvent) => {
                currentPointerX = e.clientX;
                currentPointerY = e.clientY;
            };
            const handleTouchMove = (e: TouchEvent) => {
                if (e.touches.length > 0) {
                    currentPointerX = e.touches[0].clientX;
                    currentPointerY = e.touches[0].clientY;
                }
            };
            
            window.addEventListener('pointermove', handlePointerMove, { passive: true });
            window.addEventListener('touchmove', handleTouchMove, { passive: true });
            onCleanup(() => {
                window.removeEventListener('pointermove', handlePointerMove);
                window.removeEventListener('touchmove', handleTouchMove);
                currentPointerX = 0;
                currentPointerY = 0;
            });
        }
    });

    // Custom collision detector prioritizing root dropzone
    const customCollisionDetector: CollisionDetector = (draggable, droppables, context) => {
        const rootDropzone = droppables.find((d) => d.id === 'root-dropzone');
        
        if (rootDropzone && rootDropzone.layout) {
            const rootLayout = rootDropzone.layout;
            const currentY = currentPointerY > 0 ? currentPointerY : (draggable.transformed?.center.y ?? 0);
            const currentX = currentPointerX > 0 ? currentPointerX : (draggable.transformed?.center.x ?? 0);
            
            const isOverRootDropzone = currentY >= rootLayout.top - 15 && currentY <= rootLayout.bottom + 25;
            
            if (isOverRootDropzone) {
                const isWithinX = currentX >= rootLayout.left - 10 && currentX <= rootLayout.right + 10;
                if (isWithinX) {
                    return rootDropzone;
                }
            }
        }
        
        return mostIntersecting(draggable, droppables, context);
    };

    const handleDelete = (id: number) => {
        const item = props.rawData.find(l => l.id === id);
        if (item) props.onDelete(item);
    };

    const handleRestore = (id: number) => {
        const item = props.rawData.find(l => l.id === id);
        if (item) props.onRestore(item);
    };

    const columns = createLocationColumns({
        onEdit: props.onEdit,
        onAddChild: props.onAddChild,
        onDelete: handleDelete,
        onRestore: handleRestore,
        filters: props.filters,
    });

    const hierarchicalData = createMemo(() => buildSubRows(props.data));

    const [columnPinning, setColumnPinning] = createSignal<ColumnPinningState>({
        left: ['select'],
        right: ['actions'],
    });

    const [sorting, setSorting] = createSignal<SortingState>([]);

    const table = createSolidTable({
        get data() { return hierarchicalData(); },
        columns,
        state: {
            get expanded() { return dnd.expanded(); },
            get rowSelection() { return props.rowSelection; },
            get columnPinning() { return columnPinning(); },
            get sorting() { return sorting(); },
        },
        onExpandedChange: (updater) =>
            dnd.setExpanded(typeof updater === 'function' ? updater(dnd.expanded()) : updater),
        enableRowSelection: true,
        onRowSelectionChange: (updater) => {
            const newVal = typeof updater === 'function' ? updater(props.rowSelection) : updater;
            props.onRowSelectionChange(newVal);
        },
        onSortingChange: setSorting,
        onColumnPinningChange: setColumnPinning,
        enableColumnPinning: true,
        getCoreRowModel: getCoreRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getSubRows: (row) => (row as LocationNode).subRows,
        getRowId: (row) => String(row.id),
        autoResetExpanded: false,
    });

    createEffect(() => {
        if (props.tableRef) props.tableRef(table);
    });

    const rows = createMemo(() => table.getRowModel().rows);

    // Active item data for overlay
    const activeLocData = createMemo(() => {
        const id = dnd.activeItem();
        if (id === null) return null;
        return props.rawData.find(l => l.id === id) ?? null;
    });

    return (
        <DragDropProvider
            onDragStart={dnd.handleDragStart}
            onDragOver={dnd.handleDragOver}
            onDragEnd={dnd.handleDragEnd}
            collisionDetector={customCollisionDetector}
        >
            <DragDropSensors />
            <DndScrollHandler
                scrollContainer={() => scrollContainerRef}
                active={() => dnd.activeItem() !== null}
            />
        <div class="relative w-full h-full flex flex-col">
            {/* Table Card */}
            <div class="bg-card border border-border rounded-2xl shadow-card-soft overflow-hidden flex flex-col flex-1 min-h-0 w-full relative">
                <div class="flex-1 overflow-auto" ref={(el) => { scrollContainerRef = el; dnd.setScrollContainerRef(el); }}>
                    <TableRoot>
                        <TableHeader class="sticky top-0 z-20 bg-card">
                            <For each={table.getHeaderGroups()}>
                                {(headerGroup) => (
                                    <TableRow>
                                        <For each={headerGroup.headers}>
                                            {(header) => {
                                                const { className: pinClasses, style: pinStyles } = getHeaderPinningStyles(header.column);
                                                return (
                                                    <TableHead
                                                        class={cn(
                                                            "text-xs tracking-wider text-muted font-semibold",
                                                            pinClasses
                                                        )}
                                                        style={pinStyles}
                                                    >
                                                        <Show when={!header.isPlaceholder}>
                                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                                        </Show>
                                                    </TableHead>
                                                );
                                            }}
                                        </For>
                                    </TableRow>
                                )}
                            </For>
                        </TableHeader>

                        <TableBody>
                            <Show
                                when={!props.isLoading}
                                fallback={
                                    <For each={Array(6).fill(0)}>
                                        {() => (
                                            <TableRow class="hover:bg-transparent">
                                                <For each={table.getVisibleLeafColumns()}>
                                                    {(col) => {
                                                        const { className: pinClasses, style: pinStyles } = getCellPinningStyles(col);
                                                        return (
                                                            <TableCell
                                                                class={cn(
                                                                    col.getIsPinned() && cn(pinClasses, 'bg-card')
                                                                )}
                                                                style={pinStyles}
                                                            >
                                                                <Skeleton class="h-5 w-full rounded-md" />
                                                            </TableCell>
                                                        );
                                                    }}
                                                </For>
                                            </TableRow>
                                        )}
                                    </For>
                                }
                            >
                                <Show
                                    when={rows().length > 0}
                                    fallback={
                                        <TableRow>
                                            <TableCell colSpan={table.getVisibleLeafColumns().length} class="h-48">
                                                <EmptyState
                                                    icon={<MapPinIcon class="size-8" />}
                                                    message="No hay ubicaciones"
                                                    description="Crea una nueva ubicación o ajusta los filtros"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    }
                                >
                                    <For each={rows()}>
                                        {(row) => <LocationRow row={row} onEdit={props.onEdit} isDragging={dnd.activeItem() !== null} />}
                                    </For>
                                </Show>
                            </Show>
                        </TableBody>
                    </TableRoot>
                </div>

                {/* Root Dropzone — absolute floating overlay inside card */}
                <RootDropzone active={dnd.activeItem() !== null} />
            </div>
        </div>

        {/* Drag Overlay — Premium glassmorphism card */}
        <Portal>
            <div class="fixed inset-0 pointer-events-none" style={{ "z-index": 2147483647 }}>
                <DragOverlay style={{ "z-index": 2147483647 }}>
                    <Show when={activeLocData()}>
                        {(loc) => {
                            const typeMeta = LOCATION_TYPE_META[loc().type as LocationType];
                            const isView = loc().type === 'VIEW';
                            const childCount = props.data.filter(l => l.parent_id === loc().id).length;

                            return (
                                <div class={cn(
                                    "cursor-grabbing flex items-center gap-3 px-4 py-2 rounded-xl pointer-events-none",
                                    "min-w-65 max-w-95",
                                    "bg-card/95 backdrop-blur-xl",
                                    "border border-primary/30",
                                    "shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25),0_0_15px_-3px_var(--color-primary-500,rgba(99,102,241,0.2))]",
                                    "ring-1 ring-black/3",
                                    "animate-in zoom-in-95 duration-150"
                                )}>
                                    <div class="p-1 bg-surface/80 rounded-md shrink-0">
                                        <GripVerticalIcon class="size-4 text-primary" />
                                    </div>
                                    <Show when={isView}
                                        fallback={<InboxIcon class="size-4.5 text-blue-500 shrink-0" />}
                                    >
                                        <EyeIcon class="size-4.5 text-purple-500 shrink-0" />
                                    </Show>
                                    <div class="flex flex-col min-w-0 gap-0.5">
                                        <span class="text-[13px] font-semibold text-text truncate leading-tight">
                                            {loc().name}
                                        </span>
                                        <div class="flex items-center gap-1.5">
                                            <span class={cn(
                                                "text-[9px] font-bold uppercase tracking-widest px-1.5 py-px rounded-sm border leading-tight",
                                                isView
                                                    ? "bg-purple-500/8 border-purple-500/15 text-purple-500"
                                                    : "bg-blue-500/8 border-blue-500/15 text-blue-500"
                                            )}>
                                                {typeMeta?.label ?? loc().type}
                                            </span>
                                            <Show when={childCount > 0}>
                                                <span class="text-[10px] text-muted-foreground font-mono tabular-nums">
                                                    {childCount} {childCount === 1 ? 'subgrupo' : 'subgrupos'}
                                                </span>
                                            </Show>
                                        </div>
                                    </div>
                                </div>
                            );
                        }}
                    </Show>
                </DragOverlay>
            </div>
        </Portal>
    </DragDropProvider>
    );
};

// ─── LocationRow ─────────────────────────────────────────────────────────────

interface LocationRowProps {
    row: Row<LocationNode>;
    onEdit: (id: number) => void;
    isDragging: boolean;
}

const LocationRow: Component<LocationRowProps> = (props) => {
    const depth = () => props.row.depth;
    const isSelected = () => props.row.getIsSelected();

    const uniqueId = `${props.row.original.id}-${Math.random().toString(36).substring(2, 9)}`;
    const draggable = createDraggable(uniqueId, props.row.original);
    const droppable = createDroppable(uniqueId, props.row.original);

    return (
        <TableRow
            ref={(el) => { draggable.ref(el); droppable.ref(el); }}
            class={cn(
                'group relative',
                isSelected()
                    ? 'row-selected bg-row-selected hover:bg-row-selected-hover'
                    : 'hover:bg-table-hover',
                depth() === 1 && !isSelected() && 'depth-1 bg-surface/10',
                depth() >= 2 && !isSelected() && 'depth-2 bg-surface/30',
                droppable.isActiveDroppable && 'dnd-row-droppable-active ring-1 ring-primary/30 ring-inset',
                draggable.isActiveDraggable && 'dnd-row-draggable-active',
            )}
            onClick={() => props.onEdit(props.row.original.id)}
        >
            <For each={props.row.getVisibleCells()}>
                {(cell) => {
                    const { className: pinClasses, style: pinStyles } = getCellPinningStyles(cell.column);
                    const isPinned = () => cell.column.getIsPinned();

                    return (
                        <TableCell
                            class={cn(
                                'bg-transparent',
                                (cell.column.id === 'actions' || cell.column.id === 'select' || cell.column.id === 'name') && 'cursor-default',
                                isPinned() && cn(
                                    pinClasses,
                                    !props.isDragging ? cn(
                                        'bg-card',
                                        'group-[.row-selected]:bg-row-selected',
                                        'group-[.row-selected]:group-hover:bg-row-selected-hover',
                                        'group-[&:not(.row-selected)]:group-hover:bg-table-hover',
                                        depth() === 1 && 'group-[&:not(.row-selected)]:bg-[color-mix(in_srgb,var(--color-surface)_10%,var(--color-card))]',
                                        depth() >= 2 && 'group-[&:not(.row-selected)]:bg-[color-mix(in_srgb,var(--color-surface)_30%,var(--color-card))]'
                                    ) : 'bg-transparent'
                                )
                            )}
                            style={pinStyles}
                            onClick={(e) => {
                                if (cell.column.id === 'actions' || cell.column.id === 'select' || cell.column.id === 'name') e.stopPropagation();
                            }}
                        >
                            <Show
                                when={cell.column.id === 'name'}
                                fallback={flexRender(cell.column.columnDef.cell, cell.getContext())}
                            >
                                <div class="flex items-center min-w-0 h-full group/handle">
                                    <button
                                        type="button"
                                        class={cn(
                                            "touch-none p-2 -ml-1 mr-1 rounded-md transition-colors",
                                            "cursor-grab active:cursor-grabbing",
                                            "text-muted/30 group-hover/handle:text-primary hover:bg-surface/50"
                                        )}
                                        {...draggable.dragActivators}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <GripVerticalIcon class="size-4" />
                                    </button>
                                    <div class="flex-1 min-w-0">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </div>
                                </div>
                            </Show>
                        </TableCell>
                    );
                }}
            </For>
        </TableRow>
    );
};

export default LocationTable;
