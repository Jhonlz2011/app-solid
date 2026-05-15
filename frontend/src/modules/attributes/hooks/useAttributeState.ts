/**
 * useAttributeState — Centralized state management for AttributesPage.
 *
 * 100% Client-Side Rendering (CSR):
 * - Fetches all attributes once via TanStack Query.
 * - Performs filtering, sorting, and pagination locally in memory for 0ms latency.
 * - Manages all signals (search, sorting, selection, visibility) directly.
 */
import { createMemo, createSignal, batch } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { copyToClipboard } from '@shared/utils/clipboard';
import { useAuth } from '@modules/auth/store/auth.store';
import { isActiveLabels } from '@shared/constants/labels';
import type { FilterOption } from '@shared/ui/DataTable';
import type { SortingState, RowSelectionState, VisibilityState, ColumnPinningState, Table, Updater } from '@tanstack/solid-table';
import { useAttributeList } from '../data/attributes.queries';
import { useDeactivateAttribute, useRestoreAttribute } from '../data/attributes.mutations';
import type { AttributeItem } from '../data/attributes.api';
import { attributeKeys } from '../data/attributes.keys';
import { ATTRIBUTE_TYPE_LABELS } from '../data/attributes.constants';
import { ATTRIBUTE_DATA_TYPES, type AttributeDataType } from '@app/schema/frontend';
import { createAttributeColumns } from '../data/attributes.columns';
import { useRealtimeInvalidation } from '@shared/hooks/useDataTableSSE';

