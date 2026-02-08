import { Component, For, Show, createMemo, createSignal, onMount, onCleanup, batch } from 'solid-js';
import { createQuery, createMutation, useQueryClient, keepPreviousData } from '@tanstack/solid-query';
import { createSolidTable, flexRender, getCoreRowModel, getSortedRowModel, getFilteredRowModel, type ColumnDef, type SortingState, type VisibilityState, type RowSelectionState } from '@tanstack/solid-table';
import { toast } from 'solid-sonner';
import { DropdownMenu } from '@kobalte/core';
import { useNavigate, Outlet } from '@tanstack/solid-router';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { productsApi } from '../data/products.api';
import { productKeys, categoryKeys, brandKeys } from '../data/products.keys';
import type { Product, ProductClass, ProductFilters, Category, Brand } from '../models/products.types';
import { productTypeLabels } from '../models/products.types';
import { useWebSocket } from '@shared/store/ws.store';
import { ProductTypeBadge } from '../components/ProductTypeBadge';
import { PageHeader } from '@shared/ui/PageHeader';
import { SearchInput } from '@shared/ui/SearchInput';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import { EmptyState } from '@shared/ui/EmptyState';
import Switch from '@shared/ui/Switch';
import Checkbox from '@shared/ui/Checkbox';
import { StatusBadge } from '@shared/ui/Badge';

import { PlusIcon, EditIcon, TrashIcon, ColumnsIcon, FilterIcon, ChevronDownIcon, ProductIcon } from '@shared/ui/icons';

const formatCurrency = (value: string | number) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(num);
};

