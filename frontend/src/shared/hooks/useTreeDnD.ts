/**
 * useTreeDnD — Shared hook for tree-based Drag & Drop with reparenting.
 *
 * Encapsulates the identical DnD logic used by LocationTable and CategoryTable:
 * - Auto-scroll during drag near container edges
 * - Auto-expand folders on 700ms hover during drag
 * - Hierarchy validation (anti-circular drop prevention)
 * - Global grabbing cursor during drag
 * - Cleanup on unmount
 *
 * The hook is generic over the tree node type — callers provide
 * `getId`, `getParentId`, and `onReparent` callbacks for module-specific behavior.
 */
import { createSignal, createMemo, createEffect, onCleanup, type Accessor } from 'solid-js';
import type { DragEvent } from '@thisbeyond/solid-dnd';
import type { ExpandedState } from '@tanstack/solid-table';
import { toast } from 'solid-sonner';

// ─── Constants ───────────────────────────────────────────────────────────────

const SCROLL_ZONE_PX = 70;
const SCROLL_SPEED = 10;

// ─── Tree Structure Helpers (generic) ────────────────────────────────────────

export interface TreeNode {
    id: number;
    parent_id: number | null;
}

/**
 * Builds parent→child hierarchy map for O(1) ancestry lookups.
 * Works with any object that has `id` and `parent_id`.
 */
export function buildHierarchyMap<T extends TreeNode>(flat: T[]): Map<number, number | null> {
    return new Map(flat.map((n) => [n.id, n.parent_id]));
}

/**
 * Recursive O(depth) ancestry check using the hierarchy map.
 * Returns true if `childId` is a descendant of (or equal to) `ancestorId`.
 */
export function isDescendantOf(
    hierarchyMap: Map<number, number | null>,
    childId: number | null,
    ancestorId: number,
): boolean {
    if (childId === null) return false;
    if (childId === ancestorId) return true;
    const parentOfChild = hierarchyMap.get(childId);
    if (parentOfChild === undefined || parentOfChild === null) return false;
    return isDescendantOf(hierarchyMap, parentOfChild, ancestorId);
}

/**
 * Builds the hierarchical structure TanStack Table expects via `subRows`.
 * Generic — works for any flat list with `id` and `parent_id`.
 */
