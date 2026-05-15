/**
 * LocationTable — Tree DataTable with DnD reparenting + row selection.
 *
 * Features:
 * - Expand/collapse per node via getExpandedRowModel + getSubRows
 * - DnD reparenting with anti-circular validation (@thisbeyond/solid-dnd)
 * - Auto-scroll during drag near container edges
 * - Auto-expand folders on hover during drag (700ms)
 * - Root dropzone to move to top level
 * - Checkbox row selection for batch actions
 * - Receives pre-filtered flat list (filtering done by useLocationState)
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
    type DragEvent,
} from '@thisbeyond/solid-dnd';
import {
    createSolidTable,
    flexRender,
    getCoreRowModel,
    getExpandedRowModel,
    type Row,
    type ExpandedState,
    type RowSelectionState,
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
import Button from '@shared/ui/Button';
import { MapPinIcon, GripVerticalIcon, Expand, Collapse } from '@shared/ui/icons';
import { cn } from '@shared/lib/utils';
import type { LocationItem, LocationNode } from '../data/locations.api';
import {
    useDeactivateLocation,
    useRestoreLocation,
    useReparentLocation,
} from '../data/locations.mutations';
import { createLocationColumns } from '../data/locations.columns';

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
    // Row selection (controlled by parent)
    rowSelection: RowSelectionState;
    onRowSelectionChange: (updater: RowSelectionState | ((prev: RowSelectionState) => RowSelectionState)) => void;
}

// ─── Root Dropzone Toolbar ───────────────────────────────────────────────────

const RootDropzoneToolbar: Component<{
    active: boolean;
    totalCount: number;
    toggleAllRowsExpanded: (val: boolean) => void;
}> = (props) => {
    const rootDroppable = createDroppable('root-dropzone');

    return (
        <div
            ref={rootDroppable.ref}
            class={cn(
                "px-4 py-3 border-b flex items-center justify-between flex-shrink-0 min-h-[52px] relative overflow-hidden",
                props.active
                    ? (rootDroppable.isActiveDroppable
                        ? "border-primary bg-primary/20 border-b-2 shadow-inner ring-inset ring-2 ring-primary/50"
                        : "border-primary/40 bg-primary/5 border-b-2")
                    : "border-border bg-surface/30"
            )}
        >
            <Show when={props.active} fallback={
                <div class="flex items-center justify-between w-full opacity-100 animate-in fade-in">
                    <div class="flex items-center gap-3">
                        <div class="p-1.5 bg-card border border-border/50 rounded-lg shadow-sm">
                            <MapPinIcon class="size-4 text-blue-500" />
                        </div>
                        <span class="text-sm font-semibold text-text">
                            Jerarquía de Ubicaciones
                        </span>
                        <div class="px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary text-xs font-bold rounded-full tabular-nums">
                            {props.totalCount}
                        </div>
                    </div>
                    <div class="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => props.toggleAllRowsExpanded(true)}
                            title="Expandir todas"
                            class="h-7 text-xs text-muted hover:text-text"
                            icon={<Expand />}
                        >
                            <span class="hidden sm:inline">Expandir</span>
                        </Button>
                        <span class="text-border text-lg font-light leading-none mb-1">|</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => props.toggleAllRowsExpanded(false)}
                            title="Colapsar todas"
                            class="h-7 text-xs text-muted hover:text-text"
                            icon={<Collapse />}
                        >
                            <span class="hidden sm:inline">Colapsar</span>
                        </Button>
                    </div>
                </div>
            }>
                <div class="flex w-full items-center justify-center gap-3 animate-in fade-in zoom-in-95 duration-200">
                    <MapPinIcon class={cn(
                        "size-5",
                        rootDroppable.isActiveDroppable ? "text-primary scale-125" : "text-primary/60"
                    )} />
                    <span class={cn(
                        "text-sm font-bold tracking-wide transition-colors duration-300",
                        rootDroppable.isActiveDroppable ? "text-primary" : "text-primary/80"
                    )}>
                        {rootDroppable.isActiveDroppable
                            ? "¡Suelta aquí para mover a nivel raíz!"
                            : "Arrastra aquí para desligar del padre"}
                    </span>
                </div>
            </Show>
        </div>
    );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Builds the hierarchical structure TanStack Table expects via `subRows`. */
