/**
 * useCategoryState — Central state for the Categories module.
 *
 * Manages:
 * - Search / status filters (single-pass counting)
 * - Row selection + batch actions via bulk endpoints
 * - SSE real-time invalidation
 * - RBAC permissions
 * - Client-side filter pipeline (flat → filter → buildSubRows → render)
 */
import { createSignal, createMemo } from 'solid-js';
import type { RowSelectionState } from '@tanstack/solid-table';
import { useAuth } from '@modules/auth/store/auth.store';
import { categorieKeys } from '../data/categories.keys';
import { useDataTableSSE } from '@shared/hooks/useDataTableSSE';
import { useCategoriesFlat } from '../data/categories.queries';
import {
    useDeactivateCategory,
    useRestoreCategory,
    useBulkDeactivateCategories,
    useBulkRestoreCategories,
} from '../data/categories.mutations';
import type { CategoryNode } from '../data/categories.api';
import { toast } from 'solid-sonner';
import { copyToClipboard } from '@shared/utils/clipboard';

export type CategoryState = ReturnType<typeof useCategoryState>;

export function useCategoryState() {
    const auth = useAuth();

    // ─── RBAC ────────────────────────────────────────────────────
    const canCreate = () => auth.canAdd('categories');
    const canEdit = () => auth.canEdit('categories');
    const canDelete = () => auth.canDelete('categories');

    // ─── Data ────────────────────────────────────────────────────
    const categoryQuery = useCategoriesFlat();
    const deactivateMut = useDeactivateCategory();
    const restoreMut = useRestoreCategory();
    const bulkDeactivateMut = useBulkDeactivateCategories();
    const bulkRestoreMut = useBulkRestoreCategories();

    // SSE invalidation
    useDataTableSSE({ room: 'categories', queryKey: categorieKeys.list() });

    // ─── Table Instance ──────────────────────────────────────────
    const [tableInstance, setTableInstance] = createSignal<any>();

    // ─── Filters ─────────────────────────────────────────────────
    const [search, setSearch] = createSignal('');
    const [statusFilter, setStatusFilter] = createSignal<string[]>(['active']);

    // ─── Raw Data + Indexed Map ──────────────────────────────────
    const rawList = () => (categoryQuery.data ?? []) as CategoryNode[];
    const rawMap = createMemo(() => new Map(rawList().map(c => [c.id, c])));

    // ─── Row Selection ───────────────────────────────────────────
    const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});

    const selectedIds = createMemo(() =>
        Object.entries(rowSelection())
            .filter(([_, v]) => v)
            .map(([k]) => Number(k))
    );
    const selectedCount = createMemo(() => selectedIds().length);

    // Derived selection memos — O(n) via Map instead of O(n²) via .find()
    const selectedItems = createMemo(() =>
        selectedIds().map(id => rawMap().get(id)).filter(Boolean) as CategoryNode[]
    );
    const selectedActive = createMemo(() =>
        selectedItems().filter(c => c.is_active !== false)
    );
    const selectedInactive = createMemo(() =>
        selectedItems().filter(c => c.is_active === false)
    );
    const selectedActiveCount = createMemo(() => selectedActive().length);
    const selectedInactiveCount = createMemo(() => selectedInactive().length);

    // ─── Selection Helpers ───────────────────────────────────────
    const clearSelection = (ids?: number[]) => {
        if (!ids) return setRowSelection({});
        setRowSelection(prev => {
            const next = { ...prev };
            ids.forEach(id => delete next[String(id)]);
            return next;
        });
    };

    // ─── Single-Pass Filter Counting ─────────────────────────────
    const filterCounts = createMemo(() => {
        let active = 0, inactive = 0;
        for (const cat of rawList()) {
            cat.is_active !== false ? active++ : inactive++;
        }
        return { active, inactive };
    });

    const statusFilterOptions = createMemo(() => {
        const { active, inactive } = filterCounts();
        return [
            { value: 'active', label: 'Activo', count: active },
            { value: 'inactive', label: 'Inactivo', count: inactive },
        ];
    });

    // ─── Filter Pipeline ─────────────────────────────────────────
    const filteredList = createMemo(() => {
        let list = rawList();

        const ss = statusFilter();
        if (ss.length > 0) {
            list = list.filter(c => {
                const isActiveStr = c.is_active !== false ? 'active' : 'inactive';
                return ss.includes(isActiveStr);
            });
        }

        const q = search().toLowerCase().trim();
        if (q) {
            list = list.filter(c =>
                c.name.toLowerCase().includes(q) ||
                (c.description?.toLowerCase().includes(q) ?? false) ||
                (c.path?.toLowerCase().includes(q) ?? false)
            );
        }

        return list;
    });

    const totalCount = createMemo(() => rawList().length);
    const filteredCount = createMemo(() => filteredList().length);

    // ─── Delete Dialog ───────────────────────────────────────────
    const [deleteTarget, setDeleteTarget] = createSignal<CategoryNode | null>(null);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = createSignal(false);
    const [showBulkRestoreConfirm, setShowBulkRestoreConfirm] = createSignal(false);

    // ─── Batch Actions (Bulk Endpoints) ──────────────────────────
    const handleBulkDelete = () => {
        setShowBulkDeleteConfirm(true);
    };

    const confirmBulkDelete = async () => {
        const activeIds = selectedActive().map(c => c.id);
        if (activeIds.length === 0) {
            setShowBulkDeleteConfirm(false);
            return;
        }
        try {
            await bulkDeactivateMut.mutateAsync(activeIds);
            toast.success(`${activeIds.length} categorías desactivadas`);
            clearSelection();
            setShowBulkDeleteConfirm(false);
        } catch (e: any) {
            toast.error(e?.message ?? 'Error al desactivar');
        }
    };

    const handleBulkRestore = () => {
        setShowBulkRestoreConfirm(true);
    };

    const confirmBulkRestore = async () => {
        const inactiveIds = selectedInactive().map(c => c.id);
        if (inactiveIds.length === 0) {
            setShowBulkRestoreConfirm(false);
            return;
        }
        try {
            await bulkRestoreMut.mutateAsync(inactiveIds);
            toast.success(`${inactiveIds.length} categorías restauradas`);
            clearSelection();
            setShowBulkRestoreConfirm(false);
        } catch (e: any) {
            toast.error(e?.message ?? 'Error al restaurar');
        }
    };

    const handleCopySelection = async () => {
        const items = selectedItems();
        const text = items.map(c => `${c.name}\t${c.path ?? ''}\t${c.description ?? ''}`).join('\n');
        const ok = await copyToClipboard(text);
        if (ok) {
            toast.success(`${items.length} categorías copiadas al portapapeles`);
        } else {
            toast.error('No se pudo copiar al portapapeles');
        }
    };

    const handleDelete = (item: CategoryNode) => {
        setDeleteTarget(item);
    };

    const handleRestore = (item: CategoryNode) => {
        restoreMut.mutate(item.id, {
            onSuccess: () => {
                clearSelection([item.id]);
                toast.success(`"${item.name}" restaurada`);
            },
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
        });
    };

    const filters = {
        status: {
            options: statusFilterOptions,
            selected: statusFilter,
            onChange: setStatusFilter,
            isLoading: () => false,
        },
    };

    return {
        // Data
        categoryQuery, rawList, filteredList, totalCount, filteredCount,

        // Table Instance
        tableInstance, setTableInstance,

        // Filters
        search, setSearch,
        statusFilter, setStatusFilter,
        filters,

        // Selection
        rowSelection, setRowSelection,
        selectedCount, selectedActiveCount, selectedInactiveCount,
        clearSelection,
        handleBulkDelete, confirmBulkDelete,
        handleBulkRestore, confirmBulkRestore,
        showBulkDeleteConfirm, setShowBulkDeleteConfirm,
        showBulkRestoreConfirm, setShowBulkRestoreConfirm,
        handleCopySelection, handleDelete, handleRestore,

        // Mutations
        deactivateMut, restoreMut,
        bulkDeactivateMut, bulkRestoreMut,

        // Delete
        deleteTarget, setDeleteTarget,

        // RBAC
        canCreate, canEdit, canDelete,
    };
}
