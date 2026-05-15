/**
 * useLocationState — Central state for the Locations module.
 *
 * Manages:
 * - Search / warehouse / type / status filters
 * - Row selection + batch actions (deactivate, restore, copy)
 * - SSE real-time invalidation
 * - RBAC permissions
 * - Client-side filter pipeline (flat → filter → buildSubRows → render)
 */
import { createSignal, createMemo } from 'solid-js';
import type { RowSelectionState } from '@tanstack/solid-table';
import { useAuth } from '@modules/auth/store/auth.store';
import { locationKeys } from '../data/locations.keys';
import { useRealtimeInvalidation } from '@shared/hooks/useDataTableSSE';
import { useLocationList } from '../data/locations.queries';
import {
    useDeactivateLocation,
    useRestoreLocation,
} from '../data/locations.mutations';
import type { LocationItem } from '../data/locations.api';
import { toast } from 'solid-sonner';

export function useLocationState() {
    const auth = useAuth();

    // ─── RBAC ────────────────────────────────────────────────────
    const canCreate = () => auth.canAdd('locations');
    const canEdit = () => auth.canEdit('locations');
    const canDelete = () => auth.canDelete('locations');

    // ─── Data ────────────────────────────────────────────────────
    const locationQuery = useLocationList();
    const deactivateMut = useDeactivateLocation();
    const restoreMut = useRestoreLocation();

    // SSE invalidation
    useRealtimeInvalidation(locationKeys.all);

    // ─── Filters ─────────────────────────────────────────────────
    const [search, setSearch] = createSignal('');
    const [warehouseFilter, setWarehouseFilter] = createSignal<number | null>(null);
    const [typeFilter, setTypeFilter] = createSignal<string | null>(null); // 'VIEW' | 'INTERNAL' | null (all)
    const [statusFilter, setStatusFilter] = createSignal<string>('active'); // 'active' | 'inactive' | 'all'

    // ─── Row Selection ───────────────────────────────────────────
    const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});

    const selectedIds = createMemo(() =>
        Object.entries(rowSelection())
            .filter(([_, v]) => v)
            .map(([k]) => Number(k))
    );
    const selectedCount = createMemo(() => selectedIds().length);

    // ─── Filter Pipeline ─────────────────────────────────────────
    // Applied on flat list BEFORE buildSubRows (tree construction)
    const rawList = () => (locationQuery.data ?? []) as LocationItem[];

    const filteredList = createMemo(() => {
        let list = rawList();

        // Warehouse filter
        const wh = warehouseFilter();
        if (wh !== null) {
            list = list.filter(l => l.warehouse_id === wh);
        }

        // Type filter
        const t = typeFilter();
        if (t !== null) {
            list = list.filter(l => l.type === t);
        }

        // Status filter
        const s = statusFilter();
        if (s === 'active') {
            list = list.filter(l => l.is_active !== false);
        } else if (s === 'inactive') {
            list = list.filter(l => l.is_active === false);
        }
        // 'all' → no filter

        // Text search
        const q = search().toLowerCase().trim();
        if (q) {
            list = list.filter(l =>
                l.name.toLowerCase().includes(q) ||
                l.path.toLowerCase().includes(q) ||
                (l.barcode && l.barcode.toLowerCase().includes(q))
            );
        }

        return list;
    });

    const totalCount = createMemo(() => rawList().length);
    const filteredCount = createMemo(() => filteredList().length);

    // ─── Delete Dialog ───────────────────────────────────────────
    const [deleteTarget, setDeleteTarget] = createSignal<LocationItem | null>(null);

    // ─── Batch Actions ───────────────────────────────────────────
    const handleBatchDeactivate = () => {
        const ids = selectedIds();
        if (ids.length === 0) return;
        let done = 0;
        ids.forEach(id => {
            deactivateMut.mutate(id, {
                onSuccess: () => {
                    done++;
                    if (done === ids.length) {
                        toast.success(`${ids.length} ubicaciones desactivadas`);
                        setRowSelection({});
                    }
                },
                onError: (e: Error) => toast.error(e?.message ?? 'Error al desactivar'),
            });
        });
    };

    const handleBatchRestore = () => {
        const ids = selectedIds();
        if (ids.length === 0) return;
        let done = 0;
        ids.forEach(id => {
            restoreMut.mutate(id, {
                onSuccess: () => {
                    done++;
                    if (done === ids.length) {
                        toast.success(`${ids.length} ubicaciones restauradas`);
                        setRowSelection({});
                    }
                },
                onError: (e: Error) => toast.error(e?.message ?? 'Error al restaurar'),
            });
        });
    };

    const handleCopySelection = () => {
        const ids = selectedIds();
        const items = rawList().filter(l => ids.includes(l.id));
        const text = items.map(l => `${l.name}\t${l.type}\t${l.path}\t${l.barcode ?? ''}`).join('\n');
        navigator.clipboard.writeText(text);
        toast.success(`${items.length} ubicaciones copiadas al portapapeles`);
    };

    return {
        // Data
        locationQuery,
        filteredList,
        totalCount,
        filteredCount,

        // Filters
        search, setSearch,
        warehouseFilter, setWarehouseFilter,
        typeFilter, setTypeFilter,
        statusFilter, setStatusFilter,

        // Selection
        rowSelection, setRowSelection,
        selectedCount,
        handleBatchDeactivate,
        handleBatchRestore,
        handleCopySelection,

        // Delete
        deleteTarget, setDeleteTarget,

        // RBAC
        canCreate, canEdit, canDelete,
    };
}
