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
import { Component, Show, createSignal, createMemo, batch, For, createEffect, lazy } from 'solid-js';
import type { Table, RowSelectionState, ColumnPinningState, VisibilityState, SortingState, Updater } from '@tanstack/solid-table';
import { toast } from 'solid-sonner';
import { useNavigate, Outlet, useSearch } from '@tanstack/solid-router';

// Lazy Components
const LazyUserNewSheet = lazy(() => import('../../users/components/UserNewSheet'));
import { useQueryClient } from '@tanstack/solid-query';

// Data & Hooks
import {
    useSuppliers,
    useDeleteSupplier,
    useBulkDeleteSupplier,
    useBulkRestoreSupplier,
    useRestoreSupplier,
    useSupplierFacets,
    supplierKeys,
    suppliersApi,
    type SupplierFilters,
} from '../data/suppliers.api';
import { createSupplierColumns } from '../data/supplier.columns';
import { useDataTableSSE, useRealtimeInvalidation } from '@shared/hooks/useDataTableSSE';
import type { SupplierListItem } from '../data/suppliers.api';
import { taxIdTypeLabels, personTypeLabels, isActiveLabels } from '../models/supplier.types';
import { useAuth } from '@/modules/auth/store/auth.store';

// UI Components
import { DataTable } from '@shared/ui/DataTable';
import { PageHeader } from '@shared/ui/PageHeader';
import { SearchInput } from '@shared/ui/SearchInput';
import { DropdownMenu } from '@shared/ui/DropdownMenu';
import { DataTableSelectionBar, SelectionBarAction, SelectionBarSeparator } from '@shared/ui/DataTable/DataTableSelectionBar';
import Button from '@shared/ui/Button';
import Switch from '@shared/ui/Switch';
import ConfirmDialog from '@shared/ui/ConfirmDialog';
import SupplierDeleteDialog from '../components/SupplierDeleteDialog';
import { SupplierCardList } from '../components/SupplierCardList';
import { SupplierFilterSheet } from '../components/SupplierFilterSheet';
import { useIsMobile } from '@shared/hooks/useIsMobile';

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
    UploadIcon,
    FilterIcon,
    CopyIcon,
    RotateCcwIcon,
    ChevronsUpDownIcon,
} from '@shared/ui/icons';

