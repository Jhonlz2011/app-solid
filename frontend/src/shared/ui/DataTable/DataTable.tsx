// Reusable DataTable with TanStack Table + Virtual Scrolling + Pagination
import {
    Component,
    For,
    Show,
    JSX,
    createSignal,
    createMemo,
    splitProps,
    onMount,
    onCleanup,
    createEffect,
} from 'solid-js';
import {
    createSolidTable,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    type ColumnDef,
    type SortingState,
    type VisibilityState,
    type RowSelectionState,
    type ColumnPinningState,
    type PaginationState,
    type Table,
    type Row,
    type Updater,
} from '@tanstack/solid-table';
import { createVirtualizer } from '@tanstack/solid-virtual';
import { Table as TableRoot, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../table';
import { Skeleton } from '../Skeleton';
import { EmptyState } from '../EmptyState';
import Button from '../Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Select';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsLeftIcon,
    ChevronsRightIcon,
} from '../icons';

// =============================================================================
// Column Pinning Helper
// =============================================================================

type CSSProperties = { [key: string]: string | number };

function getCommonPinningStyles(column: {
    getIsPinned: () => false | 'left' | 'right';
    getStart: (position?: 'left' | 'center' | 'right') => number;
    getAfter: (position?: 'left' | 'center' | 'right') => number;
    getSize: () => number;
}): { className: string; style: CSSProperties } {
    const isPinned = column.getIsPinned();
    const colSize = column.getSize();

    if (!isPinned) {
        return {
            className: '',
            style: { width: `${colSize}px` }
        };
    }

    const isLeft = isPinned === 'left';
    const position = isLeft ? column.getStart('left') : column.getAfter('right');

    return {
        className: 'sticky z-[20] bg-card',
        style: {
            ...(isLeft ? { left: `${position}px` } : { right: `${position}px` }),
            width: `${colSize}px`,
            'min-width': `${colSize}px`,
            'max-width': `${colSize}px`,
        }
    };
}

// =============================================================================
// DataTable Types
// =============================================================================

export interface DataTableProps<TData> {
    // Data
    data: TData[];
    columns: ColumnDef<TData>[];
    isLoading?: boolean;
    isPlaceholderData?: boolean; // For flash prevention with keepPreviousData

    // Pagination (server-side)
    pagination: PaginationState;
    onPaginationChange: (updater: PaginationState | ((prev: PaginationState) => PaginationState)) => void;
    pageCount: number;
    totalRows: number;
    pageSizeOptions?: number[];

    // Cursor Pagination (optional - overrides default navigation)
    // When provided, these handlers are used instead of TanStack's built-in methods
    cursorPagination?: {
        hasNextPage: boolean;
        hasPrevPage: boolean;
        onNextPage: () => void;
        onPrevPage: () => void;
        onFirstPage: () => void;
        onLastPage?: () => void;
        onPageSizeChange?: (size: number) => void;
    };

    // Server-side sorting (controlled)
    sorting?: SortingState;
    onSortingChange?: (updater: Updater<SortingState>) => void;

    // Row identity
    getRowId?: (row: TData) => string;

    // Selection
    enableRowSelection?: boolean;
    rowSelection?: RowSelectionState;
    onRowSelectionChange?: (updater: RowSelectionState | ((prev: RowSelectionState) => RowSelectionState)) => void;

