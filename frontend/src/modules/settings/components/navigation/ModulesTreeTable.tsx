/**
 * ModulesTreeTable — Hierarchical tree table with Drag-and-Drop reparenting,
 * ordering, expand/collapse, URL alias visibility, and status indicators.
 *
 * Modeled after CategoryTable with full TanStack Table + @thisbeyond/solid-dnd + useTreeDnD.
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
    type ColumnDef,
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
import { Skeleton } from '@display/Skeleton';
import { EmptyState } from '@display/EmptyState';
import { GripVerticalIcon } from '@icons/GripVerticalIcon';
import { ChevronRightIcon } from '@icons/ChevronRightIcon';
import { LayoutIcon } from '@icons/LayoutIcon';
import { EditIcon } from '@icons/EditIcon';
import { SearchIcon } from '@icons/SearchIcon';
import { cn } from '@shared/lib/utils';
import { useTreeDnD, buildSubRows } from '@shared/hooks/useTreeDnD';
import type { MenuItemResponseType } from '@app/schema/backend';
import { useReorderMenuItems } from '../../data/menu.mutations';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ModulesTreeTableProps {
    data: MenuItemResponseType[];
    rawData: MenuItemResponseType[];
    isLoading: boolean;
    onEdit: (id: number) => void;
    headerActions?: any;
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
                        ? "bg-linear-to-r from-primary/10 via-primary/18 to-primary/10 border-primary text-primary shadow-[inset_0_-12px_32px_rgba(99,102,241,0.08),0_4px_24px_rgba(99,102,241,0.12)]"
                        : "bg-surface/90 border-primary/20 text-muted-foreground hover:border-primary/40 animate-pulse"
                )}
            >
                <div class="flex items-center gap-2.5 min-w-0 max-w-full justify-center">
                    <span class={cn(
                        "px-2 py-0.5 rounded-md text-[9px] font-extrabold tracking-wider uppercase shrink-0 transition-all duration-300",
                        rootDroppable.isActiveDroppable
                            ? "bg-primary/25 border border-primary/40 text-primary shadow-sm"
                            : "bg-primary/10 border border-primary/20 text-primary"
                    )}>
                        Módulo Raíz
                    </span>
                    <span class={cn(
                        "text-xs font-semibold truncate transition-colors duration-200 tracking-wide",
                        rootDroppable.isActiveDroppable 
                            ? "text-primary font-bold drop-shadow-[0_0_8px_rgba(99,102,241,0.2)]" 
                            : "text-foreground/90"
                    )}>
                        {rootDroppable.isActiveDroppable
                            ? "¡Suelta para mover al nivel principal del menú!"
                            : "Arrastra hasta aquí para convertir en módulo de primer nivel"}
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

// ─── Main Component ──────────────────────────────────────────────────────────

export const ModulesTreeTable: Component<ModulesTreeTableProps> = (props) => {
    const reorderMut = useReorderMenuItems();
    let scrollContainerRef: HTMLDivElement | undefined;

    // Search filter state
    const [searchTerm, setSearchTerm] = createSignal('');

    // Filter items by search
    const filteredData = createMemo(() => {
        const term = searchTerm().trim().toLowerCase();
        if (!term) return props.data;
        return props.data.filter(item =>
            item.label.toLowerCase().includes(term) ||
            item.key.toLowerCase().includes(term) ||
            (item.path ? item.path.toLowerCase().includes(term) : false) ||
            (item.path_alias ? item.path_alias.toLowerCase().includes(term) : false)
        );
    });

    // ── Shared DnD hook ──
    const dnd = useTreeDnD<MenuItemResponseType>({
        rawData: () => props.rawData,
        tableRef: () => table,
        onReparent: (sourceId, targetParentId) => {
            const currentItem = props.rawData.find(i => i.id === sourceId);
            if (!currentItem) return;

            // Calculate new sort order at destination
            const siblings = props.rawData.filter(i => i.parent_id === targetParentId);
            const maxSort = siblings.reduce((max, s) => Math.max(max, s.sort_order ?? 0), 0);
            const newSortOrder = maxSort + 1;

            reorderMut.mutate(
                [{ id: sourceId, sort_order: newSortOrder, parent_id: targetParentId }],
                {
                    onSuccess: () => toast.success(targetParentId === null ? 'Módulo movido a la raíz' : 'Módulo reubicado correctamente'),
                    onError: (e: any) => toast.error(e?.message ?? 'Error al mover módulo'),
                }
            );
        },
        circularErrorMessage: 'Acción inválida: No puedes mover un módulo padre dentro de sus propios submenús.',
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
            window.addEventListener('pointermove', handlePointerMove, { passive: true });
            onCleanup(() => {
                window.removeEventListener('pointermove', handlePointerMove);
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
                if (isWithinX) return rootDropzone;
            }
        }
        return mostIntersecting(draggable, droppables, context);
    };

    // Columns Definition (Estado removed — status is strictly global)
    const columns: ColumnDef<MenuItemResponseType>[] = [
        {
            id: 'label',
            header: () => <span class="pl-2">Módulo / Menú</span>,
            cell: ({ row }) => {
                const item = row.original;
                const canExpand = row.getCanExpand();
                const isExpanded = row.getIsExpanded();
                const depth = row.depth;

                return (
                    <div class="flex items-center gap-2 min-w-0" style={{ "padding-left": `${depth * 20}px` }}>
                        {/* Expand / Collapse toggle */}
                        <Show
                            when={canExpand}
                            fallback={<div class="size-5 shrink-0" />}
                        >
                            <button
                                type="button"
                                class="size-5 flex items-center justify-center rounded-md hover:bg-surface/80 text-muted transition-transform shrink-0"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    row.toggleExpanded();
                                }}
                            >
                                <ChevronRightIcon class={cn("size-3.5 transition-transform duration-200", isExpanded && "rotate-90")} />
                            </button>
                        </Show>

                        {/* Module icon */}
                        <div class="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                            <Show
                                when={item.icon && item.icon.startsWith('M')}
                                fallback={<LayoutIcon class="size-4 text-primary" />}
                            >
                                <svg class="size-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d={item.icon!} />
                                </svg>
                            </Show>
                        </div>

                        {/* Labels */}
                        <div class="min-w-0 flex flex-col justify-center">
                            <span class="text-sm font-semibold text-text leading-tight group-hover:text-primary transition-colors">
                                {item.label}
                            </span>
                            <span class="text-[11px] text-muted font-mono leading-tight mt-0.5">
                                {item.key}
                            </span>
                        </div>
                    </div>
                );
            },
        },
        {
            id: 'path',
            header: () => <span>Ruta Interna</span>,
            cell: ({ row }) => (
                <code class="text-xs font-mono px-2.5 py-1 rounded-md bg-surface/80 border border-border/60 text-muted inline-block">
                    {row.original.path || '— (Agrupador)'}
                </code>
            ),
        },
        {
            id: 'path_alias',
            header: () => <span>Alias de URL (Visible)</span>,
            cell: ({ row }) => {
                const item = row.original;
                return item.path_alias ? (
                    <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <span class="px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-mono font-semibold whitespace-nowrap">
                            {item.path_alias}
                        </span>
    
                    </div>
                ) : (
                    <span class="text-xs text-muted/50 italic font-mono">
                        Por defecto {item.path ? `(${item.path})` : ''}
                    </span>
                );
            },
        },
        {
            id: 'actions',
            header: () => <span class="text-right block w-full pr-2">Acciones</span>,
            cell: ({ row }) => (
                <div class="flex items-center justify-end gap-1 pr-1">
                    <button
                        type="button"
                        class="size-8 flex items-center justify-center rounded-lg hover:bg-primary/10 text-muted hover:text-primary transition-colors cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            props.onEdit(row.original.id);
                        }}
                        title="Editar módulo"
                    >
                        <EditIcon class="size-4" />
                    </button>
                </div>
            ),
        },
    ];

    // Build hierarchical tree
    const hierarchicalData = createMemo(() => buildSubRows(filteredData()));

    const [sorting, setSorting] = createSignal<SortingState>([]);

    const table = createSolidTable({
        get data() { return hierarchicalData(); },
        columns,
        state: {
            get expanded() { return dnd.expanded(); },
            get sorting() { return sorting(); },
        },
        onExpandedChange: (updater) =>
            dnd.setExpanded(typeof updater === 'function' ? updater(dnd.expanded()) : updater),
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getSubRows: (row) => (row as MenuItemResponseType & { subRows?: MenuItemResponseType[] }).subRows,
        getRowId: (row) => String(row.id),
        autoResetExpanded: false,
    });

    const rows = createMemo(() => table.getRowModel().rows);

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

            <div class="space-y-4">
                {/* Toolbar: Search + Actions */}
                <div class="flex items-center justify-between gap-3 flex-wrap">
                    <div class="relative flex-1 min-w-48 max-w-sm">
                        <div class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                            <SearchIcon class="size-3.5 text-muted" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por nombre, clave o ruta..."
                            value={searchTerm()}
                            onInput={(e) => setSearchTerm(e.currentTarget.value)}
                            class="w-full bg-surface/40 border border-border text-text text-sm rounded-lg pl-8 pr-3 py-1.5 placeholder:text-muted/60 hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/15 outline-hidden transition-colors"
                        />
                    </div>
                    {props.headerActions}
                </div>

                {/* Table Container */}
                <div class="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col relative">
                    <div class="overflow-x-auto" ref={(el) => { scrollContainerRef = el; dnd.setScrollContainerRef(el); }}>
                        <TableRoot>
                            <TableHeader class="bg-surface/30">
                                <For each={table.getHeaderGroups()}>
                                    {(headerGroup) => (
                                        <TableRow>
                                            <For each={headerGroup.headers}>
                                                {(header) => (
                                                    <TableHead
                                                        class={cn(
                                                            "text-xs tracking-wider text-muted font-semibold py-3",
                                                            header.column.id === 'label' && "min-w-[280px] pl-4",
                                                            header.column.id === 'path' && "w-[180px] min-w-[160px]",
                                                            header.column.id === 'path_alias' && "min-w-[240px]",
                                                            header.column.id === 'actions' && "w-[90px] text-right pr-4"
                                                        )}
                                                    >
                                                        <Show when={!header.isPlaceholder}>
                                                            {flexRender(
                                                                header.column.columnDef.header,
                                                                header.getContext()
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
                                <Show
                                    when={!props.isLoading}
                                    fallback={
                                        <For each={Array(5).fill(0)}>
                                            {() => (
                                                <TableRow>
                                                    <TableCell colSpan={4} class="py-3">
                                                        <Skeleton class="h-6 w-full rounded-md" />
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </For>
                                    }
                                >
                                    <Show
                                        when={rows().length > 0}
                                        fallback={
                                            <TableRow>
                                                <TableCell colSpan={4} class="h-40">
                                                    <EmptyState
                                                        icon={<LayoutIcon class="size-8" />}
                                                        message="No se encontraron módulos"
                                                        description="No hay elementos configurados o coincidentes con la búsqueda."
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        }
                                    >
                                        <For each={rows()}>
                                            {(row) => (
                                                <ModuleRow
                                                    row={row}
                                                    onEdit={props.onEdit}
                                                    isDragging={dnd.activeItem() !== null}
                                                />
                                            )}
                                        </For>
                                    </Show>
                                </Show>
                            </TableBody>
                        </TableRoot>
                    </div>

                    {/* Root Dropzone Overlay */}
                    <RootDropzone active={dnd.activeItem() !== null} />
                </div>
            </div>

            {/* Drag Overlay with Glassmorphism */}
            <Portal>
                <div class="fixed inset-0 pointer-events-none" style={{ "z-index": 2147483647 }}>
                    <DragOverlay style={{ "z-index": 2147483647 }}>
                        <Show when={dnd.activeItem()}>
                            {(id) => {
                                const item = props.rawData.find(i => i.id === id());
                                return item ? (
                                    <div class={cn(
                                        "cursor-grabbing flex items-center gap-3 px-4 py-2.5 rounded-xl pointer-events-none",
                                        "min-w-64 max-w-96",
                                        "bg-card/95 backdrop-blur-xl border border-primary/30",
                                        "shadow-2xl shadow-primary/20",
                                        "animate-in zoom-in-95 duration-150"
                                    )}>
                                        <div class="p-1.5 bg-primary/10 rounded-md shrink-0">
                                            <GripVerticalIcon class="size-4 text-primary" />
                                        </div>
                                        <LayoutIcon class="size-5 text-primary shrink-0" />
                                        <div class="flex flex-col min-w-0">
                                            <span class="text-sm font-semibold text-text truncate">
                                                {item.label}
                                            </span>
                                            <span class="text-[10px] text-muted font-mono truncate">
                                                {item.path || 'Agrupador'}
                                            </span>
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

// ─── Module Row Component with DnD Activators ────────────────────────────────

interface ModuleRowProps {
    row: Row<MenuItemResponseType>;
    onEdit: (id: number) => void;
    isDragging: boolean;
}

const ModuleRow: Component<ModuleRowProps> = (props) => {
    const depth = () => props.row.depth;
    const uniqueId = `${props.row.original.id}-${Math.random().toString(36).substring(2, 9)}`;

    const draggable = createDraggable(uniqueId, props.row.original);
    const droppable = createDroppable(uniqueId, props.row.original);

    return (
        <TableRow
            ref={(el) => {
                draggable.ref(el);
                droppable.ref(el);
            }}
            class={cn(
                'group relative transition-colors cursor-pointer hover:bg-surface/30',
                depth() === 1 && 'bg-surface/10',
                depth() >= 2 && 'bg-surface/20',
                droppable.isActiveDroppable && 'ring-2 ring-primary/50 bg-primary/5',
                draggable.isActiveDraggable && 'opacity-40'
            )}
            onClick={() => props.onEdit(props.row.original.id)}
        >
            <For each={props.row.getVisibleCells()}>
                {(cell) => (
                    <TableCell class="py-2.5">
                        <Show
                            when={cell.column.id === 'label'}
                            fallback={flexRender(cell.column.columnDef.cell, cell.getContext())}
                        >
                            <div class="flex items-center min-w-0">
                                {/* Drag Handle */}
                                <button
                                    type="button"
                                    class={cn(
                                        "touch-none p-1.5 -ml-1 mr-1.5 rounded-md transition-colors",
                                        "cursor-grab active:cursor-grabbing",
                                        "text-muted/40 hover:text-primary group-hover:text-muted hover:bg-surface/60"
                                    )}
                                    {...draggable.dragActivators}
                                    onClick={(e) => e.stopPropagation()}
                                    title="Arrastra para reordenar o cambiar jerarquía"
                                >
                                    <GripVerticalIcon class="size-3.5" />
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

export default ModulesTreeTable;