const SuppliersPage: Component = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const auth = useAuth();
    const [showFilterSheet, setShowFilterSheet] = createSignal(false);
    
    // Cross-Module Modals
    const searchParams = useSearch({ strict: false }) as () => { modal?: string; [key: string]: any };
    const openUserModal = () => navigate({ to: '/suppliers', search: (prev: any) => ({ ...prev, modal: 'newUser' }) });
    const closeAllModals = () => navigate({ to: '/suppliers', search: (prev: any) => ({ ...prev, modal: undefined }) });

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
    // Lists invalidation (smart: cursor-aware page targeting)
    useDataTableSSE({
        room: 'suppliers',
        queryKey: supplierKeys.lists(),
    });
    // Facets invalidation: passes prefix ['suppliers', 'facets'] so ALL facet variants
    // (regardless of active search/filter params) get invalidated via hierarchical matching.
    useRealtimeInvalidation([...supplierKeys.all, 'facets']);

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
    const bulkRestoreMutation = useBulkRestoreSupplier();
    const bulkDeleteMutation = useBulkDeleteSupplier();
    const restoreMutation = useRestoreSupplier();

    // ==========================================================================
    // Derived Data
    // ==========================================================================
    const suppliers = () => suppliersQuery.data?.data ?? [];
    const meta = () => suppliersQuery.data?.meta;
    const totalRows = () => meta()?.total ?? 0;
    const hasNextPage = () => meta()?.hasNextPage ?? false;
    const hasPrevPage = () => meta()?.hasPrevPage ?? false;
    
    // Selection state calculation
    const selectedCount = () => Object.keys(rowSelection()).length;
    const selectedSuppliers = createMemo(() => {
        const selection = rowSelection();
        return suppliers().filter(s => selection[String(s.id)]);
    });
    const selectedActiveCount = () => selectedSuppliers().filter(s => s.is_active).length;
    const selectedInactiveCount = () => selectedSuppliers().filter(s => !s.is_active).length;

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
        navigate({ to: `/suppliers/edit/${supplier.id}` });
    };

    const handleView = (supplier: SupplierListItem) => {
        navigate({ to: `/suppliers/show/${supplier.id}` });
    };

    const handlePrefetch = (supplier: SupplierListItem) => {
        queryClient.prefetchQuery({
            queryKey: supplierKeys.detail(supplier.id),
            queryFn: () => suppliersApi.get(supplier.id),
            staleTime: 1000 * 60 * 5,
        });
    };

    // Delete / Restore confirmation state
    const [deleteTarget, setDeleteTarget] = createSignal<SupplierListItem | null>(null);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = createSignal(false);
    const [showBulkRestoreConfirm, setShowBulkRestoreConfirm] = createSignal(false);
    
    // Actions
    const handleCopySelection = async () => {
        const selected = selectedSuppliers();
        if (selected.length === 0) return;

        const text = selected.map(s => {
            const parts = [
                `Nombre: ${s.business_name} (${s.tax_id})`,
                s.email_billing ? `Correo: ${s.email_billing}` : null,
                s.phone ? `Tel: ${s.phone}` : null,

            ].filter(Boolean);
            return parts.join(' | ');
        }).join('\n');
        
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                toast.success(`Copiado ${selected.length} proveedores al portapapeles`);
            } else {
                // Fallback for non-secure contexts (http)
                const textArea = document.createElement("textarea");
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    toast.success(`Copiado ${selected.length} proveedores al portapapeles`);
                } catch (err) {
                    toast.error('Error al copiar al portapapeles');
                }
                document.body.removeChild(textArea);
            }
        } catch (err) {
            toast.error('Error al copiar al portapapeles');
        }
        setRowSelection({});
    };

    const handleDelete = (supplier: SupplierListItem) => {
        setDeleteTarget(supplier);
    };

    const handleRestore = (supplier: SupplierListItem) => {
        restoreMutation.mutate(supplier.id, {
            onSuccess: () => toast.success(`Se ha restaurado '${supplier.business_name}'`),
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
        });
    };

    const handleBulkDelete = () => {
        setShowBulkDeleteConfirm(true);
    };

    const confirmBulkDelete = () => {
        // Obtenemos solo los proveedores activos seleccionados
        const ids = selectedSuppliers().filter(s => s.is_active).map(s => s.id);
        if (ids.length === 0) return;
        
        bulkDeleteMutation.mutate(ids, {
            onSuccess: () => {
                toast.success(`${ids.length} proveedores eliminados`);
                setRowSelection({});
                setShowBulkDeleteConfirm(false);
            },
            onError: (err: any) => toast.error(err.message || 'Error al eliminar'),
        });
    };

    const confirmBulkRestore = () => {
        // Obtenemos solo los proveedores inactivos seleccionados
        const ids = selectedSuppliers().filter(s => !s.is_active).map(s => s.id);
        if (ids.length === 0) return;

        bulkRestoreMutation.mutate(ids, {
            onSuccess: () => {
                toast.success(`${ids.length} proveedores restaurados`);
                setRowSelection({});
                setShowBulkRestoreConfirm(false);
            },
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
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
    // Memoized Filter Options
    // ==========================================================================
    const businessNameFilterOptions = createMemo(() => buildFilterOptions('business_name'));
    const taxIdTypeFilterOptions = createMemo(() => buildFilterOptions('tax_id_type', taxIdTypeLabels));
    const personTypeFilterOptions = createMemo(() => buildFilterOptions('person_type', personTypeLabels));
    const isActiveFilterOptions = createMemo(() => buildFilterOptions('is_active', isActiveLabels));

    // ==========================================================================
    // Column Definitions
    // ==========================================================================
    const columns = createMemo(() =>
        createSupplierColumns({
            onView: handleView,
            onEdit: handleEdit,
            onDelete: handleDelete,
            onRestore: handleRestore,
            auth,
            filters: {
                businessName: {
                    options: businessNameFilterOptions,
                    selected: businessNameFilter,
                    onChange: handleFilterChange(setBusinessNameFilter),
                    isLoading: () => facetsQuery.isPending,
                },
                taxIdType: {
                    options: taxIdTypeFilterOptions,
                    selected: taxIdTypeFilter,
                    onChange: handleFilterChange(setTaxIdTypeFilter),
                    isLoading: () => facetsQuery.isPending,
                },
                personType: {
                    options: personTypeFilterOptions,
                    selected: personTypeFilter,
                    onChange: handleFilterChange(setPersonTypeFilter),
                    isLoading: () => facetsQuery.isPending,
                },
                isActive: {
                    options: isActiveFilterOptions,
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
        return table.getAllLeafColumns().filter(
            col => col.id !== 'select' && col.id !== 'actions' && (col.getCanHide() || col.getCanPin())
        );
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
            <div class="flex-shrink-0 p-3 sm:p-4 space-y-4 sm:space-y-5">
                <PageHeader
                    icon={<UsersIcon />}
                    iconBg="linear-gradient(135deg, #10b981, #059669)"
                    title="Proveedores"
                    count={totalRows()}
                    info="Gestiona los proveedores de tu negocio. Puedes agregar, editar, eliminar y buscar proveedores."
                    actions={
                        <div class="flex items-center gap-2">
                            <Button variant="outline" icon={<UploadIcon />} onClick={() => toast.info('Importación próximamente')}>
                                <span class="hidden sm:inline">Importar</span>
                            </Button>
                            <Button 
                                variant="outline" 
                                icon={<UsersIcon />}
                                onMouseEnter={() => import('../../users/components/UserNewSheet')}
                                onClick={openUserModal}
                            >
                                <span class="hidden sm:inline">Nuevo Usuario</span>
                            </Button>
                            <Button 
                                onClick={handleNew} 
                                onMouseEnter={() => import('../components/SupplierNewSheet')}
                                icon={<PlusIcon />}
                            >
                                <span class="hidden sm:inline">Nuevo</span>
                            </Button>
                        </div>
                    }
                />

                {/* Toolbar */}
                <div class="flex flex-wrap items-center gap-2 sm:gap-3">
                    <SearchInput
                        value={search()}
                        onSearch={handleSearchInput}
                        placeholder="Buscar proveedores..."
                        class="flex-1 w-full min-w-[150px] max-w-md"
                    />

                    <div class="flex items-center gap-2">
                            {/* Export — always visible */}
                            <Button variant="ghost" icon={<DownloadIcon />} onClick={() => toast.info('Exportación próximamente')}>
                                <span class="hidden sm:inline">Exportar</span>
                            </Button>

                            {/* Mobile: Filter button (replaces Columns dropdown) */}
                            <Show when={isMobile()}>
                                <Button
                                    variant="ghost"
                                    class="relative"
                                    icon={<FilterIcon />}
                                    onClick={() => setShowFilterSheet(true)}
                                >
                                    <span class="hidden sm:inline">Filtros</span>
                                    <Show when={
                                        personTypeFilter().length > 0 ||
                                        taxIdTypeFilter().length > 0 ||
                                        isActiveFilter().length > 0 ||
                                        businessNameFilter().length > 0
                                    }>
                                        <span class="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary" />
                                    </Show>
                                </Button>
                            </Show>

                            {/* Desktop: Columns dropdown */}
                            <Show when={!isMobile()}>
                                <DropdownMenu placement="bottom-end">
                            <DropdownMenu.Trigger class="h-9.5 px-4" variant="ghost">
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
                                                            aria-label={isPinned() === 'left' ? `Desfijar` : `Fijar columna a la izquierda`}
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
                                                            aria-label={isPinned() === 'right' ? `Desfijar` : `Fijar columna a la derecha`}
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
                            </Show>
                        </div>
            </div>
            </div>
            {/* DataTable / Card List — conditional on viewport */}
            <div class="flex-1 min-h-0 px-3 pb-3 sm:px-4 sm:pb-4 overflow-hidden">
                <div class="bg-card border border-border rounded-2xl shadow-card-soft h-full overflow-auto relative">
                    <Show
                        when={!isMobile()}
                        fallback={
                            <SupplierCardList
                                filters={filters}
                                rowSelection={rowSelection}
                                onRowSelectionChange={setRowSelection}
                                onView={handleView}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onRestore={handleRestore}
                            />
                        }
                    >
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
                        // Row interactions — hover prefetches detail, click handled per-cell
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
                    </Show>
                </div>
            </div>

            {/* Floating Selection Action Bar */}
            <DataTableSelectionBar
                selectedCount={selectedCount()}
                totalRows={totalRows()}
                onClearSelection={() => setRowSelection({})}
            >
                <SelectionBarAction
                    icon={<CopyIcon class="size-4" />}
                    label="Copiar"
                    onClick={handleCopySelection}
                    iconOnMobile
                />
                <SelectionBarSeparator />
                <Show when={selectedActiveCount() > 0 && selectedInactiveCount() === 0}>
                    
                    <SelectionBarAction
                        icon={<TrashIcon class="size-4" />}
                        label="Eliminar"
                        variant="danger"
                        onClick={handleBulkDelete}
                        loading={bulkDeleteMutation.isPending}
                        loadingText="Eliminando..."
                    />
                </Show>

                <Show when={selectedInactiveCount() > 0 && selectedActiveCount() === 0}>
                    <SelectionBarAction
                        icon={<RotateCcwIcon class="size-4" />}
                        label="Restaurar"
                        variant="success"
                        onClick={() => setShowBulkRestoreConfirm(true)}
                        loading={bulkRestoreMutation.isPending}
                        loadingText="Restaurando..."
                    />
                </Show>

                <Show when={selectedActiveCount() > 0 && selectedInactiveCount() > 0}>
                    <DropdownMenu placement="top-start">
                        <DropdownMenu.Trigger variant="ghost" size="sm" class="h-8 px-2.5 text-sm gap-1.5 focus-visible:ring-0">
                            <span>Acciones</span>
                            <ChevronsUpDownIcon class="size-3.5" />
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content class="min-w-[180px]">
                            <DropdownMenu.Item onSelect={handleBulkDelete} destructive>
                                <TrashIcon class="size-4 mr-2" />
                                <span class="flex-1 font-medium">Eliminar Activos</span>
                                <span class="bg-danger/20 text-danger font-bold text-xs px-1.5 py-0.5 rounded tabular-nums">{selectedActiveCount()}</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item onSelect={() => setShowBulkRestoreConfirm(true)}>
                                <RotateCcwIcon class="size-4 mr-2 text-emerald-500" />
                                <span class="flex-1 text-emerald-500 font-medium">Restaurar Inactivos</span>
                                <span class="bg-emerald-500/20 text-emerald-500 font-bold text-xs px-1.5 py-0.5 rounded tabular-nums">{selectedInactiveCount()}</span>
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu>
                </Show>
            </DataTableSelectionBar>

            {/* Mobile Filter Sheet */}
            <SupplierFilterSheet
                isOpen={showFilterSheet()}
                onClose={() => setShowFilterSheet(false)}
                filters={{
                    personType: {
                        options: personTypeFilterOptions,
                        selected: personTypeFilter,
                        onChange: handleFilterChange(setPersonTypeFilter),
                        isLoading: () => facetsQuery.isPending,
                    },
                    taxIdType: {
                        options: taxIdTypeFilterOptions,
                        selected: taxIdTypeFilter,
                        onChange: handleFilterChange(setTaxIdTypeFilter),
                        isLoading: () => facetsQuery.isPending,
                    },
                    isActive: {
                        options: isActiveFilterOptions,
                        selected: isActiveFilter,
                        onChange: handleFilterChange(setIsActiveFilter),
                        isLoading: () => facetsQuery.isPending,
                    },
                    businessName: {
                        options: businessNameFilterOptions,
                        selected: businessNameFilter,
                        onChange: handleFilterChange(setBusinessNameFilter),
                        isLoading: () => facetsQuery.isPending,
                    },
                }}
            />

            {/* Delete Dialog — RBAC-aware: simple for non-admins, dual-mode for suppliers:destroy */}
            <SupplierDeleteDialog
                supplier={deleteTarget()}
                onClose={() => setDeleteTarget(null)}
                onSuccess={() => toast.success('Proveedor eliminado')}
            />

            <ConfirmDialog
                isOpen={showBulkDeleteConfirm()}
                onClose={() => setShowBulkDeleteConfirm(false)}
                onConfirm={confirmBulkDelete}
                title={`Eliminar ${selectedActiveCount()} proveedores`}
                description="Los proveedores seleccionados quedarán inactivos. Podrás restaurarlos en cualquier momento."
                confirmLabel="Eliminar"
                variant="danger"
                isLoading={bulkDeleteMutation.isPending}
            />

            <ConfirmDialog
                isOpen={showBulkRestoreConfirm()}
                onClose={() => setShowBulkRestoreConfirm(false)}
                onConfirm={confirmBulkRestore}
                title={`Restaurar ${selectedInactiveCount()} proveedores`}
                description="Los proveedores seleccionados volverán a estar activos."
                confirmLabel="Restaurar"
                variant="success"
                isLoading={bulkRestoreMutation.isPending}
            />

            {/* Child routes (Panels) */}
            <Outlet />

            {/* Cross-Module Modals */}
            <Show when={searchParams().modal === 'newUser'}>
                <LazyUserNewSheet onClose={closeAllModals} />
            </Show>
        </div>
    );
};

export default SuppliersPage;