function buildSubRows(flat: LocationItem[]): LocationNode[] {
    const map = new Map<number, LocationNode>();
    const roots: LocationNode[] = [];

    flat.forEach((n) => map.set(n.id, { ...n, subRows: [] }));

    flat.forEach((n) => {
        const node = map.get(n.id)!;
        if (n.parent_id) {
            const parent = map.get(n.parent_id);
            if (parent) {
                parent.subRows = parent.subRows ?? [];
                parent.subRows.push(node);
                return;
            }
        }
        roots.push(node);
    });

    return roots;
}

/** O(1) lookup map for hierarchy validation. */
function buildHierarchyMap(flat: LocationItem[]) {
    return new Map(flat.map((n) => [n.id, n.parent_id]));
}

function isDescendantOf(hierarchyMap: Map<number, number | null>, childId: number | null, ancestorId: number): boolean {
    if (childId === null) return false;
    if (childId === ancestorId) return true;
    const parentOfChild = hierarchyMap.get(childId);
    if (parentOfChild === undefined || parentOfChild === null) return false;
    return isDescendantOf(hierarchyMap, parentOfChild, ancestorId);
}

// ─── Auto-Scroll Constants ─────────────────────────────────────────────────
const SCROLL_ZONE_PX = 70;
const SCROLL_SPEED = 10;

// ─── LocationTable Component ──────────────────────────────────────────────────

