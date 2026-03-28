/**
 * useSuppliersState — All state, queries, mutations, and handlers for SuppliersPage.
 *
 * Extracts ~350 lines of logic from the God Component so the page only renders.
 */
import { createSignal, createMemo, batch } from 'solid-js';
import type { Updater, SortingState } from '@tanstack/solid-table';
import { useQueryClient } from '@tanstack/solid-query';
import { useNavigate, useSearch } from '@tanstack/solid-router';
import type { PanelSearch } from '@shared/types/search-params.types';
import { toast } from 'solid-sonner';
import { copyToClipboard } from '@shared/utils/clipboard';
import { buildFilterOptions } from '@shared/utils/facets.utils';
import { isActiveLabels } from '@shared/constants/labels';
import { taxIdTypeLabels, personTypeLabels } from '../models/supplier.types';
import { useDataTable } from '@shared/hooks/useDataTable';
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

    // Filter sheet
    const [personTypeFilter, setPersonTypeFilter] = createSignal<string[]>([]);
    const [taxIdTypeFilter, setTaxIdTypeFilter] = createSignal<string[]>([]);
    const [isActiveFilter, setIsActiveFilter] = createSignal<string[]>([]);
    const [businessNameFilter, setBusinessNameFilter] = createSignal<string[]>([]);
    const [showFilterSheet, setShowFilterSheet] = createSignal(false);

    // Delete / Restore confirmation state
    const [deleteTarget, setDeleteTarget] = createSignal<SupplierListItem | null>(null);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = createSignal(false);
    const [showBulkRestoreConfirm, setShowBulkRestoreConfirm] = createSignal(false);

    // ─── SSE ─────────────────────────────────────────────────────
    useDataTableSSE({ room: 'suppliers', queryKey: supplierKeys.lists() });
    useRealtimeInvalidation([...supplierKeys.all, 'facets']);

    // ─── Table State ─────────────────────────────────────────────
    let getQueryData = () => [] as SupplierListItem[];
    let getQueryMeta = () => undefined as any;

    const tableState = useDataTable<SupplierListItem>({
        data: () => getQueryData(),
        meta: () => getQueryMeta(),
        isCursorBased: true
    });

    // ─── Query Filters ───────────────────────────────────────────
    const filters = (): SupplierFilters => ({
        cursor: tableState.isSortedMode() ? undefined : tableState.cursor(),
        direction: tableState.isSortedMode() ? undefined : tableState.direction(),
        sortBy: tableState.sortBy(),
        sortOrder: tableState.sortOrder(),
        page: tableState.isSortedMode() ? tableState.page() : undefined,
        limit: tableState.pageSize(),
        search: tableState.search() || undefined,
        personType: personTypeFilter().length > 0 ? personTypeFilter() : undefined,
        taxIdType: taxIdTypeFilter().length > 0 ? taxIdTypeFilter() : undefined,
        isActive: isActiveFilter().length > 0 ? isActiveFilter() : undefined,
        businessName: businessNameFilter().length > 0 ? businessNameFilter() : undefined,
    });

    // ─── Queries & Mutations ─────────────────────────────────────
    const suppliersQuery = useSuppliers(filters);
    const facetsQuery = useSupplierFacets(
        () => tableState.search() || undefined,
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

    const selectedActiveCount = () => tableState.selectedItems().filter(s => s.is_active).length;
    const selectedInactiveCount = () => tableState.selectedItems().filter(s => !s.is_active).length;

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
        const selected = tableState.selectedItems();
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
        tableState.setRowSelection({});
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
        const ids = tableState.selectedItems().filter(s => s.is_active).map(s => s.id);
        if (ids.length === 0) return;
        bulkDeleteMutation.mutate(ids, {
            onSuccess: () => { toast.success(`${ids.length} proveedores eliminados`); tableState.setRowSelection({}); setShowBulkDeleteConfirm(false); },
            onError: (err: any) => toast.error(err.message || 'Error al eliminar'),
        });
    };

    const confirmBulkRestore = () => {
        const ids = tableState.selectedItems().filter(s => !s.is_active).map(s => s.id);
        if (ids.length === 0) return;
        bulkRestoreMutation.mutate(ids, {
            onSuccess: () => { toast.success(`${ids.length} proveedores restaurados`); tableState.setRowSelection({}); setShowBulkRestoreConfirm(false); },
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
        });
    };

    const handleFilterChange = (setter: (v: string[]) => void) => (selected: string[]) => {
        batch(() => { setter(selected); tableState.setCursor(undefined); tableState.setDirection('first'); });
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
        // ...Spread all base table handlers and state
        ...tableState,

        // State
        auth, panelSearch, handleClosePanel,
        showFilterSheet, setShowFilterSheet, deleteTarget, setDeleteTarget,
        showBulkDeleteConfirm, setShowBulkDeleteConfirm, showBulkRestoreConfirm, setShowBulkRestoreConfirm,

        // Query results
        suppliersQuery, facetsQuery, suppliers, meta,
        selectedActiveCount, selectedInactiveCount,

        // Mutations
        deleteMutation, bulkDeleteMutation, bulkRestoreMutation,

        // Handlers
        handleNew, handleView, handleEdit,
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