export function useAttributeState() {
    const navigate = useNavigate();
    const auth = useAuth();

    // RBAC permissions
    const canCreate = () => auth.canAdd('attributes');
    const canEdit = () => auth.canEdit('attributes');
    const canDelete = () => auth.canDelete('attributes');

    // ─── Table Core Signals ──────────────────────────────────────
    const [search, setSearch] = createSignal('');
    const [page, setPage] = createSignal(1);
    const [pageSize, setPageSize] = createSignal(10);
    const [sorting, setSorting] = createSignal<SortingState>([]);
    const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});
    const [columnVisibility, setColumnVisibility] = createSignal<VisibilityState>({});
    const [columnPinning, setColumnPinning] = createSignal<ColumnPinningState>({
        left: ['select'],
        right: ['actions'],
    });
    const [tableInstance, setTableInstance] = createSignal<Table<AttributeItem>>();

    // ─── Filter Signals (client-side) ────────────────────────────
    const [typeFilter, setTypeFilter] = createSignal<string[]>([]);
    const [isActiveFilter, setIsActiveFilter] = createSignal<string[]>([]);

    // Delete dialog state
    const [deleteTarget, setDeleteTarget] = createSignal<AttributeItem | null>(null);

    // ─── Queries & Mutations ─────────────────────────────────────
    const attrQuery = useAttributeList();
    const deactivateMut = useDeactivateAttribute();
    const restoreMut = useRestoreAttribute();

    // SSE: auto-invalidate when another tab/user changes attributes
    useRealtimeInvalidation(attributeKeys.all);

    // ─── Client-Side Processing Pipeline ─────────────────────────
    const rawList = () => attrQuery.data ?? [];

    // Derived sorting helpers
    const sortBy = () => sorting().length > 0 ? sorting()[0].id : undefined;
    const sortOrder = () => sorting().length > 0 ? (sorting()[0].desc ? 'desc' as const : 'asc' as const) : undefined;

    // 1. Filter
    const filteredList = createMemo(() => {
        let list = rawList();

        const searchVal = search()?.toLowerCase();
        if (searchVal) {
            list = list.filter(a =>
                a.label.toLowerCase().includes(searchVal) ||
                a.key.toLowerCase().includes(searchVal)
            );
        }

        const activeFilter = isActiveFilter();
        if (activeFilter.length > 0) {
            const wantsActive = activeFilter.includes('true');
            const wantsInactive = activeFilter.includes('false');
            if (wantsActive !== wantsInactive) {
                list = list.filter(a => (a.is_active ?? true) === wantsActive);
            }
        }

        const tFilter = typeFilter();
        if (tFilter.length > 0) {
            list = list.filter(a => tFilter.includes(a.type));
        }

        return list;
    });

    // 2. Sort
    const sortedList = createMemo(() => {
        const list = [...filteredList()];
        const key = sortBy() as keyof AttributeItem;
        const order = sortOrder();

        if (key) {
            list.sort((a, b) => {
                let valA = a[key];
                let valB = b[key];
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
                if (valA! < valB!) return order === 'asc' ? -1 : 1;
                if (valA! > valB!) return order === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return list;
    });

    // 3. Paginate
    const totalRows = createMemo(() => sortedList().length);
    const pageCount = createMemo(() => Math.max(1, Math.ceil(totalRows() / pageSize())));
    const hasNextPage = createMemo(() => page() < pageCount());
    const hasPrevPage = createMemo(() => page() > 1);

    const pagedList = createMemo(() => {
        const p = page();
        const s = pageSize();
        return sortedList().slice((p - 1) * s, p * s);
    });

    // ─── Selection Metrics ───────────────────────────────────────
    const selectedCount = () => Object.keys(rowSelection()).length;
    const selectedItems = createMemo(() => {
        const selection = rowSelection();
        return rawList().filter(item => selection[String(item.id)]);
    });

    // ─── Handlers ────────────────────────────────────────────────
    const handleSearchInput = (value: string) => {
        batch(() => { setSearch(value); setPage(1); setRowSelection({}); });
    };

    const handleFirstPage = () => {
        batch(() => { setPage(1); setRowSelection({}); });
    };

    const handleLastPage = () => {
        batch(() => { setPage(pageCount()); setRowSelection({}); });
    };

    const handleNextPage = () => {
        batch(() => { setPage(p => p + 1); setRowSelection({}); });
    };

    const handlePrevPage = () => {
        batch(() => { setPage(p => Math.max(1, p - 1)); setRowSelection({}); });
    };

    const handlePageSizeChange = (size: number) => {
        batch(() => { setPageSize(size); setPage(1); });
    };

    const handleSortingChange = (updater: Updater<SortingState>) => {
        batch(() => {
            const newSorting = typeof updater === 'function' ? updater(sorting()) : updater;
            setSorting(newSorting);
            setPage(1);
        });
    };

    const handleFilterChange = (setter: (v: string[]) => void) => (selected: string[]) => {
        batch(() => { setter(selected); setPage(1); });
    };

    const handleEdit = (item: AttributeItem) => {
        navigate({ to: `/attributes/${item.id}/edit` });
    };

    const handleDelete = (item: AttributeItem) => {
        setDeleteTarget(item);
    };

    const handleRestore = (item: AttributeItem) => {
        restoreMut.mutate(item.id, {
            onSuccess: () => toast.success(`"${item.label}" restaurado`),
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
        });
    };

    const handleCopySelection = async () => {
        const selected = selectedItems();
        if (selected.length === 0) return;
        const text = selected.map((a: AttributeItem) => `${a.key} — ${a.label} (${a.type})`).join('\n');
        const ok = await copyToClipboard(text);
        if (ok) toast.success(`Copiado ${selected.length} atributo(s)`);
        else toast.error('Error al copiar');
        setRowSelection({});
    };

    // ─── Static Filter Options ───────────────────────────────────
    const typeFilterOptions = createMemo((): FilterOption[] => {
        const data = rawList();
        const counts = new Map<string, number>();
        for (const item of data) {
            counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
        }
        return ATTRIBUTE_DATA_TYPES.map(t => ({
            value: t,
            label: ATTRIBUTE_TYPE_LABELS[t as AttributeDataType] ?? t,
            count: counts.get(t) ?? 0,
        })).filter(o => o.count > 0 || typeFilter().includes(o.value));
    });

    const isActiveFilterOptions = createMemo((): FilterOption[] => {
        const data = rawList();
        let activeCount = 0, inactiveCount = 0;
        for (const item of data) {
            if (item.is_active ?? true) activeCount++; else inactiveCount++;
        }
        return [
            { value: 'true', label: isActiveLabels['true'], count: activeCount },
            { value: 'false', label: isActiveLabels['false'], count: inactiveCount },
        ].filter(o => o.count > 0 || isActiveFilter().includes(o.value));
    });

    // ─── Column Definitions (with filter configs) ────────────────
    const columns = createMemo(() =>
        createAttributeColumns({
            onEdit: handleEdit,
            onDelete: handleDelete,
            onRestore: handleRestore,
            canEdit: canEdit(),
            canDelete: canDelete(),
            filters: {
                type: {
                    options: typeFilterOptions,
                    selected: typeFilter,
                    onChange: handleFilterChange(setTypeFilter),
                    isLoading: () => attrQuery.isPending,
                },
                isActive: {
                    options: isActiveFilterOptions,
                    selected: isActiveFilter,
                    onChange: handleFilterChange(setIsActiveFilter),
                    isLoading: () => attrQuery.isPending,
                },
            },
        })
    );

    return {
        // Data
        attributeList: pagedList,
        attrQuery,

        // Table Signals
        search, page, pageSize, sorting, rowSelection, columnVisibility, columnPinning, tableInstance,
        setSearch, setPage, setPageSize, setSorting, setRowSelection, setColumnVisibility, setColumnPinning, setTableInstance,

        // Pagination Meta
        totalRows, pageCount, hasNextPage, hasPrevPage,

        // Selection
        selectedCount, selectedItems,

        // Actions
        handleSearchInput, handleFirstPage, handleLastPage, handleNextPage, handlePrevPage,
        handlePageSizeChange, handleSortingChange,

        // Domain Handlers
        deactivateMut, restoreMut,
        handleEdit, handleDelete, handleRestore, handleCopySelection,
        columns,

        // RBAC
        canCreate, canEdit, canDelete,

        // Delete dialog
        deleteTarget, setDeleteTarget,
    };
}