export function buildSubRows<T extends TreeNode>(flat: T[]): (T & { subRows?: T[] })[] {
    const map = new Map<number, T & { subRows?: T[] }>();
    const roots: (T & { subRows?: T[] })[] = [];

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

export function parseId(id: any): number | null {
    if (id === 'root-dropzone' || id === null || id === undefined) return null;
    const str = String(id);
    const dashIndex = str.indexOf('-');
    const numStr = dashIndex !== -1 ? str.substring(0, dashIndex) : str;
    const parsed = Number(numStr);
    return Number.isFinite(parsed) ? parsed : null;
}

// ─── Hook Options ────────────────────────────────────────────────────────────

export interface UseTreeDnDOptions<T extends TreeNode> {
    /**
     * Flat list of ALL items (unfiltered) — used for hierarchy validation.
     * Must include parent items even if they are filtered out of the view.
     */
    rawData: Accessor<T[]>;

    /**
     * Reference to the table instance for expand/collapse.
     * Must support `getRow(id: string)`.
     */
    tableRef: Accessor<any>;

    /**
     * Called when a valid reparent drop is confirmed.
     * Module-specific — e.g. calls the reparent mutation.
     */
    onReparent: (sourceId: number, targetParentId: number | null) => void;

    /**
     * Error message shown when user attempts a circular drop.
     * @default 'Acción inválida: No puedes mover un elemento dentro de sus propios descendientes.'
     */
    circularErrorMessage?: string;
}

export interface UseTreeDnDReturn {
    /** Currently dragged item ID, or null */
    activeItem: Accessor<number | null>;

    /** Expanded state for TanStack Table */
    expanded: Accessor<ExpandedState>;
    setExpanded: (updater: ExpandedState | ((prev: ExpandedState) => ExpandedState)) => void;

    /** Memoized hierarchy map for the raw data */
    hierarchyMap: Accessor<Map<number, number | null>>;

    /** Ref callback for the scrollable container */
    setScrollContainerRef: (el: HTMLDivElement) => void;

    /** DragDropProvider event handlers */
    handleDragStart: (event: DragEvent) => void;
    handleDragOver: (event: DragEvent) => void;
    handleDragEnd: (event: DragEvent) => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTreeDnD<T extends TreeNode>(options: UseTreeDnDOptions<T>): UseTreeDnDReturn {
    const [activeItem, setActiveItem] = createSignal<number | null>(null);
    const [expanded, setExpanded] = createSignal<ExpandedState>({});

    let expandTimeout: ReturnType<typeof setTimeout> | null = null;
    let scrollContainerRef: HTMLDivElement | undefined;
    let scrollRAF: number | null = null;

    const setScrollContainerRef = (el: HTMLDivElement) => {
        scrollContainerRef = el;
    };

    // Memoized hierarchy map from rawData
    const hierarchyMap = createMemo(() => buildHierarchyMap(options.rawData()));

    const circularMsg = options.circularErrorMessage
        ?? 'Acción inválida: No puedes mover un elemento dentro de sus propios descendientes.';

    // ── Auto-scroll ──────────────────────────────────────────────────────────

    const startAutoScroll = () => {
        const handlePointerMove = (e: PointerEvent) => {
            if (!scrollContainerRef || activeItem() === null) return;
            const rect = scrollContainerRef.getBoundingClientRect();
            const y = e.clientY - rect.top;

            if (scrollRAF !== null) {
                cancelAnimationFrame(scrollRAF);
                scrollRAF = null;
            }

            if (y < SCROLL_ZONE_PX) {
                const intensity = 1 - (y / SCROLL_ZONE_PX);
                const speed = Math.ceil(SCROLL_SPEED * intensity);
                const doScroll = () => {
                    if (!scrollContainerRef || activeItem() === null) return;
                    scrollContainerRef.scrollTop -= speed;
                    scrollRAF = requestAnimationFrame(doScroll);
                };
                scrollRAF = requestAnimationFrame(doScroll);
            } else if (y > rect.height - SCROLL_ZONE_PX) {
                const intensity = 1 - ((rect.height - y) / SCROLL_ZONE_PX);
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

    // ── Auto-scroll lifecycle ────────────────────────────────────────────────

    let cleanupAutoScroll: (() => void) | null = null;
    createEffect(() => {
        if (activeItem() !== null) {
            cleanupAutoScroll = startAutoScroll();
        } else {
            cleanupAutoScroll?.();
            cleanupAutoScroll = null;
        }
    });
    onCleanup(() => cleanupAutoScroll?.());

    // ── Global grabbing cursor ───────────────────────────────────────────────

    createEffect(() => {
        if (activeItem() !== null) {
            document.body.style.setProperty('cursor', 'grabbing', 'important');
        } else {
            document.body.style.removeProperty('cursor');
        }
    });
    onCleanup(() => document.body.style.removeProperty('cursor'));

    // ── Drag Handlers ────────────────────────────────────────────────────────

    const handleDragStart = (event: DragEvent) => {
        const id = parseId(event.draggable.id);
        setActiveItem(id);
    };

    const handleDragOver = (event: DragEvent) => {
        const { droppable } = event;

        if (expandTimeout) {
            clearTimeout(expandTimeout);
            expandTimeout = null;
        }

        if (!droppable || droppable.id === 'root-dropzone') return;

        const targetDbId = parseId(droppable.id);
        const activeId = activeItem();

        // Don't expand if target is a descendant of the dragged item
        if (activeId !== null && targetDbId !== null) {
            if (isDescendantOf(hierarchyMap(), targetDbId, activeId)) return;
        }

        // Auto-expand after 700ms hover
        expandTimeout = setTimeout(() => {
            try {
                const table = options.tableRef();
                if (!table || targetDbId === null) return;
                const targetDbIdStr = String(targetDbId);
                const row = table.getRow(targetDbIdStr);
                if (row && row.getCanExpand() && !row.getIsExpanded()) {
                    setExpanded((prev: ExpandedState) =>
                        prev === true ? true : { ...prev, [targetDbIdStr]: true }
                    );
                }
            } catch {
                // Row may not exist if filtered out — ignore silently
            }
        }, 700);
    };

    const handleDragEnd = (event: DragEvent) => {
        setActiveItem(null);
        if (expandTimeout) clearTimeout(expandTimeout);

        const { draggable, droppable } = event;
        if (!draggable || !droppable) return;

        const sourceId = parseId(draggable.id);
        const targetId = parseId(droppable.id);

        if (sourceId === null) return;

        // Same target — no-op
        if (sourceId === targetId) return;

        // Anti-circular validation
        if (targetId !== null && isDescendantOf(hierarchyMap(), targetId, sourceId)) {
            toast.error(circularMsg);
            return;
        }

        // Redundant drop on same parent — no-op
        const currentParentId = hierarchyMap().get(sourceId) ?? null;
        if (currentParentId === targetId) return;

        // Delegate to module-specific reparent callback
        options.onReparent(sourceId, targetId);
    };

    return {
        activeItem,
        expanded,
        setExpanded,
        hierarchyMap,
        setScrollContainerRef,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
    };
}
