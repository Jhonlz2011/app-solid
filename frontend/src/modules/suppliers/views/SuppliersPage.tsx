/**
 * SuppliersPage - Optimized with Cursor Pagination & 2026 UI Patterns
 *
 * Features:
 * - Cursor-based pagination (O(1) performance)
 * - Auto-prefetch of next AND previous pages
 * - First/Last page navigation via edges endpoint
 * - Column visibility and pinning configuration
 * - Optimistic mutations for instant feedback
 * - Flash-free page transitions with keepPreviousData
 */
import { Component, Show, createSignal, createMemo, batch, For, createEffect } from 'solid-js';
import type { Table, RowSelectionState, ColumnPinningState, VisibilityState, SortingState, Updater } from '@tanstack/solid-table';
import { toast } from 'solid-sonner';
import { useNavigate, Outlet } from '@tanstack/solid-router';
import { useQueryClient } from '@tanstack/solid-query';

// Data & Hooks
import {
    useSuppliers,
    useDeleteSupplier,
    useBulkDeleteSupplier,
    useSupplierFacets,
    supplierKeys,
    suppliersApi,
    type SupplierFilters,
    type FacetData,
} from '../data/suppliers.api';
import { createSupplierColumns } from '../data/supplier.columns';
import { useDataTableWebSocket } from '@shared/hooks/useDataTableWebSocket';
import type { SupplierListItem } from '../data/suppliers.api';
import { taxIdTypeLabels, personTypeLabels, isActiveLabels } from '../models/supplier.types';

// UI Components
import { DataTable } from '@shared/ui/DataTable';
import { PageHeader } from '@shared/ui/PageHeader';
import { SearchInput } from '@shared/ui/SearchInput';
import { DropdownMenu } from '@shared/ui/DropdownMenu';
import { DataTableSelectionBar, SelectionBarAction, SelectionBarSeparator } from '@shared/ui/DataTableSelectionBar';
import Button from '@shared/ui/Button';
import Switch from '@shared/ui/Switch';
import ConfirmDialog from '@shared/ui/ConfirmDialog';

// Icons
import {
    PlusIcon,
    TrashIcon,
    ColumnsIcon,
    UsersIcon,
    PinIcon,
    EyeIcon,
    EyeOffIcon,
    PinOffIcon,
    DownloadIcon,
} from '@shared/ui/icons';

