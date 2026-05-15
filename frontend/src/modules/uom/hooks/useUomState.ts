/**
 * useUomState — Centralized state management for UomPage.
 * 
 * 100% Client-Side Rendering (CSR):
 * - Fetches all UOMs once via TanStack Query.
 * - Performs filtering, sorting, and pagination locally in memory for 0ms latency.
 * - Manages all signals (search, sorting, selection, visibility) directly.
 */
import { createMemo, createSignal, batch } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { copyToClipboard } from '@shared/utils/clipboard';
import { useAuth } from '@modules/auth/store/auth.store';
import { isActiveLabels } from '@shared/constants/labels';
import type { FilterOption } from '@shared/ui/DataTable/DataTableColumnFilter';
import type { SortingState, RowSelectionState, VisibilityState, ColumnPinningState, Table, Updater } from '@tanstack/solid-table';
import { useUomList } from '../data/uom.queries';
import { useDeactivateUom, useRestoreUom } from '../data/uom.mutations';
import type { UomItem } from '../data/uom.api';
import { uomKeys } from '../data/uom.keys';
import { UOM_GROUP_META } from '../data/uom.constants';
import { UOM_GROUPS, type UomGroup } from '@app/schema/enums';
import { createUomColumns } from '../data/uom.columns';
import { useRealtimeInvalidation } from '@shared/hooks/useDataTableSSE';

export function useUomState() {
    const navigate = useNavigate();
    const auth = useAuth();

    // RBAC permissions
    const canCreate = () => auth.canAdd('uom');
    const canEdit = () => auth.canEdit('uom');
    const canDelete = () => auth.canDelete('uom');

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
    const [tableInstance, setTableInstance] = createSignal<Table<UomItem>>();

    // ─── Filter Signals (client-side) ────────────────────────────
    const [uomGroupFilter, setUomGroupFilter] = createSignal<string[]>([]);
    const [isActiveFilter, setIsActiveFilter] = createSignal<string[]>([]);

    // Delete dialog state
    const [deleteTarget, setDeleteTarget] = createSignal<UomItem | null>(null);

    // ─── Queries & Mutations ─────────────────────────────────────
    const uomQuery = useUomList();
    const deactivateMut = useDeactivateUom();
    const restoreMut = useRestoreUom();

    // SSE: auto-invalidate catalog when another tab/user changes UOMs
    useRealtimeInvalidation(uomKeys.all);

    // ─── Client-Side Processing Pipeline ─────────────────────────
    const rawList = () => uomQuery.data ?? [];

    // Derived sorting helpers
    const sortBy = () => sorting().length > 0 ? sorting()[0].id : undefined;
    const sortOrder = () => sorting().length > 0 ? (sorting()[0].desc ? 'desc' as const : 'asc' as const) : undefined;

    // 1. Filter
    const filteredList = createMemo(() => {
        let list = rawList();

        const searchVal = search()?.toLowerCase();
        if (searchVal) {
            list = list.filter(u => u.code.toLowerCase().includes(searchVal) || u.name.toLowerCase().includes(searchVal));
        }

        const activeFilter = isActiveFilter();
        if (activeFilter.length > 0) {
            const wantsActive = activeFilter.includes('true');
            const wantsInactive = activeFilter.includes('false');
            if (wantsActive !== wantsInactive) {
                list = list.filter(u => (u.is_active ?? true) === wantsActive);
            }
        }

        const groupFilter = uomGroupFilter();
        if (groupFilter.length > 0) {
            list = list.filter(u => groupFilter.includes(u.uom_group));
        }

        return list;
    });

    // 2. Sort
    const sortedList = createMemo(() => {
        const list = [...filteredList()];
        const key = sortBy() as keyof UomItem;
        const order = sortOrder();

        if (key) {
            list.sort((a, b) => {
                // System UOMs always first when sorting by code/name
                if (key === 'code' || key === 'name') {
                    if (a.is_system !== b.is_system) return a.is_system ? -1 : 1;
                }
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

    const handleEdit = (item: UomItem) => {
        if (item.is_system) return;
        navigate({ to: `/uom/${item.id}/edit` });
    };

    const handleDelete = (item: UomItem) => {
        if (item.is_system) {
            toast.error('Las unidades del sistema no pueden ser eliminadas');
            return;
        }
        setDeleteTarget(item);
    };

    const handleRestore = (item: UomItem) => {
        if (item.is_system) return;
        restoreMut.mutate(item.id, {
            onSuccess: () => toast.success(`"${item.code}" restaurada`),
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
        });
    };

    const handleCopySelection = async () => {
        const selected = selectedItems();
        if (selected.length === 0) return;
        const text = selected.map((u: UomItem) => `${u.code} — ${u.name} (${u.uom_group})`).join('\n');
        const ok = await copyToClipboard(text);
        if (ok) toast.success(`Copiado ${selected.length} unidades`);
        else toast.error('Error al copiar');
        setRowSelection({});
    };

    // ─── Static Filter Options ───────────────────────────────────
    const uomGroupFilterOptions = createMemo((): FilterOption[] => {
        const data = rawList();
        const counts = new Map<string, number>();
        for (const item of data) {
            counts.set(item.uom_group, (counts.get(item.uom_group) ?? 0) + 1);
        }
        return UOM_GROUPS.map(g => ({
            value: g,
            label: UOM_GROUP_META[g as UomGroup]?.label ?? g,
            count: counts.get(g) ?? 0,
        })).filter(o => o.count > 0 || uomGroupFilter().includes(o.value));
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
        createUomColumns({
            onEdit: handleEdit,
            onDelete: handleDelete,
            onRestore: handleRestore,
            canEdit: canEdit(),
            canDelete: canDelete(),
            filters: {
                uomGroup: {
                    options: uomGroupFilterOptions,
                    selected: uomGroupFilter,
                    onChange: handleFilterChange(setUomGroupFilter),
                    isLoading: () => uomQuery.isPending,
                },
                isActive: {
                    options: isActiveFilterOptions,
                    selected: isActiveFilter,
                    onChange: handleFilterChange(setIsActiveFilter),
                    isLoading: () => uomQuery.isPending,
                },
            },
        })
    );

    return {
        // Data
        uomList: pagedList,
        uomQuery,

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
