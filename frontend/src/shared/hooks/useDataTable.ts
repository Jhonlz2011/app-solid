import { createSignal, createMemo, batch, createEffect } from 'solid-js';
import type { RowSelectionState, ColumnPinningState, VisibilityState, SortingState, Updater, Table } from '@tanstack/solid-table';

export interface DataTableMeta {
    total?: number;
    pageCount?: number;
    hasNextPage?: boolean;
    hasPrevPage?: boolean;
    nextCursor?: string;
    prevCursor?: string;
}

export interface UseDataTableProps<TData> {
    data: () => TData[];
    meta: () => DataTableMeta | undefined;
    isCursorBased?: boolean;
}

export function useDataTable<TData extends { id: number | string }>(props: UseDataTableProps<TData>) {
    // ─── Table Core State ───────────────────────────────
    const [search, setSearch] = createSignal('');
    const [pageSize, setPageSize] = createSignal(10);
    const [page, setPage] = createSignal(1);
    
    // Cursor Pagination (Optional)
    const [cursor, setCursor] = createSignal<string | undefined>(undefined);
    const [direction, setDirection] = createSignal<'first' | 'next' | 'prev' | 'last'>('first');
    
    // Feature States
    const [sorting, setSorting] = createSignal<SortingState>([]);
    const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});
    const [columnVisibility, setColumnVisibility] = createSignal<VisibilityState>({});
    const [columnPinning, setColumnPinning] = createSignal<ColumnPinningState>({
        left: ['select'],
        right: ['actions'],
    });

    // Reference to underlying Headless Table instance
    const [tableInstance, setTableInstance] = createSignal<Table<TData>>();

    // ─── Derived Sorting/Params ──────────────────────────────────
    const sortBy = () => sorting().length > 0 ? sorting()[0].id : undefined;
    const sortOrder = () => sorting().length > 0 ? (sorting()[0].desc ? 'desc' as const : 'asc' as const) : undefined;
    
    // In cursor mode, active sorting usually forces fallback to offset page pagination
    const isSortedMode = () => !!sortBy() && sortBy() !== 'id';
    const useCursorPagination = () => props.isCursorBased && !isSortedMode();

    // ─── Derived Pagination Meta ─────────────────────────────────
    const totalRows = () => props.meta()?.total ?? 0;
    const hasNextPage = () => props.meta()?.hasNextPage ?? false;
    const hasPrevPage = () => props.meta()?.hasPrevPage ?? false;

    // ─── Selection Metrics ───────────────────────────────────────
    const selectedCount = () => Object.keys(rowSelection()).length;
    const selectedItems = createMemo(() => {
        const selection = rowSelection();
        return props.data().filter(item => selection[String(item.id)]);
    });

    // Clamp page effect to avoid "Page 5" of 3 on filter reduction.
    createEffect(() => {
        const pageCount = props.meta()?.pageCount;
        if (pageCount && page() > pageCount) setPage(Math.max(1, pageCount));
    });

    // ─── Handlers ────────────────────────────────────────────────
    const handleSearchInput = (value: string) => {
        batch(() => { 
            setSearch(value); 
            setCursor(undefined); 
            setDirection('first'); 
            setPage(1); 
            setRowSelection({});
        });
    };

    const handleFirstPage = () => {
        batch(() => { setCursor(undefined); setDirection('first'); setPage(1); setRowSelection({}); });
    };

    const handleLastPage = () => {
        if (!useCursorPagination()) {
            const pageCount = props.meta()?.pageCount ?? 1;
            batch(() => { setPage(pageCount); setRowSelection({}); });
        } else {
            batch(() => { setCursor(undefined); setDirection('last'); setRowSelection({}); });
        }
    };

    const handleNextPage = () => {
        if (!useCursorPagination()) {
            batch(() => { setPage(p => p + 1); setRowSelection({}); });
        } else {
            const nextCursor = props.meta()?.nextCursor;
            if (nextCursor) batch(() => { setCursor(nextCursor); setDirection('next'); setRowSelection({}); });
        }
    };

    const handlePrevPage = () => {
        if (!useCursorPagination()) {
            batch(() => { setPage(p => Math.max(1, p - 1)); setRowSelection({}); });
        } else {
            const prevCursor = props.meta()?.prevCursor;
            if (prevCursor) batch(() => { setCursor(prevCursor); setDirection('prev'); setRowSelection({}); });
        }
    };

    const handlePageSizeChange = (size: number) => {
        batch(() => { setPageSize(size); setCursor(undefined); setDirection('first'); setPage(1); });
    };

    const handleSortingChange = (updater: Updater<SortingState>) => {
        batch(() => {
            const newSorting = typeof updater === 'function' ? updater(sorting()) : updater;
            setSorting(newSorting);
            setCursor(undefined);
            setDirection('first');
            setPage(1);
        });
    };

    return {
        // State Getters
        search, page, pageSize, cursor, direction, sorting, 
        rowSelection, columnVisibility, columnPinning, tableInstance,
        
        // State Setters
        setSearch, setPage, setPageSize, setCursor, setDirection, setSorting, 
        setRowSelection, setColumnVisibility, setColumnPinning, setTableInstance,

        // Derived Parameters Useful for Query Queries
        sortBy, sortOrder, isSortedMode, useCursorPagination,

        // Meta & Selection Metrics
        totalRows, hasNextPage, hasPrevPage, selectedCount, selectedItems,

        // Actions
        handleSearchInput, handleFirstPage, handleLastPage, handleNextPage, handlePrevPage,
        handlePageSizeChange, handleSortingChange
    };
}