const ProductsPage: Component = () => {
  const queryClient = useQueryClient();

  const [filters, setFilters] = createSignal<ProductFilters>({ limit: 50, offset: 0 });
  const [searchInput, setSearchInput] = createSignal('');
  const [sorting, setSorting] = createSignal<SortingState>([]);
  const [globalFilter, setGlobalFilter] = createSignal('');
  const [columnVisibility, setColumnVisibility] = createSignal<VisibilityState>({});
  const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});
  const [columnFilters, setColumnFilters] = createSignal<{ id: string; value: any }[]>([]);
  const [columnPinning, setColumnPinning] = createSignal<{ left?: string[]; right?: string[] }>({});
  let tableContainerRef: HTMLDivElement | undefined;
  // Router - simple path navigation
  const navigate = useNavigate();
  // WebSocket for real-time updates
  const { subscribe, unsubscribe } = useWebSocket();

  onMount(() => {
    subscribe('products');

    const handleProductCreated = (e: CustomEvent) => {
      toast.info('Nuevo producto agregado', { description: e.detail?.name || 'Actualiza para ver' });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    };

    const handleProductUpdated = (e: CustomEvent) => {
      toast.info('Producto actualizado', { description: e.detail?.name });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    };

    const handleProductDeleted = () => {
      toast.info('Producto eliminado');
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    };

    window.addEventListener('product:created', handleProductCreated as EventListener);
    window.addEventListener('product:updated', handleProductUpdated as EventListener);
    window.addEventListener('product:deleted', handleProductDeleted as EventListener);

    onCleanup(() => {
      unsubscribe('products');
      window.removeEventListener('product:created', handleProductCreated as EventListener);
      window.removeEventListener('product:updated', handleProductUpdated as EventListener);
      window.removeEventListener('product:deleted', handleProductDeleted as EventListener);
    });
  });


  // Queries
  const productsQuery = createQuery(() => ({
    queryKey: productKeys.list(filters()),
    queryFn: () => productsApi.list(filters()),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  }));

  const categoriesQuery = createQuery(() => ({
    queryKey: categoryKeys.list(),
    queryFn: () => productsApi.listCategories(),
    staleTime: 1000 * 60 * 10,
  }));

  const brandsQuery = createQuery(() => ({
    queryKey: brandKeys.list(),
    queryFn: () => productsApi.listBrands(),
    staleTime: 1000 * 60 * 10,
  }));

  // Mutations
  const deleteMutation = createMutation(() => ({
    mutationFn: (id: number) => productsApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: productKeys.all });
      const previousProducts = queryClient.getQueryData(productKeys.list(filters()));

      queryClient.setQueryData(productKeys.list(filters()), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.filter((p: Product) => p.id !== id),
          meta: { ...old.meta, total: old.meta.total - 1 }
        };
      });

      return { previousProducts };
    },
    onError: (err, _id, context: any) => {
      toast.error(`Error al eliminar: ${err.message}`);
      if (context?.previousProducts) {
        queryClient.setQueryData(productKeys.list(filters()), context.previousProducts);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
    onSuccess: () => toast.success('Producto eliminado correctamente'),
  }));

  const bulkDeleteMutation = createMutation(() => ({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => productsApi.delete(id)));
    },
    onSuccess: () => {
      toast.success(`${Object.keys(rowSelection()).length} productos eliminados`);
      setRowSelection({});
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  }));

  // Derived data
  const products = () => productsQuery.data?.data ?? [];
  const meta = () => productsQuery.data?.meta;
  const categories = () => categoriesQuery.data ?? [];
  const brands = () => brandsQuery.data ?? [];
  const selectedCount = () => Object.keys(rowSelection()).length;



  // Flatten categories for select
  const flatCategories = createMemo(() => {
    const flat: { value: number; label: string }[] = [];
    const traverse = (cats: Category[], level = 0) => {
      for (const cat of cats) {
        flat.push({ value: cat.id, label: '—'.repeat(level) + ' ' + cat.name });
        if (cat.children) traverse(cat.children, level + 1);
      }
    };
    traverse(categories());
    return flat;
  });

  // Debounced search handler for SearchInput
  const handleSearchInput = (value: string) => {
    batch(() => {
      setSearchInput(value);
      setGlobalFilter(value);
      setFilters(prev => ({ ...prev, search: value, offset: 0 }));
    });
  };

  // Table columns
  const columns: ColumnDef<Product>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
          />
        </div>
      ),
      size: 40,
      enableSorting: false,
      enableHiding: false,
      enablePinning: false,
    },
    {
      id: 'image',
      header: '',
      size: 60,
      enableHiding: false,
      cell: (info) => {
        const urls = info.row.original.image_urls;
        return (
          <div class="w-10 h-10 rounded-lg bg-surface/50 flex items-center justify-center overflow-hidden ring-1 ring-white/5">
            <Show when={urls && urls.length > 0} fallback={
              <svg class="w-5 h-5 text-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }>
              <img src={urls![0]} alt="" class="w-full h-full object-cover" loading="lazy" />
            </Show>
          </div>
        );
      },
    },
    {
      accessorKey: 'sku',
      header: 'SKU',
      size: 120,
      cell: (info) => <span class="font-mono text-sm font-semibold text-primary">{info.getValue<string>()}</span>,
    },
    {
      accessorKey: 'name',
      header: 'Producto',
      size: 280,
      cell: (info) => {
        const row = info.row.original;
        return (
          <div class="min-w-0">
            <div class="font-medium truncate">{row.name}</div>
            <Show when={row.description}>
              <div class="text-xs text-muted truncate mt-0.5 max-w-[250px]">{row.description}</div>
            </Show>
          </div>
        );
      },
    },
    {
      accessorKey: 'product_type',
      header: 'Tipo',
      size: 100,
      cell: (info) => <ProductTypeBadge type={info.getValue<ProductClass>()} />,
    },
    {
      id: 'category',
      header: 'Categoría',
      size: 140,
      accessorFn: (row) => row.category?.name,
      cell: (info) => <span class="text-muted text-sm">{info.getValue<string>() ?? '—'}</span>,
    },
    {
      id: 'brand',
      header: 'Marca',
      size: 110,
      accessorFn: (row) => row.brand?.name,
      cell: (info) => <span class="text-muted text-sm">{info.getValue<string>() ?? '—'}</span>,
    },
    {
      accessorKey: 'base_price',
      header: 'Precio',
      size: 100,
      cell: (info) => <span class="font-semibold" style={{ color: 'var(--color-price-text)' }}>{formatCurrency(info.getValue<string>())}</span>,
    },
    {
      accessorKey: 'last_cost',
      header: 'Costo',
      size: 90,
      cell: (info) => <span class="text-muted text-sm">{formatCurrency(info.getValue<string>())}</span>,
    },
    {
      accessorKey: 'is_active',
      header: 'Estado',
      size: 80,
      cell: (info) => {
        const active = info.getValue<boolean>();
        return (
          <StatusBadge isActive={active} />
        );
      },
    },
    {
      id: 'actions',
      header: '',
      size: 80,
      enableHiding: false,
      cell: (info) => {
        const row = info.row.original;
        return (
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
              class="p-1.5 rounded-lg hover:bg-blue-500/20 text-muted hover:text-blue-400"
              title="Editar"
            >
              <EditIcon />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
              class="p-1.5 rounded-lg hover:bg-red-500/20 text-muted hover:text-red-400"
              title="Eliminar"
            >
              <TrashIcon />
            </button>
          </div>
        );
      },
    },
  ];

  // Table instance
  const table = createSolidTable({
    get data() { return products() },
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters as any,
    onColumnPinningChange: setColumnPinning as any,
    enableColumnPinning: true,
    state: {
      get sorting() { return sorting() },
      get rowSelection() { return rowSelection() },
      get columnVisibility() { return columnVisibility() },
      get columnFilters() { return columnFilters() },
      get columnPinning() { return columnPinning() },
    },
  });

  // Handlers
  const handleNew = () => {
    navigate({ to: '/products/new' });
  };

  const handleEdit = (product: Product) => {
    // Pre-seed cache from table data for instant display
    queryClient.setQueryData(['product', product.id], product);
    navigate({ to: `/products/edit/${product.id}` });
  };

  const handleView = (product: Product) => {
    // Pre-seed cache from table data for instant display
    queryClient.setQueryData(['product', product.id], product);
    navigate({ to: `/products/show/${product.id}` });
  };

  const handlePrefetch = (product: Product) => {
    queryClient.prefetchQuery({
      queryKey: productKeys.detail(product.id),
      queryFn: () => productsApi.get(product.id),
      staleTime: 1000 * 60 * 5,
    });
  };

  const handleDelete = (product: Product) => {
    if (confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`)) {
      deleteMutation.mutate(product.id);
    }
  };

  const handleBulkDelete = () => {
    const ids = Object.keys(rowSelection()).map(Number);
    if (confirm(`¿Eliminar ${ids.length} productos? Esta acción no se puede deshacer.`)) {
      bulkDeleteMutation.mutate(ids);
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    toast.info('Actualizando productos...');
  };

  const handleFilterType = (product_type?: ProductClass) => {
    setFilters((prev) => ({ ...prev, product_type, offset: 0 }));
  };

  // Pagination
  return (
    <div class="h-full flex flex-col bg-gradient-to-br from-background via-background to-surface/20">
      {/* Header */}
      <div class="flex-shrink-0 p-6 space-y-5">
        <PageHeader
          icon={<ProductIcon />}
          iconBg="linear-gradient(135deg, #3b82f6, #9333ea)"
          title="Productos"
          subtitle="Gestión de materiales, herramientas, EPP y activos fijos"
          actions={
            <button onClick={handleNew} class="btn btn-primary gap-2">
              <PlusIcon /> Nuevo Producto
            </button>
          }
        />

        {/* Toolbar */}
        <div class="flex flex-wrap items-center gap-3">
          <SearchInput
            value={searchInput()}
            onSearch={handleSearchInput}
            placeholder="Buscar por SKU, nombre..."
            class="flex-1 min-w-[200px] max-w-md"
            debounceMs={300}
          />

          {/* Column Visibility */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger class="btn btn-ghost gap-2">
              <ColumnsIcon />
              <span class="hidden sm:inline">Columnas</span>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content class="bg-card border border-border rounded-xl shadow-card-soft z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 min-w-[220px] p-3 space-y-2">
                <div class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Visibilidad</div>
                <For each={table.getAllLeafColumns().filter(col => col.getCanHide())}>
                  {(column) => (
                    <div class="flex items-center justify-between py-1.5 px-1 rounded-lg hover:bg-surface/50">
                      <span class="text-sm text-text capitalize">
                        {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
                      </span>
                      <div class="flex items-center gap-2">
                        {/* Pin button */}
                        <Show when={column.getCanPin()}>
                          <button
                            onClick={() => column.pin(column.getIsPinned() ? false : 'left')}
                            class={`p-1 rounded ${column.getIsPinned() ? 'text-primary bg-primary-soft' : 'text-muted hover:text-text'}`}
                            title={column.getIsPinned() ? 'Desfijar' : 'Fijar a la izquierda'}
                          >
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                          </button>
                        </Show>
                        {/* Toggle switch */}
                        <Switch
                          checked={column.getIsVisible()}
                          onChange={column.toggleVisibility}
                          aria-label="Alternar columna"
                        />
                      </div>
                    </div>
                  )}
                </For>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Class Filter Pills */}
          <div class="hidden lg:flex items-center gap-1.5">
            <button
              class={`filter-pill ${!filters().product_type ? 'filter-pill--active' : ''}`}
              onClick={() => handleFilterType(undefined)}
            >
              Todos
            </button>
            <For each={Object.entries(productTypeLabels)}>
              {([key, label]) => (
                <button
                  class={`filter-pill ${filters().product_type === key ? 'filter-pill--active' : ''}`}
                  onClick={() => handleFilterType(key as ProductClass)}
                >
                  {label}
                </button>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <Show when={selectedCount() > 0}>
        <div
          class="flex-shrink-0 mx-6 mb-4 px-4 py-3 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200 border"
          style={{ background: 'var(--color-info-bg)', 'border-color': 'var(--color-info-border)' }}
        >
          <span class="text-sm font-medium" style={{ color: 'var(--color-info-text)' }}>
            {selectedCount()} producto(s) seleccionado(s)
          </span>
          <div class="flex items-center gap-2">
            <button onClick={() => setRowSelection({})} class="btn btn-ghost text-sm py-1.5">
              Cancelar
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              class="btn text-sm py-1.5 gap-2"
              style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)' }}
            >
              <TrashIcon />
              {bulkDeleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </Show>

      {/* Table Container */}
      <div class="flex-1 min-h-0 px-6 pb-6 overflow-hidden flex flex-col">
        <div
          ref={tableContainerRef}
          class="bg-card border border-border rounded-2xl shadow-card-soft h-full overflow-auto relative"
        >
          <Table>
            <TableHeader class="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
              <For each={table.getHeaderGroups()}>
                {(headerGroup) => (
                  <TableRow>
                    <For each={headerGroup.headers}>
                      {(header) => (
                        <TableHead
                          class={`text-xs uppercase tracking-wider text-muted font-semibold ${header.column.getIsPinned() ? 'pinned-column' : ''}`}
                          style={{
                            width: `${header.getSize()}px`,
                            left: header.column.getIsPinned() ? `${header.column.getStart('left')}px` : undefined
                          }}
                        >
                          <Show when={!header.isPlaceholder}>
                            <div class="flex items-center gap-1">
                              {/* Sort Button */}
                              <Show when={header.column.getCanSort()} fallback={
                                flexRender(header.column.columnDef.header, header.getContext())
                              }>
                                <button
                                  onClick={header.column.getToggleSortingHandler()}
                                  class="flex items-center gap-1 hover:text-primary group"
                                >
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                  <span class={`${header.column.getIsSorted() ? 'opacity-100' : 'opacity-30 group-hover:opacity-60'}`}>
                                    <Show when={header.column.getIsSorted() === 'asc'}>
                                      <svg class="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                                      </svg>
                                    </Show>
                                    <Show when={header.column.getIsSorted() === 'desc'}>
                                      <svg class="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </Show>
                                    <Show when={!header.column.getIsSorted()}>
                                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                      </svg>
                                    </Show>
                                  </span>
                                </button>
                              </Show>
                              {/* Filter Dropdown */}
                              <Show when={header.column.getCanFilter() && header.column.id !== 'select' && header.column.id !== 'image' && header.column.id !== 'actions'}>
                                <DropdownMenu.Root>
                                  <DropdownMenu.Trigger
                                    class={`p-1 rounded hover:bg-surface ${header.column.getFilterValue() !== undefined ? 'text-primary' : 'text-muted'}`}
                                    title="Filtrar"
                                  >
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                    </svg>
                                  </DropdownMenu.Trigger>
                                  <DropdownMenu.Portal>
                                    <DropdownMenu.Content class="bg-card border border-border rounded-xl shadow-card-soft z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 min-w-[180px] p-3">
                                      {/* Text filter for SKU and Name */}
                                      <Show when={header.column.id === 'sku' || header.column.id === 'name'}>
                                        <input
                                          type="text"
                                          placeholder="Filtrar..."
                                          value={(header.column.getFilterValue() as string) ?? ''}
                                          onInput={(e) => header.column.setFilterValue(e.currentTarget.value || undefined)}
                                          class="text-xs bg-surface border border-border rounded-md px-2 py-1 w-full text-text placeholder:text-muted"
                                        />
                                      </Show>
                                      {/* Select filter for product_type */}
                                      <Show when={header.column.id === 'product_type'}>
                                        <select
                                          value={(header.column.getFilterValue() as string) ?? ''}
                                          onChange={(e) => header.column.setFilterValue(e.currentTarget.value || undefined)}
                                          class="text-xs bg-surface border border-border rounded-md px-2 py-1 w-full text-text cursor-pointer focus:border-primary focus:outline-none"
                                        >
                                          <option value="">Todos</option>
                                          <For each={Object.entries(productTypeLabels)}>
                                            {([key, label]) => <option value={key}>{label}</option>}
                                          </For>
                                        </select>
                                      </Show>
                                      {/* Select filter for category */}
                                      <Show when={header.column.id === 'category'}>
                                        <select
                                          value={(header.column.getFilterValue() as string) ?? ''}
                                          onChange={(e) => header.column.setFilterValue(e.currentTarget.value || undefined)}
                                          class="text-xs bg-surface border border-border rounded-md px-2 py-1 w-full text-text cursor-pointer focus:border-primary focus:outline-none"
                                        >
                                          <option value="">Todas</option>
                                          <For each={flatCategories()}>
                                            {(cat) => <option value={cat.label.trim()}>{cat.label}</option>}
                                          </For>
                                        </select>
                                      </Show>
                                      {/* Select filter for brand */}
                                      <Show when={header.column.id === 'brand'}>
                                        <select
                                          value={(header.column.getFilterValue() as string) ?? ''}
                                          onChange={(e) => header.column.setFilterValue(e.currentTarget.value || undefined)}
                                          class="text-xs bg-surface border border-border rounded-md px-2 py-1 w-full text-text cursor-pointer focus:border-primary focus:outline-none"
                                        >
                                          <option value="">Todas</option>
                                          <For each={brands()}>
                                            {(brand) => <option value={brand.name}>{brand.name}</option>}
                                          </For>
                                        </select>
                                      </Show>
                                      {/* Select filter for is_active */}
                                      <Show when={header.column.id === 'is_active'}>
                                        <select
                                          value={(header.column.getFilterValue() as string) ?? ''}
                                          onChange={(e) => header.column.setFilterValue(e.currentTarget.value === '' ? undefined : e.currentTarget.value === 'true')}
                                          class="text-xs bg-surface border border-border rounded-md px-2 py-1 w-full text-text cursor-pointer focus:border-primary focus:outline-none"
                                        >
                                          <option value="">Todos</option>
                                          <option value="true">Activo</option>
                                          <option value="false">Inactivo</option>
                                        </select>
                                      </Show>
                                      {/* Number filter for price/cost */}
                                      <Show when={header.column.id === 'base_price' || header.column.id === 'last_cost'}>
                                        <input
                                          type="number"
                                          placeholder="Min..."
                                          value={(header.column.getFilterValue() as string) ?? ''}
                                          onInput={(e) => header.column.setFilterValue(e.currentTarget.value ? Number(e.currentTarget.value) : undefined)}
                                          class="text-xs bg-surface border border-border rounded-md px-2 py-1 w-full text-text placeholder:text-muted"
                                          step="0.01"
                                        />
                                      </Show>
                                      {/* Clear filter button */}
                                      <Show when={header.column.getFilterValue() !== undefined}>
                                        <button
                                          onClick={() => header.column.setFilterValue(undefined)}
                                          class="mt-2 w-full text-xs text-muted hover:text-text"
                                        >
                                          Limpiar
                                        </button>
                                      </Show>
                                    </DropdownMenu.Content>
                                  </DropdownMenu.Portal>
                                </DropdownMenu.Root>
                              </Show>
                            </div>
                          </Show>
                        </TableHead>
                      )}
                    </For>
                  </TableRow>
                )}
              </For>
            </TableHeader>
            <TableBody>
              <Show
                when={!productsQuery.isPending}
                fallback={<SkeletonLoader type="table-row" count={8} />}
              >
                <Show
                  when={table.getRowModel().rows.length > 0}
                  fallback={
                    <TableRow>
                      <TableCell colSpan={columns.length} class="h-96">
                        <EmptyState
                          icon={<ProductIcon />}
                          message="No hay productos para mostrar"
                          description="Intenta ajustar los filtros o crear uno nuevo"
                        />
                      </TableCell>
                    </TableRow>
                  }
                >
                  <For each={table.getRowModel().rows}>
                    {(row) => (
                      <TableRow
                        class={`hover:bg-surface/50 cursor-pointer ${row.getIsSelected() ? 'bg-primary-soft' : ''}`}
                        onClick={() => handleView(row.original)}
                        onMouseEnter={() => handlePrefetch(row.original)}
                      >
                        <For each={row.getVisibleCells()}>
                          {(cell) => (
                            <TableCell
                              style={{ width: `${cell.column.getSize()}px` }}
                              onClick={(e) => cell.column.id === 'select' && e.stopPropagation()}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          )}
                        </For>
                      </TableRow>
                    )}
                  </For>
                </Show>
              </Show>
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Child routes render here (ProductShowPanel, ProductEditPanel, ProductNewPanel) */}
      {/* These are positioned absolutely over the table */}
      <Outlet />
    </div>
  );
};

export default ProductsPage;
