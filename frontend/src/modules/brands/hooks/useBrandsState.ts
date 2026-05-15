/**
 * useBrandsState — Centralized state management for BrandsPage.
 * Follows the useSuppliersState pattern with server-side pagination.
 */
import { createSignal, createMemo, batch } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { copyToClipboard } from '@shared/utils/clipboard';
import { useDataTable } from '@shared/hooks/useDataTable';
import { useAuth } from '@/modules/auth/store/auth.store';
import { useBrands } from '../data/brands.queries';
import { useDeactivateBrand, useRestoreBrand, useBulkDeactivateBrand, useBulkRestoreBrand } from '../data/brands.mutations';
import { brandKeys } from '../data/brands.keys';
import { brandsApi, type BrandItem, type BrandFilters } from '../data/brands.api';
import { createBrandColumns } from '../data/brands.columns';

export function useBrandsState() {
    const navigate = useNavigate();
    const auth = useAuth();

    // Confirmation dialogs
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = createSignal(false);
    const [showBulkRestoreConfirm, setShowBulkRestoreConfirm] = createSignal(false);

    // Table state
    let getQueryData = () => [] as BrandItem[];
    let getQueryMeta = () => undefined as any;

    const tableState = useDataTable<BrandItem>({
        data: () => getQueryData(),
        meta: () => getQueryMeta(),
        isCursorBased: true,
    });

    // Query filters
    const filters = (): BrandFilters => ({
        cursor: tableState.isSortedMode() ? undefined : tableState.cursor(),
        direction: tableState.isSortedMode() ? undefined : tableState.direction(),
        sortBy: tableState.sortBy(),
        sortOrder: tableState.sortOrder(),
        page: tableState.isSortedMode() ? tableState.page() : undefined,
        limit: tableState.pageSize(),
        search: tableState.search() || undefined,
    });

    // Queries & mutations
    const brandsQuery = useBrands(filters);
    getQueryData = () => (brandsQuery.data as any)?.data ?? [];
    getQueryMeta = () => (brandsQuery.data as any)?.meta;

    const deactivateMut = useDeactivateBrand();
    const restoreMut = useRestoreBrand();
    const bulkDeleteMut = useBulkDeactivateBrand();
    const bulkRestoreMut = useBulkRestoreBrand();

    // Derived
    const brands = () => (brandsQuery.data as any)?.data ?? [];
    const selectedActiveCount = () => tableState.selectedItems().filter((b: BrandItem) => b.is_active ?? true).length;
    const selectedInactiveCount = () => tableState.selectedItems().filter((b: BrandItem) => !(b.is_active ?? true)).length;

    // Handlers
    const handleEdit = (brand: BrandItem) => navigate({ to: `/brands/${brand.id}/edit` });

    const handleDeactivate = (brand: BrandItem) => {
        deactivateMut.mutate(brand.id, {
            onSuccess: () => toast.success(`"${brand.name}" desactivada`),
            onError: (err: any) => toast.error(err.message || 'Error'),
        });
    };

    const handleRestore = (brand: BrandItem) => {
        restoreMut.mutate(brand.id, {
            onSuccess: () => toast.success(`"${brand.name}" restaurada`),
            onError: (err: any) => toast.error(err.message || 'Error'),
        });
    };

    const handleBulkDelete = () => setShowBulkDeleteConfirm(true);

    const confirmBulkDelete = () => {
        const ids = tableState.selectedItems().filter((b: BrandItem) => b.is_active ?? true).map((b: BrandItem) => b.id);
        if (ids.length === 0) return;
        bulkDeleteMut.mutate(ids, {
            onSuccess: () => { toast.success(`${ids.length} marcas desactivadas`); tableState.setRowSelection({}); setShowBulkDeleteConfirm(false); },
            onError: (err: any) => toast.error(err.message || 'Error'),
        });
    };

    const confirmBulkRestore = () => {
        const ids = tableState.selectedItems().filter((b: BrandItem) => !(b.is_active ?? true)).map((b: BrandItem) => b.id);
        if (ids.length === 0) return;
        bulkRestoreMut.mutate(ids, {
            onSuccess: () => { toast.success(`${ids.length} marcas restauradas`); tableState.setRowSelection({}); setShowBulkRestoreConfirm(false); },
            onError: (err: any) => toast.error(err.message || 'Error'),
        });
    };

    const handleCopySelection = async () => {
        const selected = tableState.selectedItems();
        if (selected.length === 0) return;
        const text = selected.map((b: BrandItem) => `${b.name}${b.website ? ` — ${b.website}` : ''}`).join('\n');
        const ok = await copyToClipboard(text);
        if (ok) toast.success(`Copiado ${selected.length} marcas`);
        else toast.error('Error al copiar');
        tableState.setRowSelection({});
    };

    // Columns
    const columns = createMemo(() =>
        createBrandColumns({
            onDelete: handleDeactivate,
            onRestore: handleRestore,
        })
    );

    return {
        ...tableState,
        auth,
        brandsQuery, brands,
        showBulkDeleteConfirm, setShowBulkDeleteConfirm,
        showBulkRestoreConfirm, setShowBulkRestoreConfirm,
        selectedActiveCount, selectedInactiveCount,
        bulkDeleteMut, bulkRestoreMut,
        handleEdit, handleDeactivate, handleRestore,
        handleBulkDelete, confirmBulkDelete, confirmBulkRestore,
        handleCopySelection,
        columns, filters,
    };
}
