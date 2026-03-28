/**
 * useSuppliersState — All state, queries, mutations, and handlers for SuppliersPage.
 *
 * Extracts ~350 lines of logic from the God Component so the page only renders.
 */
import { createSignal, createMemo, batch, createEffect } from 'solid-js';
import type { RowSelectionState, ColumnPinningState, VisibilityState, SortingState, Updater, Table } from '@tanstack/solid-table';
import { useQueryClient } from '@tanstack/solid-query';
import { useNavigate, useSearch } from '@tanstack/solid-router';
import type { PanelSearch } from '@shared/types/search-params.types';
import { toast } from 'solid-sonner';
import { copyToClipboard } from '@shared/utils/clipboard';
import { buildFilterOptions } from '@shared/utils/facets.utils';
import { isActiveLabels } from '@shared/constants/labels';
import { taxIdTypeLabels, personTypeLabels } from '../models/supplier.types';
import { useDataTableSSE, useRealtimeInvalidation } from '@shared/hooks/useDataTableSSE';
import { useAuth } from '@/modules/auth/store/auth.store';

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
    type SupplierListItem,
} from '../data/suppliers.api';
import { createSupplierColumns } from '../data/supplier.columns';

export function useSuppliersState() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const auth = useAuth();
    const routerSearch = useSearch({ strict: false });

    // ─── Pagination & Filter State ───────────────────────────────
    const [search, setSearch] = createSignal('');
    const [pageSize, setPageSize] = createSignal(10);
    const [cursor, setCursor] = createSignal<string | undefined>(undefined);
    const [direction, setDirection] = createSignal<'first' | 'next' | 'prev' | 'last'>('first');
    const [sorting, setSorting] = createSignal<SortingState>([]);
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

    // Table instance ref
    const [tableInstance, setTableInstance] = createSignal<Table<SupplierListItem>>();

    // Filter sheet
    const [showFilterSheet, setShowFilterSheet] = createSignal(false);

    // Delete / Restore confirmation state
    const [deleteTarget, setDeleteTarget] = createSignal<SupplierListItem | null>(null);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = createSignal(false);
    const [showBulkRestoreConfirm, setShowBulkRestoreConfirm] = createSignal(false);

    // ─── SSE ─────────────────────────────────────────────────────
    useDataTableSSE({ room: 'suppliers', queryKey: supplierKeys.lists() });
    useRealtimeInvalidation([...supplierKeys.all, 'facets']);

    // ─── Derived: Sort params & pagination mode ──────────────────
    const sortBy = () => sorting().length > 0 ? sorting()[0].id : undefined;
    const sortOrder = () => sorting().length > 0 ? (sorting()[0].desc ? 'desc' as const : 'asc' as const) : undefined;
    const isSortedMode = () => !!sortBy() && sortBy() !== 'id';

    // ─── Query Filters ───────────────────────────────────────────
    const filters = (): SupplierFilters => ({
        cursor: isSortedMode() ? undefined : cursor(),
        direction: isSortedMode() ? undefined : direction(),
        sortBy: sortBy(),
        sortOrder: sortOrder(),
        page: isSortedMode() ? page() : undefined,
        limit: pageSize(),
        search: search() || undefined,
        personType: personTypeFilter().length > 0 ? personTypeFilter() : undefined,
        taxIdType: taxIdTypeFilter().length > 0 ? taxIdTypeFilter() : undefined,
        isActive: isActiveFilter().length > 0 ? isActiveFilter() : undefined,
        businessName: businessNameFilter().length > 0 ? businessNameFilter() : undefined,
    });

    // ─── Queries & Mutations ─────────────────────────────────────
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

    // ─── Derived Data ────────────────────────────────────────────
    const suppliers = () => suppliersQuery.data?.data ?? [];
    const meta = () => suppliersQuery.data?.meta;
    const totalRows = () => meta()?.total ?? 0;
    const hasNextPage = () => meta()?.hasNextPage ?? false;
    const hasPrevPage = () => meta()?.hasPrevPage ?? false;

    const selectedCount = () => Object.keys(rowSelection()).length;
    const selectedSuppliers = createMemo(() => {
        const selection = rowSelection();
        return suppliers().filter(s => selection[String(s.id)]);
    });
    const selectedActiveCount = () => selectedSuppliers().filter(s => s.is_active).length;
    const selectedInactiveCount = () => selectedSuppliers().filter(s => !s.is_active).length;

    // Clamp page
    createEffect(() => {
        const pageCount = meta()?.pageCount;
        if (pageCount && page() > pageCount) setPage(Math.max(1, pageCount));
    });

    // ─── Pagination Handlers ─────────────────────────────────────
    const handleSearchInput = (value: string) => {
        batch(() => { setSearch(value); setCursor(undefined); setDirection('first'); setPage(1); });
    };

    const handleFirstPage = () => {
        batch(() => { setCursor(undefined); setDirection('first'); setPage(1); setRowSelection({}); });
    };

    const handleLastPage = () => {
        if (isSortedMode()) {
            const pageCount = meta()?.pageCount ?? 1;
            batch(() => { setPage(pageCount); setRowSelection({}); });
        } else {
            batch(() => { setCursor(undefined); setDirection('last'); setRowSelection({}); });
        }
    };

    const handleNextPage = () => {
        if (isSortedMode()) {
            batch(() => { setPage(p => p + 1); setRowSelection({}); });
        } else {
            const nextCursor = meta()?.nextCursor;
            if (nextCursor) batch(() => { setCursor(nextCursor); setDirection('next'); setRowSelection({}); });
        }
    };

    const handlePrevPage = () => {
        if (isSortedMode()) {
            batch(() => { setPage(p => Math.max(1, p - 1)); setRowSelection({}); });
        } else {
            const prevCursor = meta()?.prevCursor;
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
        });
    };

    // ─── Navigation Handlers ─────────────────────────────────────
    const panelSearch = (): PanelSearch => (routerSearch() as PanelSearch) ?? {};
    const handleNew = () => navigate({ to: '.', search: (prev: any) => ({ ...prev, panel: 'new', id: undefined }) } as any);
    const handleEdit = (s: SupplierListItem) => navigate({ to: '.', search: (prev: any) => ({ ...prev, panel: 'edit', id: s.id }) } as any);
    const handleView = (s: SupplierListItem) => navigate({ to: '.', search: (prev: any) => ({ ...prev, panel: 'show', id: s.id }) } as any);
    const handleClosePanel = () => navigate({ to: '.', search: (prev: any) => ({ ...prev, panel: undefined, id: undefined, from: undefined }) } as any);
    const handlePrefetch = (s: SupplierListItem) => {
        queryClient.prefetchQuery({
            queryKey: supplierKeys.detail(s.id),
            queryFn: () => suppliersApi.get(s.id),
            staleTime: 1000 * 60 * 5,
        });
    };

    // ─── Action Handlers ─────────────────────────────────────────
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
        const ok = await copyToClipboard(text);
        if (ok) toast.success(`Copiado ${selected.length} proveedores al portapapeles`);
        else toast.error('Error al copiar al portapapeles');
        setRowSelection({});
    };

    const handleDelete = (supplier: SupplierListItem) => setDeleteTarget(supplier);

    const handleRestore = (supplier: SupplierListItem) => {
        restoreMutation.mutate(supplier.id, {
            onSuccess: () => toast.success(`Se ha restaurado '${supplier.business_name}'`),
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
        });
    };

    const handleBulkDelete = () => setShowBulkDeleteConfirm(true);

    const confirmBulkDelete = () => {
        const ids = selectedSuppliers().filter(s => s.is_active).map(s => s.id);
        if (ids.length === 0) return;
        bulkDeleteMutation.mutate(ids, {
            onSuccess: () => { toast.success(`${ids.length} proveedores eliminados`); setRowSelection({}); setShowBulkDeleteConfirm(false); },
            onError: (err: any) => toast.error(err.message || 'Error al eliminar'),
        });
    };

    const confirmBulkRestore = () => {
        const ids = selectedSuppliers().filter(s => !s.is_active).map(s => s.id);
        if (ids.length === 0) return;
        bulkRestoreMutation.mutate(ids, {
            onSuccess: () => { toast.success(`${ids.length} proveedores restaurados`); setRowSelection({}); setShowBulkRestoreConfirm(false); },
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
        });
    };

    const handleFilterChange = (setter: (v: string[]) => void) => (selected: string[]) => {
        batch(() => { setter(selected); setCursor(undefined); setDirection('first'); });
    };

    // ─── Filter Options ──────────────────────────────────────────
    const businessNameFilterOptions = createMemo(() => buildFilterOptions(facetsQuery.data, 'business_name'));
    const taxIdTypeFilterOptions = createMemo(() => buildFilterOptions(facetsQuery.data, 'tax_id_type', taxIdTypeLabels));
    const personTypeFilterOptions = createMemo(() => buildFilterOptions(facetsQuery.data, 'person_type', personTypeLabels));
    const isActiveFilterOptions = createMemo(() => buildFilterOptions(facetsQuery.data, 'is_active', isActiveLabels));

    // ─── Column Definitions ──────────────────────────────────────
    const columns = createMemo(() =>
        createSupplierColumns({
            onView: handleView,
            onEdit: handleEdit,
            onDelete: handleDelete,
            onRestore: handleRestore,
            auth,
            filters: {
                businessName: { options: businessNameFilterOptions, selected: businessNameFilter, onChange: handleFilterChange(setBusinessNameFilter), isLoading: () => facetsQuery.isPending },
                taxIdType: { options: taxIdTypeFilterOptions, selected: taxIdTypeFilter, onChange: handleFilterChange(setTaxIdTypeFilter), isLoading: () => facetsQuery.isPending },
                personType: { options: personTypeFilterOptions, selected: personTypeFilter, onChange: handleFilterChange(setPersonTypeFilter), isLoading: () => facetsQuery.isPending },
                isActive: { options: isActiveFilterOptions, selected: isActiveFilter, onChange: handleFilterChange(setIsActiveFilter), isLoading: () => facetsQuery.isPending },
            },
        })
    );

    return {
        // State
        auth, panelSearch, handleClosePanel,
        search, sorting, rowSelection, setRowSelection, columnVisibility, setColumnVisibility,
        columnPinning, setColumnPinning, tableInstance, setTableInstance,
        showFilterSheet, setShowFilterSheet, deleteTarget, setDeleteTarget,
        showBulkDeleteConfirm, setShowBulkDeleteConfirm, showBulkRestoreConfirm, setShowBulkRestoreConfirm,

        // Query results
        suppliersQuery, facetsQuery, suppliers, totalRows, hasNextPage, hasPrevPage, meta,
        selectedCount, selectedActiveCount, selectedInactiveCount, pageSize,

        // Mutations
        deleteMutation, bulkDeleteMutation, bulkRestoreMutation,

        // Handlers
        handleSearchInput, handleFirstPage, handleLastPage, handleNextPage, handlePrevPage,
        handlePageSizeChange, handleSortingChange, handleNew, handleView, handleEdit,
        handlePrefetch, handleCopySelection, handleDelete, handleRestore, handleBulkDelete,
        confirmBulkDelete, confirmBulkRestore, handleFilterChange, filters,

        // Column definitions
        columns,

        // Filter configs (for FilterSheet)
        filterSheetConfig: {
            personType: { options: personTypeFilterOptions, selected: personTypeFilter, onChange: handleFilterChange(setPersonTypeFilter), isLoading: () => facetsQuery.isPending },
            taxIdType: { options: taxIdTypeFilterOptions, selected: taxIdTypeFilter, onChange: handleFilterChange(setTaxIdTypeFilter), isLoading: () => facetsQuery.isPending },
            isActive: { options: isActiveFilterOptions, selected: isActiveFilter, onChange: handleFilterChange(setIsActiveFilter), isLoading: () => facetsQuery.isPending },
            businessName: { options: businessNameFilterOptions, selected: businessNameFilter, onChange: handleFilterChange(setBusinessNameFilter), isLoading: () => facetsQuery.isPending },
        },

        // Filter active indicator
        hasActiveFilters: () => personTypeFilter().length > 0 || taxIdTypeFilter().length > 0 || isActiveFilter().length > 0 || businessNameFilter().length > 0,
    };
}

export type SuppliersState = ReturnType<typeof useSuppliersState>;
