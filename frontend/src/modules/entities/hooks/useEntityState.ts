/**
 * useEntityState.ts — Generic hook for Entities State
 *
 * Encapsulates the table state, SSE, queries, mutations, and filter sheet
 * logic for any generic entity (suppliers, clients, employees, etc.).
 */
import { createSignal, createMemo, batch } from 'solid-js';
import { useQueryClient } from '@tanstack/solid-query';
import { useNavigate } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { copyToClipboard } from '@shared/utils/clipboard';
import { buildFilterOptions } from '@shared/utils/facets.utils';
import { isActiveLabels } from '@shared/constants/labels';
import { useDataTable } from '@shared/hooks/useDataTable';
import { useDataTableSSE, useRealtimeInvalidation } from '@shared/hooks/useDataTableSSE';
import { useAuth } from '@/modules/auth/store/auth.store';

import type { EntityApi, EntityListItem } from '../data/entities.api';
import type { EntityQueries } from '../data/entities.queries';
import type { EntityMutations } from '../data/entities.mutations';
import type { EntityKeys } from '../data/entities.keys';
import type { EntityFilters } from '@app/schema/shared-dto';

interface UseEntityStateConfig {
    api: EntityApi;
    keys: EntityKeys;
    queries: EntityQueries;
    mutations: EntityMutations;
    createColumns: (props: any) => any;
    sseRoom: string;
    permissionKey: string;
    taxIdTypeLabels?: Record<string, string>;
    personTypeLabels?: Record<string, string>;
    entityNamePlural?: string; // e.g., 'proveedores'
}

export function useEntityState(config: UseEntityStateConfig) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const auth = useAuth();
    const entityNamePlural = config.entityNamePlural || 'entidades';

    // Filter sheet
    const [personTypeFilter, setPersonTypeFilter] = createSignal<string[]>([]);
    const [taxIdTypeFilter, setTaxIdTypeFilter] = createSignal<string[]>([]);
    const [isActiveFilter, setIsActiveFilter] = createSignal<string[]>([]);
    const [businessNameFilter, setBusinessNameFilter] = createSignal<string[]>([]);
    const [showFilterSheet, setShowFilterSheet] = createSignal(false);

    // Delete / Restore confirmation state
    const [deleteTarget, setDeleteTarget] = createSignal<EntityListItem | null>(null);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = createSignal(false);
    const [showBulkRestoreConfirm, setShowBulkRestoreConfirm] = createSignal(false);

    // ─── SSE ─────────────────────────────────────────────────────
    useDataTableSSE({ room: config.sseRoom, queryKey: config.keys.lists() });
    useRealtimeInvalidation([...config.keys.all, 'facets']);

    // ─── Table State ─────────────────────────────────────────────
    let getQueryData = () => [] as EntityListItem[];
    let getQueryMeta = () => undefined as any;

    const tableState = useDataTable<EntityListItem>({
        data: () => getQueryData(),
        meta: () => getQueryMeta(),
        isCursorBased: true
    });

    // ─── Query Filters ───────────────────────────────────────────
    const filters = (): EntityFilters => ({
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
    const entitiesQuery = config.queries.useList(filters);
    getQueryData = () => entitiesQuery.data?.data ?? [];
    getQueryMeta = () => entitiesQuery.data?.meta;
    const facetsQuery = config.queries.useFacets(
        () => tableState.search() || undefined,
        () => ({
            personType: personTypeFilter().length > 0 ? personTypeFilter() : undefined,
            taxIdType: taxIdTypeFilter().length > 0 ? taxIdTypeFilter() : undefined,
            isActive: isActiveFilter().length > 0 ? isActiveFilter() : undefined,
            businessName: businessNameFilter().length > 0 ? businessNameFilter() : undefined,
        })
    );

    const deleteMutation = config.mutations.useDelete();
    const bulkRestoreMutation = config.mutations.useBulkRestore();
    const bulkDeleteMutation = config.mutations.useBulkDelete();
    const restoreMutation = config.mutations.useRestore();

    // ─── Derived Data ────────────────────────────────────────────
    const entities = () => entitiesQuery.data?.data ?? [];
    const meta = () => entitiesQuery.data?.meta;

    const selectedActiveCount = () => tableState.selectedItems().filter(s => s.is_active).length;
    const selectedInactiveCount = () => tableState.selectedItems().filter(s => !s.is_active).length;

    // ─── Navigation Handlers ─────────────────────────────────────
    const handleClosePanel = () => navigate({ to: '.', search: (prev: any) => ({ ...prev, panel: undefined, id: undefined, from: undefined }) } as any);
    const handlePrefetch = (s: EntityListItem) => {
        queryClient.prefetchQuery({
            queryKey: config.keys.detail(s.id),
            queryFn: () => config.api.get(s.id),
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
        if (ok) toast.success(`Copiado ${selected.length} ${entityNamePlural} al portapapeles`);
        else toast.error('Error al copiar al portapapeles');
        tableState.setRowSelection({});
    };

    const handleDelete = (entity: EntityListItem) => setDeleteTarget(entity);

    const handleRestore = (entity: EntityListItem) => {
        restoreMutation.mutate(entity.id, {
            onSuccess: () => toast.success(`Se ha restaurado '${entity.business_name}'`),
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
        });
    };

    const handleBulkDelete = () => setShowBulkDeleteConfirm(true);

    const confirmBulkDelete = () => {
        const ids = tableState.selectedItems().filter(s => s.is_active).map(s => s.id);
        if (ids.length === 0) return;
        bulkDeleteMutation.mutate(ids, {
            onSuccess: () => { toast.success(`${ids.length} ${entityNamePlural} eliminados`); tableState.setRowSelection({}); setShowBulkDeleteConfirm(false); },
            onError: (err: any) => toast.error(err.message || 'Error al eliminar'),
        });
    };

    const confirmBulkRestore = () => {
        const ids = tableState.selectedItems().filter(s => !s.is_active).map(s => s.id);
        if (ids.length === 0) return;
        bulkRestoreMutation.mutate(ids, {
            onSuccess: () => { toast.success(`${ids.length} ${entityNamePlural} restaurados`); tableState.setRowSelection({}); setShowBulkRestoreConfirm(false); },
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
        });
    };

    const handleFilterChange = (setter: (v: string[]) => void) => (selected: string[]) => {
        batch(() => { setter(selected); tableState.setCursor(undefined); tableState.setDirection('first'); });
    };

    // ─── Filter Options ──────────────────────────────────────────
    const businessNameFilterOptions = createMemo(() => buildFilterOptions(facetsQuery.data, 'business_name'));
    const taxIdTypeFilterOptions = createMemo(() => buildFilterOptions(facetsQuery.data, 'tax_id_type', config.taxIdTypeLabels));
    const personTypeFilterOptions = createMemo(() => buildFilterOptions(facetsQuery.data, 'person_type', config.personTypeLabels));
    const isActiveFilterOptions = createMemo(() => buildFilterOptions(facetsQuery.data, 'is_active', isActiveLabels));

    // ─── Column Definitions ──────────────────────────────────────
    const columns = createMemo(() =>
        config.createColumns({
            onDelete: handleDelete,
            onRestore: handleRestore,
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
        entitiesQuery, facetsQuery, entities, meta,
        selectedActiveCount, selectedInactiveCount,

        // Mutations
        deleteMutation, bulkDeleteMutation, bulkRestoreMutation,

        // Handlers
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

export type EntityState = ReturnType<typeof useEntityState>;