    // Column features
    enableColumnPinning?: boolean;
    initialColumnPinning?: ColumnPinningState;
    columnVisibility?: VisibilityState;
    onColumnVisibilityChange?: (updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => void;
    columnPinning?: ColumnPinningState;
    onColumnPinningChange?: (updater: ColumnPinningState | ((prev: ColumnPinningState) => ColumnPinningState)) => void;

    // Row interactions
    onRowClick?: (row: TData) => void;
    onRowHover?: (row: TData) => void;

    // Virtualization
    enableVirtualization?: boolean;
    estimatedRowHeight?: number;

    // Empty state
    emptyIcon?: JSX.Element;
    emptyMessage?: string;
    emptyDescription?: string;

    // Expose table instance for external control (e.g., column configuration)
    tableRef?: (table: Table<TData>) => void;

    // Custom class for container
    class?: string;
}

// =============================================================================
// DataTable Component
// =============================================================================

export function DataTable<TData>(props: DataTableProps<TData>): JSX.Element {
    // Split props for cleaner access
    const [local] = splitProps(props, [
        'data',
        'columns',
        'isLoading',
        'isPlaceholderData',
        'pagination',
        'onPaginationChange',
        'pageCount',
        'totalRows',
        'pageSizeOptions',
        'cursorPagination',
        'sorting',
        'onSortingChange',
        'getRowId',
        'enableRowSelection',
        'rowSelection',
        'onRowSelectionChange',
        'enableColumnPinning',
        'initialColumnPinning',
        'columnVisibility',
        'onColumnVisibilityChange',
        'columnPinning',
        'onColumnPinningChange',
        'onRowClick',
        'onRowHover',
        'enableVirtualization',
        'estimatedRowHeight',
        'emptyIcon',
        'emptyMessage',
        'emptyDescription',
        'tableRef',
        'class',
    ]);

    // Cursor pagination helpers - use cursor handlers if provided, otherwise use table methods
    const useCursor = () => !!local.cursorPagination;
    const canGoNext = () => useCursor() ? local.cursorPagination!.hasNextPage : table.getCanNextPage();
    const canGoPrev = () => useCursor() ? local.cursorPagination!.hasPrevPage : table.getCanPreviousPage();
    const goNext = () => useCursor() ? local.cursorPagination!.onNextPage() : table.nextPage();
    const goPrev = () => useCursor() ? local.cursorPagination!.onPrevPage() : table.previousPage();
    const goFirst = () => useCursor() ? local.cursorPagination!.onFirstPage() : table.setPageIndex(0);
    const goLast = () => {
        if (useCursor()) {
            return local.cursorPagination!.onLastPage?.();
        }
        return table.setPageIndex(table.getPageCount() - 1);
    };
    const hasLastPage = () => useCursor() ? !!local.cursorPagination!.onLastPage : true;

    // Internal state (used when not controlled externally)
    const [internalSorting, setInternalSorting] = createSignal<SortingState>([]);
    const [internalColumnVisibility, setInternalColumnVisibility] = createSignal<VisibilityState>({});
    const [internalColumnPinning, setInternalColumnPinning] = createSignal<ColumnPinningState>(
        local.initialColumnPinning ?? { left: [], right: [] }
    );

    // Use controlled or internal state
    const currentSorting = () => local.sorting ?? internalSorting();
    const columnVisibility = () => local.columnVisibility ?? internalColumnVisibility();
    const columnPinning = () => local.columnPinning ?? internalColumnPinning();

    // Container ref for virtualization
    let tableContainerRef: HTMLDivElement | undefined;

    // Create table instance
    const table = createSolidTable({
        get data() { return local.data; },
        columns: local.columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getRowId: local.getRowId ?? ((row: any) => String(row.id)),

        // Sorting — server-side when controlled, client-side when not
        manualSorting: !!local.onSortingChange,
        onSortingChange: (updater) => {
            if (local.onSortingChange) {
                local.onSortingChange(updater);
            } else {
                setInternalSorting((prev) =>
                    typeof updater === 'function' ? updater(prev) : updater
                );
            }
        },

        // Selection
        enableRowSelection: local.enableRowSelection ?? false,
        onRowSelectionChange: local.onRowSelectionChange as any,

        // Visibility
        onColumnVisibilityChange: (updater) => {
            if (local.onColumnVisibilityChange) {
                local.onColumnVisibilityChange(updater as any);
            } else {
                setInternalColumnVisibility((prev) =>
                    typeof updater === 'function' ? updater(prev) : updater
                );
            }
        },

        // Column Pinning
        enableColumnPinning: local.enableColumnPinning ?? true,
        onColumnPinningChange: (updater) => {
            const handlePinning = (prev: ColumnPinningState) => {
                const newState = typeof updater === 'function' ? updater(prev) : updater;
                // Keep 'actions' always at the end of right pinned columns
                if (newState.right && newState.right.length > 0) {
                    const withoutActions = newState.right.filter((id) => id !== 'actions');
                    newState.right = [...withoutActions, 'actions'];
                }
                return newState;
            };

            if (local.onColumnPinningChange) {
                local.onColumnPinningChange((prev) => handlePinning(prev));
            } else {
                setInternalColumnPinning(handlePinning);
            }
        },

        // Pagination (server-side)
        manualPagination: true,
        get pageCount() { return local.pageCount; },
        get rowCount() { return local.totalRows; },
        onPaginationChange: local.onPaginationChange as any,

        // State
        state: {
            get sorting() { return currentSorting(); },
            get rowSelection() { return local.rowSelection ?? {}; },
            get columnVisibility() { return columnVisibility(); },
            get columnPinning() { return columnPinning(); },
            get pagination() { return local.pagination; },
        },
    });

    // Expose table instance to parent
    onMount(() => {
        local.tableRef?.(table);
    });

    // Virtualizer for rows
    const rowVirtualizer = createMemo(() => {
        if (!local.enableVirtualization || !tableContainerRef) return null;

        return createVirtualizer({
            count: table.getRowModel().rows.length,
            getScrollElement: () => tableContainerRef!,
            estimateSize: () => local.estimatedRowHeight ?? 52,
            overscan: 5,
        });
    });

    // Get visible rows (virtualized or all)
    const visibleRows = createMemo(() => {
        const allRows = table.getRowModel().rows;
        const virtualizer = rowVirtualizer();

        if (!virtualizer) return allRows;

        return virtualizer.getVirtualItems().map((virtualRow) => ({
            virtualRow,
            row: allRows[virtualRow.index],
        }));
    });

    // Pagination options
    const pageSizes = () => local.pageSizeOptions ?? [10, 20, 30, 50];

    return (
        <div class={`flex flex-col h-full ${local.class ?? ''} ${local.isPlaceholderData ? 'opacity-60 pointer-events-none' : ''}`}>
            {/* Table Container with Virtual Scroll */}
            <div
                ref={tableContainerRef}
                class="flex-1 overflow-auto relative transition-opacity duration-150"
                style={local.enableVirtualization ? { contain: 'strict' } : undefined}
            >
                <TableRoot>
                    {/* Header */}
                    <TableHeader class="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                        <For each={table.getHeaderGroups()}>
                            {(headerGroup) => (
                                <TableRow>
                                    <For each={headerGroup.headers}>
                                        {(header) => {
                                            const { className: pinClasses, style: pinStyles } = getCommonPinningStyles(header.column);
                                            const isPinned = header.column.getIsPinned();

                                            return (
                                                <TableHead
                                                    class={`text-xs uppercase tracking-wider text-muted font-semibold ${pinClasses} ${isPinned ? 'z-[30]' : ''}`}
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

                    {/* Body */}
                    <TableBody
                        style={
                            local.enableVirtualization && rowVirtualizer()
                                ? { height: `${rowVirtualizer()!.getTotalSize()}px`, position: 'relative' }
                                : undefined
                        }
                    >
                        <Show
                            when={!local.isLoading}
                            fallback={
                                <For each={Array(8).fill(0)}>
                                    {() => (
                                        <TableRow class="hover:bg-transparent">
                                            <For each={table.getVisibleLeafColumns()}>
                                                {(col) => {
                                                    const { className: pinClasses, style: pinStyles } = getCommonPinningStyles(col);
                                                    return (
                                                        <TableCell class={pinClasses} style={pinStyles}>
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
                                when={table.getRowModel().rows.length > 0}
                                fallback={
                                    <TableRow>
                                        <TableCell colSpan={local.columns.length} class="h-96">
                                            <EmptyState
                                                icon={local.emptyIcon}
                                                message={local.emptyMessage ?? 'No hay datos'}
                                                description={local.emptyDescription ?? 'No se encontraron registros'}
                                            />
                                        </TableCell>
                                    </TableRow>
                                }
                            >
                                <Show
                                    when={local.enableVirtualization && rowVirtualizer()}
                                    fallback={
                                        // Non-virtualized rows
                                        <For each={table.getRowModel().rows}>
                                            {(row) => (
                                                <DataTableRow
                                                    row={row}
                                                    onRowClick={local.onRowClick}
                                                    onRowHover={local.onRowHover}
                                                />
                                            )}
                                        </For>
                                    }
                                >
                                    {/* Virtualized rows */}
                                    <For each={rowVirtualizer()!.getVirtualItems()}>
                                        {(virtualRow) => {
                                            const row = table.getRowModel().rows[virtualRow.index];
                                            return (
                                                <DataTableRow
                                                    row={row}
                                                    onRowClick={local.onRowClick}
                                                    onRowHover={local.onRowHover}
                                                    virtualRow={virtualRow}
                                                    measureElement={rowVirtualizer()!.measureElement}
                                                />
                                            );
                                        }}
                                    </For>
                                </Show>
                            </Show>
                        </Show>
                    </TableBody>
                </TableRoot>
            </div>

            {/* Pagination Controls */}
            <div class="flex-shrink-0 p-4 border-t border-border bg-card">
                <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* <div class="flex-1 text-sm text-muted-foreground order-2 sm:order-1">
                        <Show
                            when={local.enableRowSelection && table.getFilteredSelectedRowModel().rows.length > 0}
                            fallback={<span class="hidden sm:inline">Total: {local.totalRows} registros</span>}
                        >
                            <span>
                                {table.getFilteredSelectedRowModel().rows.length} de {table.getFilteredRowModel().rows.length} fila(s) seleccionada(s).
                            </span>
                        </Show>
                    </div> */}

                    <div class="flex items-center gap-4 lg:gap-8 order-1 sm:order-2">
                        {/* Page size selector */}
                        <div class="flex items-center gap-2">
                            <p class="text-sm font-medium text-muted hidden sm:inline">Filas por página</p>
                            <Select
                                value={local.pagination.pageSize}
                                onChange={(val) => {
                                    const size = Number(val);
                                    if (useCursor() && local.cursorPagination?.onPageSizeChange) {
                                        local.cursorPagination.onPageSizeChange(size);
                                    } else {
                                        table.setPageSize(size);
                                    }
                                }}
                                options={pageSizes()}
                                itemComponent={(itemProps) => (
                                    <SelectItem item={itemProps.item}>{itemProps.item.rawValue}</SelectItem>
                                )}
                            >
                                <SelectTrigger class="h-8 w-[70px]">
                                    <SelectValue<number>>{(state) => state.selectedOption()}</SelectValue>
                                </SelectTrigger>
                                <SelectContent />
                            </Select>
                        </div>

                        {/* Page indicator - show different text for cursor mode */}


                        {/* Navigation buttons */}
                        <div class="flex items-center gap-1.5">
                            <Button
                                variant="outline"
                                size="icon_md"
                                class="hidden lg:flex"
                                onClick={goFirst}
                                disabled={!canGoPrev()}
                            >
                                <span class="sr-only">Primera página</span>
                                <ChevronsLeftIcon class="size-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon_md"
                                onClick={goPrev}
                                disabled={!canGoPrev()}
                            >
                                <span class="sr-only">Anterior</span>
                                <ChevronLeftIcon class="size-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon_md"
                                onClick={goNext}
                                disabled={!canGoNext()}
                            >
                                <span class="sr-only">Siguiente</span>
                                <ChevronRightIcon class="size-4" />
                            </Button>
                            {/* Last page button - show for offset pagination or cursor with edges */}
                            <Show when={hasLastPage()}>
                                <Button
                                    variant="outline"
                                    size="icon_md"
                                    class="hidden lg:flex"
                                    onClick={goLast}
                                    disabled={!canGoNext()}
                                >
                                    <span class="sr-only">Última página</span>
                                    <ChevronsRightIcon class="size-4" />
                                </Button>
                            </Show>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// DataTableRow Component (extracted for virtualization)
// =============================================================================

interface DataTableRowProps<TData> {
    row: Row<TData>;
    onRowClick?: (row: TData) => void;
    onRowHover?: (row: TData) => void;
    virtualRow?: { start: number; size: number; index: number };
    measureElement?: (el: HTMLElement | null) => void;
}

function DataTableRow<TData>(props: DataTableRowProps<TData>): JSX.Element {
    const isSelected = () => props.row.getIsSelected();

    return (
        <TableRow
            ref={(el) => props.measureElement?.(el)}
            data-index={props.virtualRow?.index}
            class={`cursor-pointer group ${isSelected()
                ? 'row-selected bg-row-selected hover:bg-row-selected-hover'
                : 'hover:bg-table-hover'
                }`}
            style={
                props.virtualRow
                    ? {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${props.virtualRow.start}px)`,
                    }
                    : undefined
            }
            onClick={() => props.onRowClick?.(props.row.original)}
            onMouseEnter={() => props.onRowHover?.(props.row.original)}
        >
            <For each={props.row.getVisibleCells()}>
                {(cell) => {
                    const { className: pinClasses, style: pinStyles } = getCommonPinningStyles(cell.column);

                    return (
                        <TableCell
                            class={`group-[.row-selected]:bg-row-selected group-[&:not(.row-selected)]:group-hover:bg-table-hover group-[.row-selected]:group-hover:bg-row-selected-hover ${pinClasses}`}
                            style={pinStyles}
                            onClick={(e) => cell.column.id === 'select' && e.stopPropagation()}
                        >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                    );
                }}
            </For>
        </TableRow>
    );
}

// =============================================================================
// Exports
// =============================================================================

export { getCommonPinningStyles };
export type { DataTableRowProps };
