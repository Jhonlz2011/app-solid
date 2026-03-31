/**
 * useClientsState — All state, queries, mutations, and handlers for ClientsPage.
 *
 * Extracts ~350 lines of logic from the God Component so the page only renders.
 */
import { createSignal, createMemo, batch } from 'solid-js';
import { useQueryClient } from '@tanstack/solid-query';
import { useNavigate, useSearch } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { copyToClipboard } from '@shared/utils/clipboard';
import { buildFilterOptions } from '@shared/utils/facets.utils';
import { isActiveLabels } from '@shared/constants/labels';
import { taxIdTypeLabels, personTypeLabels } from '../models/client.types';
import { useDataTable } from '@shared/hooks/useDataTable';
import { useDataTableSSE, useRealtimeInvalidation } from '@shared/hooks/useDataTableSSE';
import { useAuth } from '@/modules/auth/store/auth.store';

import {
    useClients,
    useDeleteClient,
    useBulkDeleteClient,
    useBulkRestoreClient,
    useRestoreClient,
    useClientFacets,
    clientKeys,
    clientsApi,
    type ClientFilters,
    type ClientListItem,
} from '../data/clients.api';
import { createClientColumns } from '../data/client.columns';

export function useClientsState() {
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
    const [deleteTarget, setDeleteTarget] = createSignal<ClientListItem | null>(null);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = createSignal(false);
    const [showBulkRestoreConfirm, setShowBulkRestoreConfirm] = createSignal(false);

    // ─── SSE ─────────────────────────────────────────────────────
    useDataTableSSE({ room: 'clients', queryKey: clientKeys.lists() });
    useRealtimeInvalidation([...clientKeys.all, 'facets']);

    // ─── Table State ─────────────────────────────────────────────
    let getQueryData = () => [] as ClientListItem[];
    let getQueryMeta = () => undefined as any;

    const tableState = useDataTable<ClientListItem>({
        data: () => getQueryData(),
        meta: () => getQueryMeta(),
        isCursorBased: true
    });

    // ─── Query Filters ───────────────────────────────────────────
    const filters = (): ClientFilters => ({
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
    const clientsQuery = useClients(filters);
    getQueryData = () => clientsQuery.data?.data ?? [];
    getQueryMeta = () => clientsQuery.data?.meta;
    const facetsQuery = useClientFacets(
        () => tableState.search() || undefined,
        () => ({
            personType: personTypeFilter().length > 0 ? personTypeFilter() : undefined,
            taxIdType: taxIdTypeFilter().length > 0 ? taxIdTypeFilter() : undefined,
            isActive: isActiveFilter().length > 0 ? isActiveFilter() : undefined,
            businessName: businessNameFilter().length > 0 ? businessNameFilter() : undefined,
        })
    );

    const deleteMutation = useDeleteClient();
    const bulkRestoreMutation = useBulkRestoreClient();
    const bulkDeleteMutation = useBulkDeleteClient();
    const restoreMutation = useRestoreClient();

    // ─── Derived Data ────────────────────────────────────────────
    const clients = () => clientsQuery.data?.data ?? [];
    const meta = () => clientsQuery.data?.meta;

    const selectedActiveCount = () => tableState.selectedItems().filter(s => s.is_active).length;
    const selectedInactiveCount = () => tableState.selectedItems().filter(s => !s.is_active).length;

    // ─── Navigation Handlers ─────────────────────────────────────
    const handleNew = () => navigate({ to: '/clients/new' });
    const handleEdit = (s: ClientListItem) => navigate({ to: '/clients/$clientId/edit', params: { clientId: String(s.id) } });
    const handleView = (s: ClientListItem) => navigate({ to: '/clients/$clientId/show', params: { clientId: String(s.id) } });
    const handleClosePanel = () => navigate({ to: '/clients' });
    const handlePrefetch = (s: ClientListItem) => {
        queryClient.prefetchQuery({
            queryKey: clientKeys.detail(s.id),
            queryFn: () => clientsApi.get(s.id),
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
        if (ok) toast.success(`Copiado ${selected.length} clientes al portapapeles`);
        else toast.error('Error al copiar al portapapeles');
        tableState.setRowSelection({});
    };

    const handleDelete = (client: ClientListItem) => setDeleteTarget(client);

    const handleRestore = (client: ClientListItem) => {
        restoreMutation.mutate(client.id, {
            onSuccess: () => toast.success(`Se ha restaurado '${client.business_name}'`),
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
        });
    };

    const handleBulkDelete = () => setShowBulkDeleteConfirm(true);

    const confirmBulkDelete = () => {
        const ids = tableState.selectedItems().filter(s => s.is_active).map(s => s.id);
        if (ids.length === 0) return;
        bulkDeleteMutation.mutate(ids, {
            onSuccess: () => { toast.success(`${ids.length} clientes eliminados`); tableState.setRowSelection({}); setShowBulkDeleteConfirm(false); },
            onError: (err: any) => toast.error(err.message || 'Error al eliminar'),
        });
    };

    const confirmBulkRestore = () => {
        const ids = tableState.selectedItems().filter(s => !s.is_active).map(s => s.id);
        if (ids.length === 0) return;
        bulkRestoreMutation.mutate(ids, {
            onSuccess: () => { toast.success(`${ids.length} clientes restaurados`); tableState.setRowSelection({}); setShowBulkRestoreConfirm(false); },
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
        createClientColumns({
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
        auth, handleClosePanel,
        showFilterSheet, setShowFilterSheet, deleteTarget, setDeleteTarget,
        showBulkDeleteConfirm, setShowBulkDeleteConfirm, showBulkRestoreConfirm, setShowBulkRestoreConfirm,

        // Query results
        clientsQuery, facetsQuery, clients, meta,
        selectedActiveCount, selectedInactiveCount,

        // Mutations
        deleteMutation, bulkDeleteMutation, bulkRestoreMutation,

        // Handlers
        handleView, handleEdit,
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

export type ClientsState = ReturnType<typeof useClientsState>;
