/**
 * useProductsState — All state, queries, mutations, and handlers for ProductsPage.
 */
import { createSignal, createMemo, batch } from 'solid-js';
import { useQueryClient } from '@tanstack/solid-query';
import { useNavigate } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { copyToClipboard } from '@shared/utils/clipboard';
import { buildFilterOptions } from '@shared/utils/facets.utils';
import { isActiveLabels } from '@shared/constants/labels';
import { productTypeLabels, productKeys, productsApi } from '../data/products.api';
import type { ProductFilters, ProductListItem } from '../data/products.api';
import { useProducts, useProductFacets } from '../data/products.queries';
import { useDeleteProduct, useBulkDeleteProduct, useBulkRestoreProduct, useRestoreProduct } from '../data/products.mutations';
import { useDataTable } from '@shared/hooks/useDataTable';
import { useDataTableSSE, useRealtimeInvalidation } from '@shared/hooks/useDataTableSSE';
import { useAuth } from '@/modules/auth/store/auth.store';
import { createProductColumns } from '../data/product.columns';

export function useProductsState() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const auth = useAuth();

    // Filter signals
    const [categoryFilter, setCategoryFilter] = createSignal<string[]>([]);
    const [brandFilter, setBrandFilter] = createSignal<string[]>([]);
    const [productTypeFilter, setProductTypeFilter] = createSignal<string[]>([]);
    const [isActiveFilter, setIsActiveFilter] = createSignal<string[]>([]);
    const [showFilterSheet, setShowFilterSheet] = createSignal(false);

    // Delete / Restore confirmation state
    const [deleteTarget, setDeleteTarget] = createSignal<ProductListItem | null>(null);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = createSignal(false);
    const [showBulkRestoreConfirm, setShowBulkRestoreConfirm] = createSignal(false);

    // ─── SSE ─────────────────────────────────────────────────────
    useDataTableSSE({ room: 'products', queryKey: productKeys.lists() });
    useRealtimeInvalidation([...productKeys.all, 'facets']);

    // ─── Table State ─────────────────────────────────────────────
    let getQueryData = () => [] as ProductListItem[];
    let getQueryMeta = () => undefined as any;

    const tableState = useDataTable<ProductListItem>({
        data: () => getQueryData(),
        meta: () => getQueryMeta(),
        isCursorBased: true,
    });

    // ─── Query Filters ───────────────────────────────────────────
    const filters = (): ProductFilters => ({
        cursor: tableState.isSortedMode() ? undefined : tableState.cursor(),
        direction: tableState.isSortedMode() ? undefined : tableState.direction(),
        sortBy: tableState.sortBy(),
        sortOrder: tableState.sortOrder(),
        page: tableState.isSortedMode() ? tableState.page() : undefined,
        limit: tableState.pageSize(),
        search: tableState.search() || undefined,
        categoryId: categoryFilter().length > 0 ? categoryFilter() : undefined,
        brandId: brandFilter().length > 0 ? brandFilter() : undefined,
        productType: productTypeFilter().length > 0 ? productTypeFilter() : undefined,
        isActive: isActiveFilter().length > 0 ? isActiveFilter() : undefined,
    });

    // ─── Queries & Mutations ─────────────────────────────────────
    const productsQuery = useProducts(filters);
    getQueryData = () => productsQuery.data?.data ?? [];
    getQueryMeta = () => productsQuery.data?.meta;
    const facetsQuery = useProductFacets(
        () => tableState.search() || undefined,
        () => ({
            categoryId: categoryFilter().length > 0 ? categoryFilter() : undefined,
            brandId: brandFilter().length > 0 ? brandFilter() : undefined,
            productType: productTypeFilter().length > 0 ? productTypeFilter() : undefined,
            isActive: isActiveFilter().length > 0 ? isActiveFilter() : undefined,
        })
    );

    const deleteMutation = useDeleteProduct();
    const bulkRestoreMutation = useBulkRestoreProduct();
    const bulkDeleteMutation = useBulkDeleteProduct();
    const restoreMutation = useRestoreProduct();

    // ─── Derived Data ────────────────────────────────────────────
    const products = () => productsQuery.data?.data ?? [];
    const meta = () => productsQuery.data?.meta;

    const selectedActiveCount = () => tableState.selectedItems().filter(p => p.is_active).length;
    const selectedInactiveCount = () => tableState.selectedItems().filter(p => !p.is_active).length;

    // ─── Navigation Handlers ─────────────────────────────────────
    // const handleNew = () => navigate({ to: '/products/new' });
    // const handleView = (p: ProductListItem) => navigate({ to: `/products/${p.id}` });
    // const handleEdit = (p: ProductListItem) => navigate({ to: `/products/${p.id}/edit` });
    const handlePrefetch = (p: ProductListItem) => {
        queryClient.prefetchQuery({
            queryKey: productKeys.detail(p.id),
            queryFn: () => productsApi.get(p.id),
            staleTime: 1000 * 60 * 5,
        });
    };

    // ─── Action Handlers ─────────────────────────────────────────
    const handleCopySelection = async () => {
        const selected = tableState.selectedItems();
        if (selected.length === 0) return;
        const text = selected.map(p => {
            return `${p.sku} | ${p.name} | $${Number(p.base_price).toFixed(2)}`;
        }).join('\n');
        const ok = await copyToClipboard(text);
        if (ok) toast.success(`Copiado ${selected.length} productos al portapapeles`);
        else toast.error('Error al copiar al portapapeles');
        tableState.setRowSelection({});
    };

    const handleDelete = (product: ProductListItem) => setDeleteTarget(product);

    const handleRestore = (product: ProductListItem) => {
        restoreMutation.mutate(product.id, {
            onSuccess: () => toast.success(`Se ha restaurado '${product.name}'`),
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
        });
    };

    const handleBulkDelete = () => setShowBulkDeleteConfirm(true);

    const confirmBulkDelete = () => {
        const ids = tableState.selectedItems().filter(p => p.is_active).map(p => p.id);
        if (ids.length === 0) return;
        bulkDeleteMutation.mutate(ids, {
            onSuccess: () => { toast.success(`${ids.length} productos eliminados`); tableState.setRowSelection({}); setShowBulkDeleteConfirm(false); },
            onError: (err: any) => toast.error(err.message || 'Error al eliminar'),
        });
    };

    const confirmBulkRestore = () => {
        const ids = tableState.selectedItems().filter(p => !p.is_active).map(p => p.id);
        if (ids.length === 0) return;
        bulkRestoreMutation.mutate(ids, {
            onSuccess: () => { toast.success(`${ids.length} productos restaurados`); tableState.setRowSelection({}); setShowBulkRestoreConfirm(false); },
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
        });
    };

    const handleFilterChange = (setter: (v: string[]) => void) => (selected: string[]) => {
        batch(() => { setter(selected); tableState.setCursor(undefined); tableState.setDirection('first'); });
    };

    // ─── Filter Options ──────────────────────────────────────────
    // For category/brand, the facets return {value: id, label: name} so we use labels
    const categoryFilterOptions = createMemo(() => {
        const facets = facetsQuery.data?.category_id;
        if (!facets) return [];
        return facets.map(f => ({ value: f.value, label: f.label || f.value, count: f.count }));
    });
    const brandFilterOptions = createMemo(() => {
        const facets = facetsQuery.data?.brand_id;
        if (!facets) return [];
        return facets.map(f => ({ value: f.value, label: f.label || f.value, count: f.count }));
    });
    const productTypeFilterOptions = createMemo(() => buildFilterOptions(facetsQuery.data, 'product_type', productTypeLabels));
    const isActiveFilterOptions = createMemo(() => buildFilterOptions(facetsQuery.data, 'is_active', isActiveLabels));

    // ─── Column Definitions ──────────────────────────────────────
    const columns = createMemo(() =>
        createProductColumns({
            onDelete: handleDelete,
            onRestore: handleRestore,
            auth,
            filters: {
                categoryId: { options: categoryFilterOptions, selected: categoryFilter, onChange: handleFilterChange(setCategoryFilter), isLoading: () => facetsQuery.isPending },
                brandId: { options: brandFilterOptions, selected: brandFilter, onChange: handleFilterChange(setBrandFilter), isLoading: () => facetsQuery.isPending },
                productType: { options: productTypeFilterOptions, selected: productTypeFilter, onChange: handleFilterChange(setProductTypeFilter), isLoading: () => facetsQuery.isPending },
                isActive: { options: isActiveFilterOptions, selected: isActiveFilter, onChange: handleFilterChange(setIsActiveFilter), isLoading: () => facetsQuery.isPending },
            },
        })
    );

    return {
        ...tableState,

        // State
        auth,
        showFilterSheet, setShowFilterSheet, deleteTarget, setDeleteTarget,
        showBulkDeleteConfirm, setShowBulkDeleteConfirm, showBulkRestoreConfirm, setShowBulkRestoreConfirm,

        // Query results
        productsQuery, facetsQuery, products, meta,
        selectedActiveCount, selectedInactiveCount,

        // Mutations
        deleteMutation, bulkDeleteMutation, bulkRestoreMutation,

        // Handlers
        // handleNew, handleView, handleEdit,
        handlePrefetch, handleCopySelection, handleDelete, handleRestore, handleBulkDelete,
        confirmBulkDelete, confirmBulkRestore, handleFilterChange, filters,

        // Columns
        columns,

        // Filter configs (for FilterSheet)
        filterSheetConfig: {
            categoryId: { options: categoryFilterOptions, selected: categoryFilter, onChange: handleFilterChange(setCategoryFilter), isLoading: () => facetsQuery.isPending },
            brandId: { options: brandFilterOptions, selected: brandFilter, onChange: handleFilterChange(setBrandFilter), isLoading: () => facetsQuery.isPending },
            productType: { options: productTypeFilterOptions, selected: productTypeFilter, onChange: handleFilterChange(setProductTypeFilter), isLoading: () => facetsQuery.isPending },
            isActive: { options: isActiveFilterOptions, selected: isActiveFilter, onChange: handleFilterChange(setIsActiveFilter), isLoading: () => facetsQuery.isPending },
        },

        hasActiveFilters: () => categoryFilter().length > 0 || brandFilter().length > 0 || productTypeFilter().length > 0 || isActiveFilter().length > 0,
    };
}

export type ProductsState = ReturnType<typeof useProductsState>;
