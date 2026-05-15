/**
 * CategoryTable — DataTable de TanStack con agrupamiento jerárquico basado en parent_id.
 *
 * Usa `getExpandedRowModel` + `getSubRows` de TanStack Table para manejar
 * el expand/collapse nativo por nodo padre.
 * 
 * Features:
 * - Drag & Drop con @thisbeyond/solid-dnd para reparentar categorías
 * - Auto-scroll durante drag hacia los bordes del contenedor
 * - Auto-expand de carpetas al hovear durante drag
 * - Root dropzone para mover a nivel raíz
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
import { FolderIcon, GripVerticalIcon, Expand, Collapse } from '@shared/ui/icons';
import { cn } from '@shared/lib/utils';
import type { CategoryNode } from '../data/categories.api';

import { useCategoriesFlat } from '../data/categories.queries';
import {
    useDeactivateCategory,
    useRestoreCategory,
    useUpdateCategory,
    useReorderCategories
} from '../data/categories.mutations';

import { createCategoryColumns } from './CategoryColumns';

// ─── Props ───────────────────────────────────────────────────────────────────

interface CategoryTableProps {
    onEdit: (id: number) => void;
    onAddChild: (parentId: number) => void;
}

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
                "px-4 py-3 border-b flex items-center justify-between flex-shrink-0 min-h-[58px] relative overflow-hidden",
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
                            <FolderIcon class="size-4 text-amber-500" />
                        </div>
                        <span class="text-sm font-semibold text-text">
                            Jerarquía de Categorías
                        </span>
                        <div class="px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary text-xs font-bold rounded-full tabular-nums">
                            {props.totalCount} items
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => props.toggleAllRowsExpanded(true)} 
                            title="Expandir todas las carpetas"
                            class="h-8 text-xs text-muted hover:text-text"
                            icon={<Expand />}
                        >
                            Expandir todo
                        </Button>
                        <span class="text-border text-lg font-light leading-none mb-1">|</span>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => props.toggleAllRowsExpanded(false)} 
                            title="Colapsar todas las carpetas"
                            class="h-8 text-xs text-muted hover:text-text"
                            icon={<Collapse />}
                        >
                            Colapsar todo
                        </Button>
                    </div>
                </div>
            }>
                <div class="flex w-full items-center justify-center gap-3 animate-in fade-in zoom-in-95 duration-200">
                    <FolderIcon class={cn(
                        "size-5 ", 
                        rootDroppable.isActiveDroppable ? "text-primary scale-125" : "text-primary/60"
                    )} />
                    <span class={cn(
                        "text-sm font-bold tracking-wide transition-colors duration-300",
                        rootDroppable.isActiveDroppable ? "text-primary" : "text-primary/80"
                    )}>
                        {rootDroppable.isActiveDroppable
                            ? "¡Suelta aquí para Mover a Nivel Principal (Raíz)!"
                            : "Arrastra la categoría hasta aquí para desligarla de su elemento Padre"}
                    </span>
                </div>
            </Show>
        </div>
    );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Builds the hierarchical structure TanStack Table expects via `subRows`. */
function buildSubRows(flat: CategoryNode[]): CategoryNode[] {
    const map = new Map<number, CategoryNode & { subRows?: CategoryNode[] }>();
    const roots: (CategoryNode & { subRows?: CategoryNode[] })[] = [];

    // First pass: index every node
    flat.forEach((n) => map.set(n.id, { ...n, subRows: [] }));

    // Second pass: wire children
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

    return roots as CategoryNode[];
}

/** Memoized lookup map for O(1) performance in hierarchy validation. */
function buildHierarchyMap(flat: CategoryNode[]) {
    return new Map(flat.map((n) => [n.id, n.parent_id]));
}

// ─── Auto-Scroll Constants ─────────────────────────────────────────────────
const SCROLL_ZONE_PX = 70;  // Distance from edge to trigger scroll
const SCROLL_SPEED = 10;    // Pixels per frame at max speed