const SuppliersPage: Component = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // ==========================================================================
    // State - Hybrid Pagination (cursor + offset for sorted views)
    // ==========================================================================
    const [search, setSearch] = createSignal('');
    const [pageSize, setPageSize] = createSignal(10);
    const [cursor, setCursor] = createSignal<string | undefined>(undefined);
    const [direction, setDirection] = createSignal<'first' | 'next' | 'prev' | 'last'>('first');

    // Server-side sorting
    const [sorting, setSorting] = createSignal<SortingState>([]);
    // Page for offset mode (1-indexed)
    const [page, setPage] = createSignal(1);

    // UI State
    const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});
    const [columnVisibility, setColumnVisibility] = createSignal<VisibilityState>({});
    const [columnPinning, setColumnPinning] = createSignal<ColumnPinningState>({
        left: ['select'],
        right: ['actions'],
    });

    // Column Filter State
    const [personTypeFilter, setPersonTypeFilter] = createSignal<string[]>([]);
    const [taxIdTypeFilter, setTaxIdTypeFilter] = createSignal<string[]>([]);
    const [isActiveFilter, setIsActiveFilter] = createSignal<string[]>([]);
    const [businessNameFilter, setBusinessNameFilter] = createSignal<string[]>([]);

    // Table instance ref for column configuration
    const [tableInstance, setTableInstance] = createSignal<Table<SupplierListItem>>();

    // ==========================================================================
    // WebSocket Real-time Updates
    // ==========================================================================
    useDataTableWebSocket({
        room: 'suppliers',
        queryKey: supplierKeys.lists(),
    });

    // ==========================================================================
    // Derived: Sort params & pagination mode
    // ==========================================================================
    const sortBy = () => sorting().length > 0 ? sorting()[0].id : undefined;
    const sortOrder = () => sorting().length > 0 ? (sorting()[0].desc ? 'desc' as const : 'asc' as const) : undefined;
    /** True when sorting by a non-default column → use offset pagination */
    const isSortedMode = () => !!sortBy() && sortBy() !== 'id';

    // ==========================================================================
    // Query Filters
    // ==========================================================================
    const filters = (): SupplierFilters => ({
        // Cursor params (only for default sort)
        cursor: isSortedMode() ? undefined : cursor(),
        direction: isSortedMode() ? undefined : direction(),
        // Offset params (only for sorted views)
        sortBy: sortBy(),
        sortOrder: sortOrder(),
        page: isSortedMode() ? page() : undefined,
        // Shared
        limit: pageSize(),
        search: search() || undefined,
        personType: personTypeFilter().length > 0 ? personTypeFilter() : undefined,
        taxIdType: taxIdTypeFilter().length > 0 ? taxIdTypeFilter() : undefined,
        isActive: isActiveFilter().length > 0 ? isActiveFilter() : undefined,
        businessName: businessNameFilter().length > 0 ? businessNameFilter() : undefined,
    });

    // ==========================================================================
    // Queries & Mutations
    // ==========================================================================
    const suppliersQuery = useSuppliers(filters);
    const facetsQuery = useSupplierFacets(
        () => search() || undefined,
        () => ({
            personType: personTypeFilter().length > 0 ? personTypeFilter() : undefined,
            taxIdType: taxIdTypeFilter().length > 0 ? taxIdTypeFilter() : undefined,
            isActive: isActiveFilter().length > 0 ? isActiveFilter() : undefined,
            businessName: businessNameFilter().length > 0 ? businessNameFilter() : undefined,
        })
    );

    const deleteMutation = useDeleteSupplier();
    const bulkDeleteMutation = useBulkDeleteSupplier();

    // ==========================================================================
    // Derived Data
    // ==========================================================================
    const suppliers = () => suppliersQuery.data?.data ?? [];
    const meta = () => suppliersQuery.data?.meta;
    const totalRows = () => meta()?.total ?? 0;
    const hasNextPage = () => meta()?.hasNextPage ?? false;
    const hasPrevPage = () => meta()?.hasPrevPage ?? false;
    const selectedCount = () => Object.keys(rowSelection()).length;

    // Clamp page to valid range when pageCount changes (e.g. after sort change)
    createEffect(() => {
        const pageCount = meta()?.pageCount;
        if (pageCount && page() > pageCount) {
            setPage(Math.max(1, pageCount));
        }
    });

    // ==========================================================================
    // Pagination Handlers - Hybrid (cursor + offset)
    // ==========================================================================
    const handleSearchInput = (value: string) => {
        batch(() => {
            setSearch(value);
            setCursor(undefined);
            setDirection('first');
            setPage(1);
            // Reset column filters on search change
            setPersonTypeFilter([]);
            setTaxIdTypeFilter([]);
            setIsActiveFilter([]);
            setBusinessNameFilter([]);
        });
    };

    const handleFirstPage = () => {
        batch(() => {
            setCursor(undefined);
            setDirection('first');
            setPage(1);
            setRowSelection({});
        });
    };

    const handleLastPage = () => {
        if (isSortedMode()) {
            const pageCount = meta()?.pageCount ?? 1;
            batch(() => {
                setPage(pageCount);
                setRowSelection({});
            });
        } else {
            batch(() => {
                setCursor(undefined);
                setDirection('last');
                setRowSelection({});
            });
        }
    };

    const handleNextPage = () => {
        if (isSortedMode()) {
            batch(() => {
                setPage(p => p + 1);
                setRowSelection({});
            });
        } else {
            const nextCursor = meta()?.nextCursor;
            if (nextCursor) {
                batch(() => {
                    setCursor(nextCursor);
                    setDirection('next');
                    setRowSelection({});
                });
            }
        }
    };

    const handlePrevPage = () => {
        if (isSortedMode()) {
            batch(() => {
                setPage(p => Math.max(1, p - 1));
                setRowSelection({});
            });
        } else {
            const prevCursor = meta()?.prevCursor;
            if (prevCursor) {
                batch(() => {
                    setCursor(prevCursor);
                    setDirection('prev');
                    setRowSelection({});
                });
            }
        }
    };

    const handlePageSizeChange = (size: number) => {
        batch(() => {
            setPageSize(size);
            setCursor(undefined);
            setDirection('first');
            setPage(1);
        });
    };

    /** Controlled sorting handler — keeps current page position (clamped) */
    const handleSortingChange = (updater: Updater<SortingState>) => {
        batch(() => {
            const newSorting = typeof updater === 'function' ? updater(sorting()) : updater;
            setSorting(newSorting);
            // Keep current position but clamp page to valid range
            // Reset cursor since cursor is invalid when sort order changes
            setCursor(undefined);
            setDirection('first');
            // Don't reset page — keep position, will be clamped by pageCount on render
        });
    };

    const handleNew = () => navigate({ to: '/suppliers/new' });

    const handleEdit = (supplier: SupplierListItem) => {
        queryClient.setQueryData(supplierKeys.detail(supplier.id), supplier);
        navigate({ to: `/suppliers/edit/${supplier.id}` });
    };

    const handleView = (supplier: SupplierListItem) => {
        queryClient.setQueryData(supplierKeys.detail(supplier.id), supplier);
        navigate({ to: `/suppliers/show/${supplier.id}` });
    };

    const handlePrefetch = (supplier: SupplierListItem) => {
        queryClient.prefetchQuery({
            queryKey: supplierKeys.detail(supplier.id),
            queryFn: () => suppliersApi.get(supplier.id),
            staleTime: 1000 * 60 * 5,
        });
    };

    // Delete confirmation state
    const [deleteTarget, setDeleteTarget] = createSignal<SupplierListItem | null>(null);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = createSignal(false);

    const handleDelete = (supplier: SupplierListItem) => {
        setDeleteTarget(supplier);
    };

    const confirmDelete = () => {
        const target = deleteTarget();
        if (!target) return;
        deleteMutation.mutate(target.id, {
            onSuccess: () => {
                toast.success('Proveedor eliminado');
                setDeleteTarget(null);
            },
            onError: (err: any) => toast.error(err.message || 'Error al eliminar'),
        });
    };

    const handleBulkDelete = () => {
        setShowBulkDeleteConfirm(true);
    };

    const confirmBulkDelete = () => {
        const ids = Object.keys(rowSelection()).map(Number);
        bulkDeleteMutation.mutate(ids, {
            onSuccess: () => {
                toast.success(`${ids.length} proveedores eliminados`);
                setRowSelection({});
                setShowBulkDeleteConfirm(false);
            },
            onError: (err: any) => toast.error(err.message || 'Error al eliminar'),
        });
    };

    /** Convert facet data to FilterOption[] with human-readable labels */
    const buildFilterOptions = (
        facetKey: string,
        labelMap?: Record<string, string>
    ) => {
        const facets = facetsQuery.data;
        if (!facets || !facets[facetKey]) return [];
        return facets[facetKey].map(f => ({
            value: f.value,
            label: labelMap?.[f.value] ?? f.value,
            count: f.count,
        }));
    };

    /** Handle filter change: reset cursor to first page */
    const handleFilterChange = (
        setter: (v: string[]) => void
    ) => (selected: string[]) => {
        batch(() => {
            setter(selected);
            setCursor(undefined);
            setDirection('first');
        });
    };

    // ==========================================================================
    // Column Definitions
    // ==========================================================================
    const columns = createMemo(() =>
        createSupplierColumns({
            onEdit: handleEdit,
            onDelete: handleDelete,
            filters: {
                businessName: {
                    options: () => buildFilterOptions('business_name'),
                    selected: businessNameFilter,
                    onChange: handleFilterChange(setBusinessNameFilter),
                    isLoading: () => facetsQuery.isPending,
                },
                taxIdType: {
                    options: () => buildFilterOptions('tax_id_type', taxIdTypeLabels),
                    selected: taxIdTypeFilter,
                    onChange: handleFilterChange(setTaxIdTypeFilter),
                    isLoading: () => facetsQuery.isPending,
                },
                personType: {
                    options: () => buildFilterOptions('person_type', personTypeLabels),
                    selected: personTypeFilter,
                    onChange: handleFilterChange(setPersonTypeFilter),
                    isLoading: () => facetsQuery.isPending,
                },
                isActive: {
                    options: () => buildFilterOptions('is_active', isActiveLabels),
                    selected: isActiveFilter,
                    onChange: handleFilterChange(setIsActiveFilter),
                    isLoading: () => facetsQuery.isPending,
                },
            },
        })
    );

    const configurableColumns = () => {
        const table = tableInstance();
        if (!table) return [];
        return table.getAllLeafColumns().filter(col => col.getCanHide() || col.getCanPin());
    };

    const hasCustomPinnedColumns = () => {
        const table = tableInstance();
        if (!table) return false;
        return table.getAllLeafColumns().some(
            col => col.getIsPinned() && col.id !== 'select' && col.id !== 'actions'
        );
    };

    // ==========================================================================
    // Render
    // ==========================================================================
    return (
        <div class="h-full flex flex-col bg-gradient-to-br from-background via-background to-surface/20">
            {/* Header */}
            <div class="flex-shrink-0 p-5 space-y-5">
                <PageHeader
                    icon={<UsersIcon />}
                    iconBg="linear-gradient(135deg, #10b981, #059669)"
                    title="Proveedores"
                    count={totalRows()}
                    info="Gestiona los proveedores de tu negocio. Puedes agregar, editar, eliminar y buscar proveedores."
                    actions={
                        <Button onClick={handleNew} icon={<PlusIcon />}>
                            Nuevo Proveedor
                        </Button>
                    }
                />

                {/* Toolbar */}
                <div class="flex flex-wrap items-center gap-3">
                    <SearchInput
                        value={search()}
                        onSearch={handleSearchInput}
                        placeholder="Buscar proveedores..."
                        class="flex-1 min-w-[200px] max-w-md"
                    />

                    {/* Column Settings */}
                    <DropdownMenu placement="bottom-end">
                        <DropdownMenu.Trigger class="btn btn-ghost gap-2">
                            <ColumnsIcon />
                            <span class="hidden sm:inline">Columnas</span>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content class="min-w-[280px] p-2">
                            <DropdownMenu.Label class="text-xs font-semibold text-muted tracking-wider mb-2">
                                Visibilidad de columnas
                            </DropdownMenu.Label>

                            <div class="max-h-[320px] overflow-y-auto">
                                <For each={configurableColumns()}>
                                    {(column) => {
                                        const isPinned = () => column.getIsPinned();
                                        const canPin = () => column.getCanPin();
                                        const canHide = () => column.getCanHide();
                                        const isVisible = () => column.getIsVisible();
                                        const title = () => (column.columnDef.meta as { title?: string })?.title ?? column.id;

                                        return (
                                            <div class="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-surface-2 transition-colors">
                                                <span class="flex-1 text-sm text-text truncate" title={title()}>
                                                    {title()}
                                                </span>

                                                <Show when={canPin()}>
                                                    <div class="flex items-center gap-0.5 bg-surface rounded-md p-0.5">
                                                        <button
                                                            onClick={() => column.pin(isPinned() === 'left' ? false : 'left')}
                                                            class={`p-1 rounded transition-colors ${isPinned() === 'left'
                                                                ? 'bg-primary text-white'
                                                                : 'text-muted hover:text-text hover:bg-surface-2'
                                                                }`}
                                                            title={isPinned() === 'left' ? 'Desfijar' : 'Fijar izquierda'}
                                                        >
                                                            <PinIcon class="size-3.5 rotate-45" />
                                                        </button>
                                                        <button
                                                            onClick={() => column.pin(isPinned() === 'right' ? false : 'right')}
                                                            class={`p-1 rounded transition-colors ${isPinned() === 'right'
                                                                ? 'bg-primary text-white'
                                                                : 'text-muted hover:text-text hover:bg-surface-2'
                                                                }`}
                                                            title={isPinned() === 'right' ? 'Desfijar' : 'Fijar derecha'}
                                                        >
                                                            <PinIcon class="size-3.5 -rotate-45" />
                                                        </button>
                                                    </div>
                                                </Show>

                                                <Show when={canHide()}>
                                                    <Switch
                                                        checked={isVisible()}
                                                        onChange={column.toggleVisibility}
                                                        aria-label={`Mostrar/ocultar ${title()}`}
                                                    />
                                                </Show>
                                            </div>
                                        );
                                    }}
                                </For>
                            </div>

                            <DropdownMenu.Separator class="my-2" />
                            <div class="flex flex-col gap-2 p-1">
                                <div class="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="flex-1 text-xs h-8 px-2"
                                        onClick={() => tableInstance()?.getAllLeafColumns().forEach(col => col.getCanHide() && col.toggleVisibility(true))}
                                        icon={<EyeIcon class="size-3.5" />}
                                    >
                                        Mostrar todo
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="flex-1 text-xs h-8 px-2"
                                        onClick={() => tableInstance()?.getAllLeafColumns().forEach(col => col.getCanHide() && col.toggleVisibility(false))}
                                        icon={<EyeOffIcon class="size-3.5" />}
                                    >
                                        Ocultar todo
                                    </Button>
                                </div>
                                <Show when={hasCustomPinnedColumns()}>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        class="w-full justify-start text-xs h-8 font-normal text-muted hover:text-primary px-2"
                                        onClick={() => tableInstance()?.getAllLeafColumns().forEach(col => {
                                            if (col.id !== 'select' && col.id !== 'actions') col.pin(false);
                                        })}
                                        icon={<PinOffIcon class="size-3.5" />}
                                    >
                                        Restablecer fijado
                                    </Button>
                                </Show>
                            </div>
                        </DropdownMenu.Content>
                    </DropdownMenu>
                </div>
            </div>



            {/* DataTable */}
            <div class="flex-1 min-h-0 px-5 pb-5 overflow-hidden">
                <div class="bg-card border border-border rounded-2xl shadow-card-soft h-full overflow-hidden">
                    <DataTable
                        data={suppliers()}
                        columns={columns()}
                        isLoading={suppliersQuery.isPending}
                        isPlaceholderData={suppliersQuery.isPlaceholderData}
                        // Pagination state (for display)
                        pagination={{ pageIndex: 0, pageSize: pageSize() }}
                        onPaginationChange={() => { }}
                        pageCount={1}
                        totalRows={totalRows()}
                        // Cursor Pagination handlers with edges support
                        cursorPagination={{
                            hasNextPage: hasNextPage(),
                            hasPrevPage: hasPrevPage(),
                            onNextPage: handleNextPage,
                            onPrevPage: handlePrevPage,
                            onFirstPage: handleFirstPage,
                            onLastPage: handleLastPage,
                            onPageSizeChange: handlePageSizeChange,
                        }}
                        // Server-side sorting
                        sorting={sorting()}
                        onSortingChange={handleSortingChange}
                        // Selection
                        enableRowSelection={true}
                        rowSelection={rowSelection()}
                        onRowSelectionChange={setRowSelection}
                        getRowId={(row) => String(row.id)}
                        // Column configuration
                        enableColumnPinning={true}
                        columnVisibility={columnVisibility()}
                        onColumnVisibilityChange={setColumnVisibility}
                        columnPinning={columnPinning()}
                        onColumnPinningChange={setColumnPinning}
                        // Row interactions
                        onRowClick={handleView}
                        onRowHover={handlePrefetch}
                        // Virtualization
                        enableVirtualization={false}
                        estimatedRowHeight={56}
                        // Empty state
                        emptyIcon={<UsersIcon />}
                        emptyMessage="No hay proveedores"
                        emptyDescription="Crea uno nuevo para comenzar"
                        // Table instance ref
                        tableRef={(table) => { setTableInstance(table); }}
                    />
                </div>
            </div>

            {/* Floating Selection Action Bar */}
            <DataTableSelectionBar
                selectedCount={selectedCount()}
                totalRows={totalRows()}
                onClearSelection={() => setRowSelection({})}
            >
                <SelectionBarAction
                    icon={<DownloadIcon class="size-4" />}
                    label="Exportar"
                    onClick={() => toast.info('Exportación no implementada aún')}
                />
                <SelectionBarSeparator />
                <SelectionBarAction
                    icon={<TrashIcon class="size-4" />}
                    label="Eliminar"
                    variant="danger"
                    onClick={handleBulkDelete}
                    loading={bulkDeleteMutation.isPending}
                    loadingText="Eliminando..."
                />
            </DataTableSelectionBar>

            {/* Delete Confirmation Dialogs */}
            <ConfirmDialog
                isOpen={!!deleteTarget()}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDelete}
                title="¿Eliminar proveedor?"
                description={`Se desactivará el proveedor "${deleteTarget()?.business_name}". Esta acción se puede revertir.`}
                confirmLabel="Eliminar"
                isLoading={deleteMutation.isPending}
            />

            <ConfirmDialog
                isOpen={showBulkDeleteConfirm()}
                onClose={() => setShowBulkDeleteConfirm(false)}
                onConfirm={confirmBulkDelete}
                title={`¿Eliminar ${Object.keys(rowSelection()).length} proveedores?`}
                description="Se desactivarán los proveedores seleccionados. Esta acción no se puede deshacer."
                confirmLabel="Eliminar todos"
                isLoading={bulkDeleteMutation.isPending}
            />

            {/* Child routes (Panels) */}
            <Outlet />
        </div>
    );
};

export default SuppliersPage;