const LocationTable: Component<LocationTableProps> = (props) => {
    const deactivate = useDeactivateLocation();
    const restore = useRestoreLocation();
    const reparent = useReparentLocation();

    const [expanded, setExpanded] = createSignal<ExpandedState>({});
    const [activeItem, setActiveItem] = createSignal<number | null>(null);
    let expandTimeout: ReturnType<typeof setTimeout> | null = null;
    let scrollContainerRef: HTMLDivElement | undefined;
    let scrollRAF: number | null = null;

    // ── Auto-scroll logic ──
    const startAutoScroll = () => {
        const handlePointerMove = (e: PointerEvent) => {
            if (!scrollContainerRef || activeItem() === null) return;
            const rect = scrollContainerRef.getBoundingClientRect();
            const y = e.clientY - rect.top;

            if (scrollRAF !== null) { cancelAnimationFrame(scrollRAF); scrollRAF = null; }

            if (y < SCROLL_ZONE_PX) {
                const intensity = 1 - (y / SCROLL_ZONE_PX);
                const speed = Math.ceil(SCROLL_SPEED * intensity);
                const doScroll = () => { if (!scrollContainerRef || activeItem() === null) return; scrollContainerRef.scrollTop -= speed; scrollRAF = requestAnimationFrame(doScroll); };
                scrollRAF = requestAnimationFrame(doScroll);
            } else if (y > rect.height - SCROLL_ZONE_PX) {
                const intensity = 1 - ((rect.height - y) / SCROLL_ZONE_PX);
                const speed = Math.ceil(SCROLL_SPEED * intensity);
                const doScroll = () => { if (!scrollContainerRef || activeItem() === null) return; scrollContainerRef.scrollTop += speed; scrollRAF = requestAnimationFrame(doScroll); };
                scrollRAF = requestAnimationFrame(doScroll);
            }
        };
        document.addEventListener('pointermove', handlePointerMove);
        return () => { document.removeEventListener('pointermove', handlePointerMove); if (scrollRAF !== null) { cancelAnimationFrame(scrollRAF); scrollRAF = null; } };
    };

    const handleDragStart = (event: DragEvent) => setActiveItem(Number(event.draggable.id));

    let cleanupAutoScroll: (() => void) | null = null;
    createEffect(() => {
        if (activeItem() !== null) { cleanupAutoScroll = startAutoScroll(); }
        else { cleanupAutoScroll?.(); cleanupAutoScroll = null; }
    });
    onCleanup(() => cleanupAutoScroll?.());

    const handleDragOver = (event: DragEvent) => {
        const { droppable } = event;
        if (expandTimeout) { clearTimeout(expandTimeout); expandTimeout = null; }
        if (!droppable || droppable.id === 'root-dropzone') return;

        const targetId = String(droppable.id);
        const activeId = activeItem();

        if (activeId !== null) {
            const hierarchyMap = buildHierarchyMap(props.rawData);
            if (isDescendantOf(hierarchyMap, Number(targetId), activeId)) return;
        }

        expandTimeout = setTimeout(() => {
            try {
                const row = table.getRow(targetId);
                if (row && row.getCanExpand() && !row.getIsExpanded()) {
                    setExpanded((prev: ExpandedState) => prev === true ? true : { ...prev, [targetId]: true });
                }
            } catch { /* ignore */ }
        }, 700);
    };

    const handleDragEnd = (event: DragEvent) => {
        setActiveItem(null);
        if (expandTimeout) clearTimeout(expandTimeout);
        const { draggable, droppable } = event;
        if (!draggable || !droppable) return;

        const sourceId = Number(draggable.id);
        const targetId = droppable.id === 'root-dropzone' ? null : Number(droppable.id);
        if (sourceId === targetId) return;

        // Always validate against FULL data (rawData), not filtered
        const hierarchyMap = buildHierarchyMap(props.rawData);
        if (targetId !== null && isDescendantOf(hierarchyMap, targetId, sourceId)) {
            toast.error('Acción inválida: No puedes mover una ubicación dentro de sus descendientes.');
            return;
        }

        const currentParentId = hierarchyMap.get(sourceId) ?? null;
        if (currentParentId === targetId) return;

        reparent.mutate(
            { id: sourceId, parentId: targetId },
            {
                onSuccess: () => toast.success(targetId === null ? 'Ubicación movida a la raíz' : 'Ubicación reubicada correctamente'),
                onError: (e: Error) => toast.error(e?.message ?? 'Error al reubicar'),
            },
        );
    };

    const handleDelete = (id: number) => {
        deactivate.mutate(id, {
            onSuccess: () => toast.success('Ubicación desactivada'),
            onError: (e: Error) => toast.error(e?.message ?? 'Error al desactivar'),
        });
    };

    const handleRestore = (id: number) => {
        restore.mutate(id, {
            onSuccess: () => toast.success('Ubicación restaurada'),
            onError: (e: Error) => toast.error(e?.message ?? 'Error al restaurar'),
        });
    };

    // Grabbing cursor during drag
    createEffect(() => {
        if (activeItem() !== null) document.body.style.setProperty('cursor', 'grabbing', 'important');
        else document.body.style.removeProperty('cursor');
    });
    onCleanup(() => document.body.style.removeProperty('cursor'));

    const columns = createLocationColumns({
        onEdit: props.onEdit,
        onAddChild: props.onAddChild,
        onDelete: handleDelete,
        onRestore: handleRestore,
    });

    const hierarchicalData = createMemo(() => buildSubRows(props.data));

    const table = createSolidTable({
        get data() { return hierarchicalData(); },
        columns,
        state: {
            get expanded() { return expanded(); },
            get rowSelection() { return props.rowSelection; },
        },
        onExpandedChange: (updater) =>
            setExpanded((prev) => typeof updater === 'function' ? updater(prev) : updater),
        enableRowSelection: true,
        onRowSelectionChange: (updater) => {
            const newVal = typeof updater === 'function' ? updater(props.rowSelection) : updater;
            props.onRowSelectionChange(newVal);
        },
        getCoreRowModel: getCoreRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        getSubRows: (row) => (row as LocationNode).subRows,
        getRowId: (row) => String(row.id),
        autoResetExpanded: false,
    });

    const rows = createMemo(() => table.getRowModel().rows);

    return (
        <DragDropProvider
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            collisionDetector={mostIntersecting}
        >
        <DragDropSensors />
        <div class="bg-card border border-border rounded-2xl shadow-card-soft overflow-hidden flex flex-col h-full relative">
            <RootDropzoneToolbar
                active={activeItem() !== null}
                totalCount={props.totalCount}
                toggleAllRowsExpanded={table.toggleAllRowsExpanded}
            />

            <div class="flex-1 overflow-auto" ref={scrollContainerRef}>
                <TableRoot>
                    <TableHeader class="sticky top-0 z-[20] bg-card">
                        <For each={table.getHeaderGroups()}>
                            {(headerGroup) => (
                                <TableRow>
                                    <For each={headerGroup.headers}>
                                        {(header) => (
                                            <TableHead
                                                class="text-xs tracking-wider text-muted font-semibold"
                                                style={{ width: `${header.getSize()}px` }}
                                            >
                                                <Show when={!header.isPlaceholder}>
                                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                                </Show>
                                            </TableHead>
                                        )}
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
                                            <For each={columns}>
                                                {() => <TableCell><Skeleton class="h-5 w-full rounded-md" /></TableCell>}
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
                                        <TableCell colSpan={columns.length} class="h-48">
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
                                    {(row) => <LocationRow row={row} onEdit={props.onEdit} />}
                                </For>
                            </Show>
                        </Show>
                    </TableBody>
                </TableRoot>
            </div>
        </div>

        {/* Drag Overlay */}
        <Portal>
            <div class="fixed inset-0 pointer-events-none" style={{ "z-index": 2147483647 }}>
                <DragOverlay style={{ "z-index": 2147483647 }}>
                    <Show when={activeItem()}>
                        {(id) => {
                            const loc = props.rawData.find(l => l.id === id());
                            return loc ? (
                                <div class="cursor-grabbing flex items-center gap-3 bg-card border border-primary/40 px-4 py-2.5 rounded-xl shadow-[0_15px_40px_-5px_rgba(0,0,0,0.2)] shrink-0 min-w-[280px] max-w-[400px] pointer-events-none ring-1 ring-black/5 animate-in zoom-in-95 duration-100">
                                    <div class="p-1.5 bg-surface rounded-md shrink-0">
                                        <GripVerticalIcon class="size-5 text-primary" />
                                    </div>
                                    <MapPinIcon class="size-5 text-blue-500 shrink-0" />
                                    <div class="flex flex-col min-w-0">
                                        <span class="text-[13px] font-semibold text-text truncate leading-tight">{loc.name}</span>
                                    </div>
                                </div>
                            ) : null;
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
}

const LocationRow: Component<LocationRowProps> = (props) => {
    const depth = () => props.row.depth;
    const isSelected = () => props.row.getIsSelected();

    const draggable = createDraggable(props.row.original.id, props.row.original);
    const droppable = createDroppable(props.row.original.id, props.row.original);

    return (
        <TableRow
            ref={(el) => { draggable.ref(el); droppable.ref(el); }}
            class={cn(
                'group relative transition-all duration-200',
                isSelected()
                    ? 'bg-row-selected hover:bg-row-selected-hover'
                    : 'hover:bg-table-hover',
                depth() === 1 && !isSelected() && 'bg-surface/10',
                depth() >= 2 && !isSelected() && 'bg-surface/30',
                droppable.isActiveDroppable && 'bg-primary/[0.08] shadow-[inset_3px_0_0_0_var(--color-primary-500)]',
                draggable.isActiveDraggable && 'opacity-30 origin-center filter grayscale-[50%]'
            )}
            onClick={() => props.onEdit(props.row.original.id)}
        >
            <For each={props.row.getVisibleCells()}>
                {(cell) => (
                    <TableCell
                        class={cn(
                            'bg-transparent',
                            (cell.column.id === 'actions' || cell.column.id === 'select') && 'cursor-default',
                        )}
                        onClick={(e) => {
                            if (cell.column.id === 'actions' || cell.column.id === 'select') e.stopPropagation();
                        }}
                    >
                        <Show
                            when={cell.column.id === 'name'}
                            fallback={flexRender(cell.column.columnDef.cell, cell.getContext())}
                        >
                            <div class="flex items-center min-w-0 h-full group/handle">
                                <button
                                    type="button"
                                    class="cursor-grab active:cursor-grabbing text-muted/30 group-hover/handle:text-primary transition-colors touch-none p-2 -ml-3 mr-1 rounded-md hover:bg-surface/50"
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
                )}
            </For>
        </TableRow>
    );
};

export default LocationTable;
