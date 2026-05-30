/**
 * useLocationState — Central state for the Locations module.
 *
 * Manages:
 * - Search / warehouse / type / status filters (single-pass counting)
 * - Row selection + batch actions via bulk endpoints
 * - SSE real-time invalidation
 * - RBAC permissions
 * - Client-side filter pipeline (flat → filter → buildSubRows → render)
 */
import { createSignal, createMemo, createEffect } from 'solid-js';
import type { RowSelectionState } from '@tanstack/solid-table';
import { useSearch } from '@tanstack/solid-router';
import { useAuth } from '@modules/auth/store/auth.store';
import { locationKeys } from '../data/locations.keys';
import { useDataTableSSE } from '@shared/hooks/useDataTableSSE';
import { useLocationList } from '../data/locations.queries';
import { useWarehousesList } from '@modules/settings/data/warehouses.queries';
import {
    useDeactivateLocation,
    useRestoreLocation,
    useBulkDeactivateLocations,
    useBulkRestoreLocations,
} from '../data/locations.mutations';
import type { LocationItem } from '../data/locations.api';
import { toast } from 'solid-sonner';
import { copyToClipboard } from '@shared/utils/clipboard';

export type LocationState = ReturnType<typeof useLocationState>;

export function useLocationState() {
    const auth = useAuth();
    const searchParams = useSearch({ strict: false }) as () => { warehouseId?: number };

    // ─── RBAC ────────────────────────────────────────────────────
    const canCreate = () => auth.canAdd('locations');
    const canEdit = () => auth.canEdit('locations');
    const canDelete = () => auth.canDelete('locations');

    // ─── Data ────────────────────────────────────────────────────
    const locationQuery = useLocationList();
    const warehousesQuery = useWarehousesList();
    const deactivateMut = useDeactivateLocation();
    const restoreMut = useRestoreLocation();
    const bulkDeactivateMut = useBulkDeactivateLocations();
    const bulkRestoreMut = useBulkRestoreLocations();

    // SSE invalidation
    useDataTableSSE({ room: 'locations', queryKey: locationKeys.list() });

    // ─── Table Instance ──────────────────────────────────────────
    const [tableInstance, setTableInstance] = createSignal<any>();

    // ─── Filters ─────────────────────────────────────────────────
    const [search, setSearch] = createSignal('');
    const [warehouseFilter, setWarehouseFilter] = createSignal<string[]>([]);
    const [typeFilter, setTypeFilter] = createSignal<string[]>([]);
    const [statusFilter, setStatusFilter] = createSignal<string[]>(['active']);

    createEffect(() => {
        const whId = searchParams().warehouseId;
        if (whId !== undefined) {
            setWarehouseFilter([String(whId)]);
        } else {
            setWarehouseFilter([]);
        }
    });

    // ─── Raw Data + Indexed Map ──────────────────────────────────
    const rawList = () => (locationQuery.data ?? []) as LocationItem[];
    const rawMap = createMemo(() => new Map(rawList().map(l => [l.id, l])));

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
        selectedIds().map(id => rawMap().get(id)).filter(Boolean) as LocationItem[]
    );
    const selectedActive = createMemo(() =>
        selectedItems().filter(l => l.is_active !== false)
    );
    const selectedInactive = createMemo(() =>
        selectedItems().filter(l => l.is_active === false)
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
        const wh = new Map<number, number>();
        const type = new Map<string, number>();
        let active = 0, inactive = 0;

        for (const loc of rawList()) {
            if (loc.warehouse_id) wh.set(loc.warehouse_id, (wh.get(loc.warehouse_id) ?? 0) + 1);
            type.set(loc.type, (type.get(loc.type) ?? 0) + 1);
            loc.is_active !== false ? active++ : inactive++;
        }
        return { wh, type, active, inactive };
    });

    const warehouseFilterOptions = createMemo(() => {
        const whList = warehousesQuery.data ?? [];
        const counts = filterCounts().wh;
        return whList.map(wh => ({
            value: String(wh.id),
            label: `${wh.code} — ${wh.name}`,
            count: counts.get(wh.id) ?? 0,
        }));
    });

    const typeFilterOptions = createMemo(() => {
        const counts = filterCounts().type;
        return [
            { value: 'VIEW', label: 'Virtual', count: counts.get('VIEW') ?? 0 },
            { value: 'INTERNAL', label: 'Almacenamiento', count: counts.get('INTERNAL') ?? 0 },
        ];
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

        const whs = warehouseFilter();
        if (whs.length > 0) {
            list = list.filter(l => l.warehouse_id !== null && whs.includes(String(l.warehouse_id)));
        }

        const ts = typeFilter();
        if (ts.length > 0) {
            list = list.filter(l => ts.includes(l.type));
        }

        const ss = statusFilter();
        if (ss.length > 0) {
            list = list.filter(l => {
                const isActiveStr = l.is_active !== false ? 'active' : 'inactive';
                return ss.includes(isActiveStr);
            });
        }

        const q = search().toLowerCase().trim();
        if (q) {
            list = list.filter(l =>
                l.name.toLowerCase().includes(q) ||
                l.path.toLowerCase().includes(q)
            );
        }

        return list;
    });

    const totalCount = createMemo(() => rawList().length);
    const filteredCount = createMemo(() => filteredList().length);

    // ─── Delete Dialog ───────────────────────────────────────────
    const [deleteTarget, setDeleteTarget] = createSignal<LocationItem | null>(null);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = createSignal(false);
    const [showBulkRestoreConfirm, setShowBulkRestoreConfirm] = createSignal(false);

    // ─── Batch Actions (Bulk Endpoints) ──────────────────────────
    const handleBulkDelete = () => {
        setShowBulkDeleteConfirm(true);
    };

    const confirmBulkDelete = async () => {
        const activeIds = selectedActive().map(l => l.id);
        if (activeIds.length === 0) {
            setShowBulkDeleteConfirm(false);
            return;
        }
        try {
            await bulkDeactivateMut.mutateAsync(activeIds);
            toast.success(`${activeIds.length} ubicaciones desactivadas`);
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
        const inactiveIds = selectedInactive().map(l => l.id);
        if (inactiveIds.length === 0) {
            setShowBulkRestoreConfirm(false);
            return;
        }
        try {
            await bulkRestoreMut.mutateAsync(inactiveIds);
            toast.success(`${inactiveIds.length} ubicaciones restauradas`);
            clearSelection();
            setShowBulkRestoreConfirm(false);
        } catch (e: any) {
            toast.error(e?.message ?? 'Error al restaurar');
        }
    };

    const handleCopySelection = async () => {
        const items = selectedItems();
        const text = items.map(l => `${l.name}\t${l.type}\t${l.path}\t${l.warehouse_name ?? ''}`).join('\n');
        const ok = await copyToClipboard(text);
        if (ok) {
            toast.success(`${items.length} ubicaciones copiadas al portapapeles`);
        } else {
            toast.error('No se pudo copiar al portapapeles');
        }
    };

    const handleDelete = (item: LocationItem) => {
        setDeleteTarget(item);
    };

    const handleRestore = (item: LocationItem) => {
        restoreMut.mutate(item.id, {
            onSuccess: () => {
                clearSelection([item.id]);
                toast.success(`"${item.name}" restaurada`);
            },
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
        });
    };

    const filters = {
        warehouse: {
            options: warehouseFilterOptions,
            selected: warehouseFilter,
            onChange: setWarehouseFilter,
            isLoading: () => warehousesQuery.isPending,
        },
        type: {
            options: typeFilterOptions,
            selected: typeFilter,
            onChange: setTypeFilter,
            isLoading: () => false,
        },
        status: {
            options: statusFilterOptions,
            selected: statusFilter,
            onChange: setStatusFilter,
            isLoading: () => false,
        },
    };

    return {
        // Data
        locationQuery, filteredList, totalCount, filteredCount,

        // Table Instance
        tableInstance, setTableInstance,

        // Filters
        search, setSearch,
        warehouseFilter, setWarehouseFilter,
        typeFilter, setTypeFilter,
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