// ─── CategoryTable Component ──────────────────────────────────────────────────

const CategoryTable: Component<CategoryTableProps> = (props) => {
    const query = useCategoriesFlat();
    const deactivate = useDeactivateCategory();
    const restore = useRestoreCategory();
    const updateCategory = useUpdateCategory();

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

            // Cancel any pending RAF
            if (scrollRAF !== null) {
                cancelAnimationFrame(scrollRAF);
                scrollRAF = null;
            }

            if (y < SCROLL_ZONE_PX) {
                // Near top edge → scroll up
                const intensity = 1 - (y / SCROLL_ZONE_PX); // 0..1
                const speed = Math.ceil(SCROLL_SPEED * intensity);
                const doScroll = () => {
                    if (!scrollContainerRef || activeItem() === null) return;
                    scrollContainerRef.scrollTop -= speed;
                    scrollRAF = requestAnimationFrame(doScroll);
                };
                scrollRAF = requestAnimationFrame(doScroll);
            } else if (y > rect.height - SCROLL_ZONE_PX) {
                // Near bottom edge → scroll down
                const intensity = 1 - ((rect.height - y) / SCROLL_ZONE_PX); // 0..1
                const speed = Math.ceil(SCROLL_SPEED * intensity);
                const doScroll = () => {
                    if (!scrollContainerRef || activeItem() === null) return;
                    scrollContainerRef.scrollTop += speed;
                    scrollRAF = requestAnimationFrame(doScroll);
                };
                scrollRAF = requestAnimationFrame(doScroll);
            }
        };

        document.addEventListener('pointermove', handlePointerMove);
        return () => {
            document.removeEventListener('pointermove', handlePointerMove);
            if (scrollRAF !== null) {
                cancelAnimationFrame(scrollRAF);
                scrollRAF = null;
            }
        };
    };

    const handleDragStart = (event: DragEvent) => {
        setActiveItem(Number(event.draggable.id));
    };

    // Wire up/tear down auto-scroll when drag starts/ends
    let cleanupAutoScroll: (() => void) | null = null;
    createEffect(() => {
        if (activeItem() !== null) {
            cleanupAutoScroll = startAutoScroll();
        } else {
            cleanupAutoScroll?.();
            cleanupAutoScroll = null;
        }
    });

    onCleanup(() => {
        cleanupAutoScroll?.();
    });

    const handleDragOver = (event: DragEvent) => {
        const { droppable } = event;
        
        if (expandTimeout) {
            clearTimeout(expandTimeout);
            expandTimeout = null;
        }

        if (!droppable || droppable.id === 'root-dropzone') {
            return;
        }

        const targetId = String(droppable.id);

        const activeId = activeItem();
        if (activeId !== null) {
            const hierarchyMap = buildHierarchyMap(query.data ?? []);
            
            const isDescendant = (childId: number | null, parentId: number): boolean => {
                if (childId === null) return false;
                if (childId === parentId) return true;
                const parentOfChild = hierarchyMap.get(childId);
                if (parentOfChild === undefined) return false;
                return isDescendant(parentOfChild, parentId);
            };

            // No interactuar ni expandir si es descendiente del elemento que estamos arrastrando
            if (isDescendant(Number(targetId), activeId)) {
                return;
            }
        }
        
        expandTimeout = setTimeout(() => {
            try {
                const row = table.getRow(targetId);
                // Si la fila puede expandirse (es una carpeta) y no lo está
                if (row && row.getCanExpand() && !row.getIsExpanded()) {
                    setExpanded((prev: ExpandedState) => 
                        prev === true ? true : { ...prev, [targetId]: true }
                    );
                }
            } catch {
                // Ignore silent errors
            }
        }, 700); // 700ms estable
    };

    const handleDragEnd = (event: DragEvent) => {
        setActiveItem(null);
        if (expandTimeout) clearTimeout(expandTimeout);
        const { draggable, droppable } = event;

        if (!draggable || !droppable) return;

        const sourceId = Number(draggable.id);
        // Custom identifier for "root" dropzone
        const targetId = droppable.id === 'root-dropzone' ? null : Number(droppable.id);

        if (sourceId === targetId) return;

        // O(1) Validation: Prevent circular dependencies (dropping a parent inside its own descendant)
        const hierarchyMap = buildHierarchyMap(query.data ?? []);
        
        const isDescendant = (childId: number | null, parentId: number): boolean => {
            if (childId === null) return false;
            if (childId === parentId) return true;
            const parentOfChild = hierarchyMap.get(childId);
            if (parentOfChild === undefined) return false;
            return isDescendant(parentOfChild, parentId);
        };

        if (isDescendant(targetId, sourceId)) {
            toast.error('Acción inválida: No puedes mover un grupo dentro de sus propios subgrupos.');
            return;
        }

        // Prevent redundant drops on same parent
        const currentParentId = hierarchyMap.get(sourceId) ?? null;
        if (currentParentId === targetId) return;

        updateCategory.mutate({
            id: sourceId,
            data: { parentId: targetId }
        }, {
            onSuccess: () => toast.success(targetId === null ? 'Categoría movida a la raíz' : 'Categoría reubicada correctamente'),
            onError: (e: Error) => toast.error(e?.message ?? 'Error al reubicar categoría'),
        });
    };

    const handleDelete = (id: number) => {
        deactivate.mutate(id, {
            onSuccess: () => toast.success('Categoría desactivada'),
            onError: (e: Error) => toast.error(e?.message ?? 'Error al desactivar'),
        });
    };

    const handleRestore = (id: number) => {
        restore.mutate(id, {
            onSuccess: () => toast.success('Categoría restaurada'),
            onError: (e: Error) => toast.error(e?.message ?? 'Error al restaurar'),
        });
    };

    // Enforce global grabbing cursor to override hover states during drag
    createEffect(() => {
        if (activeItem() !== null) {
            document.body.style.setProperty('cursor', 'grabbing', 'important');
        } else {
            document.body.style.removeProperty('cursor');
        }
    });

    onCleanup(() => {
        document.body.style.removeProperty('cursor');
    });

    const columns = createCategoryColumns({
        onEdit: props.onEdit,
        onAddChild: props.onAddChild,
        onDelete: handleDelete,
        onRestore: handleRestore,
    });

    // Build hierarchical rows from flat list
    const hierarchicalData = createMemo(() =>
        buildSubRows(query.data ?? [])
    );

    const totalCount = createMemo(() => (query.data ?? []).length);

    const table = createSolidTable({
        get data() { return hierarchicalData(); },
        columns,
        state: {
            get expanded() { return expanded(); },
        },
        onExpandedChange: (updater) =>
            setExpanded((prev) =>
                typeof updater === 'function' ? updater(prev) : updater
            ),
        getCoreRowModel: getCoreRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        getSubRows: (row) => (row as CategoryNode & { subRows?: CategoryNode[] }).subRows,
        getRowId: (row) => String(row.id),
        // Expand all by default on first load
        autoResetExpanded: false,
    });

    // Flatten expanded rows for rendering, wrapped in evaluate-once Memo
    // This allows SolidJS reactivity graph to only trigger updates when TanStack returns new rows.
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
            {/* Custom Toolbar Dropzone */}
            <RootDropzoneToolbar
                active={activeItem() !== null}
                totalCount={totalCount()}
                toggleAllRowsExpanded={table.toggleAllRowsExpanded}
            />

            {/* Table with scroll container ref for auto-scroll */}
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
                                                    {flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext(),
                                                    )}
                                                </Show>
                                            </TableHead>
                                        )}
                                    </For>
                                </TableRow>
                            )}
                        </For>
                    </TableHeader>

                    <TableBody>
                        {/* Loading skeleton */}
                        <Show
                            when={!query.isPending}
                            fallback={
                                <For each={Array(6).fill(0)}>
                                    {() => (
                                        <TableRow class="hover:bg-transparent">
                                            <For each={columns}>
                                                {() => (
                                                    <TableCell>
                                                        <Skeleton class="h-5 w-full rounded-md" />
                                                    </TableCell>
                                                )}
                                            </For>
                                        </TableRow>
                                    )}
                                </For>
                            }
                        >
                            {/* Empty state */}
                            <Show
                                when={rows().length > 0}
                                fallback={
                                    <TableRow>
                                        <TableCell colSpan={columns.length} class="h-48">
                                            <EmptyState
                                                icon={<FolderIcon class="size-8" />}
                                                message="No hay categorías"
                                                description="Crea una nueva categoría para comenzar"
                                            />
                                        </TableCell>
                                    </TableRow>
                                }
                            >
                                <For each={rows()}>
                                    {(row) => <CategoryRow row={row} onEdit={props.onEdit} />}
                                </For>
                            </Show>
                        </Show>
                    </TableBody>
                </TableRoot>
            </div>
        </div>

        {/* Drag Overlay Premium - Libre pero pulido visualmente para sentirse nativo */}
        <Portal>
            <div class="fixed inset-0 pointer-events-none" style={{ "z-index": 2147483647 }}>
                <DragOverlay style={{ "z-index": 2147483647 }}>
                    <Show when={activeItem()}>
                        {(id) => {
                            const cat = query.data?.find(c => c.id === id());
                            return cat ? (
                                <div class="cursor-grabbing flex items-center gap-3 bg-card border border-primary/40 px-4 py-2.5 rounded-xl shadow-[0_15px_40px_-5px_rgba(0,0,0,0.2)] shrink-0 min-w-[280px] max-w-[400px] opacity-100 transform scale-105 pointer-events-none ring-1 ring-black/5 animate-in zoom-in-95 duration-100">
                                    <div class="p-1.5 bg-surface rounded-md shrink-0">
                                        <GripVerticalIcon class="size-5 text-primary" />
                                    </div>
                                    <FolderIcon class="size-5 text-amber-500 shrink-0" />
                                    <div class="flex flex-col min-w-0">
                                        <span class="text-[13px] font-semibold text-text truncate leading-tight">{cat.name}</span>
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

// ─── CategoryRow — Individual row with depth-aware styling ────────────────────

interface CategoryRowProps {
    row: Row<CategoryNode>;
    onEdit: (id: number) => void;
}

const CategoryRow: Component<CategoryRowProps> = (props) => {
    const isSelected = () => props.row.getIsSelected();
    const depth = () => props.row.depth;

    const draggable = createDraggable(props.row.original.id, props.row.original);
    const droppable = createDroppable(props.row.original.id, props.row.original);

    return (
        <TableRow
            ref={(el) => {
                draggable.ref(el);
                droppable.ref(el);
            }}
            class={cn(
                'group relative transition-all duration-200',
                isSelected()
                    ? 'bg-row-selected hover:bg-row-selected-hover'
                    : 'hover:bg-table-hover',
                // Indentacion suave
                depth() === 1 && 'bg-surface/10',
                depth() >= 2 && 'bg-surface/30',

                // Drop Target UI Premium: Linea lateral e indicador claro
                droppable.isActiveDroppable && 'bg-primary/[0.08] shadow-[inset_3px_0_0_0_var(--color-primary-500)]',

                // Ghost Row Origin UI: Fila arrastrada se atenua
                draggable.isActiveDraggable && 'opacity-30 origin-center filter grayscale-[50%]'
            )}
            onClick={() => props.onEdit(props.row.original.id)}
        >
            <For each={props.row.getVisibleCells()}>
                {(cell) => (
                    <TableCell
                        class={cn(
                            'bg-transparent',
                            cell.column.id === 'actions' && 'cursor-default',
                        )}
                        onClick={(e) => {
                            if (cell.column.id === 'actions') e.stopPropagation();
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

export default CategoryTable;
