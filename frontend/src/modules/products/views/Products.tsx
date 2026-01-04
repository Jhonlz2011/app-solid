import { Component, For, Show, createMemo, createSignal, onMount, onCleanup, batch } from 'solid-js';
import { createQuery, createMutation, useQueryClient, keepPreviousData } from '@tanstack/solid-query';
import { createSolidTable, flexRender, getCoreRowModel, getSortedRowModel, getFilteredRowModel, type ColumnDef, type SortingState, type VisibilityState, type RowSelectionState } from '@tanstack/solid-table';
import { Toaster, toast } from 'solid-sonner';
import { DropdownMenu } from '@kobalte/core';
import { useNavigate, Outlet } from '@tanstack/solid-router';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/components/ui/table';
import { productsApi } from '../data/products.api';
import { productKeys, categoryKeys, brandKeys } from '../data/products.keys';
import type { Product, ProductClass, ProductFilters, Category, Brand } from '../models/products.type';
import { productClassLabels } from '../models/products.type';
import { useWebSocket } from '@shared/store/ws.store';
import { ProductClassBadge } from '../components/ProductClassBadge';

// Atomic Components
import { PageHeader } from '@shared/components/ui/PageHeader';
import { SearchInput } from '@shared/components/ui/SearchInput';
import { SkeletonLoader } from '@shared/components/ui/SkeletonLoader';
import { EmptyState } from '@shared/components/ui/EmptyState';

// Icons - from shared library
import { PlusIcon, EditIcon, TrashIcon, ColumnsIcon, FilterIcon, ChevronDownIcon, ProductIcon } from '@shared/components/icons';

// Helpers
const formatCurrency = (value: string | number) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(num);
};

const ProductsPage: Component = () => {
  const queryClient = useQueryClient();

  // State
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

  // Stats
  const stats = createMemo(() => {
    const data = products();
    const byClass: Record<ProductClass, number> = { MATERIAL: 0, TOOL: 0, EPP: 0, ASSET: 0, SERVICE: 0, MANUFACTURED: 0 };

    for (const p of data) {
      byClass[p.product_class] = (byClass[p.product_class] || 0) + 1;
    }

    return { byClass, total: meta()?.total || data.length };
  });

  // Table columns
  const columns: ColumnDef<Product>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          ref={(el) => {
            el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
          }}
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          class="custom-checkbox"
        />
      ),
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            class="custom-checkbox"
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
            <div class="font-medium title-primary truncate">{row.name}</div>
            <Show when={row.description}>
              <div class="text-xs text-muted truncate mt-0.5 max-w-[250px]">{row.description}</div>
            </Show>
          </div>
        );
      },
    },
    {
      accessorKey: 'product_class',
      header: 'Tipo',
      size: 100,
      cell: (info) => <ProductClassBadge productClass={info.getValue<ProductClass>()} />,
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
          <span
            class="px-2 py-0.5 text-xs font-medium rounded-full"
            style={{
              background: active ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              color: active ? 'var(--color-success-text)' : 'var(--color-danger-text)'
            }}
          >
            {active ? 'Activo' : 'Inactivo'}
          </span>
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
    // Prefetch product details on hover for instant navigation
    queryClient.prefetchQuery({
      queryKey: productKeys.detail(product.id),
      queryFn: () => productsApi.get(product.id),
      staleTime: 1000 * 60 * 5, // 5 minutes
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

  const handleFilterClass = (productClass?: ProductClass) => {
    setFilters((prev) => ({ ...prev, productClass, offset: 0 }));
  };

  const handleFilterCategory = (categoryId?: number) => {
    setFilters((prev) => ({ ...prev, categoryId, offset: 0 }));
  };

  const handleFilterBrand = (brandId?: number) => {
    setFilters((prev) => ({ ...prev, brandId, offset: 0 }));
  };

  const handleFilterStatus = (isActive?: boolean) => {
    setFilters((prev) => ({ ...prev, isActive, offset: 0 }));
  };

  const clearFilters = () => {
    setFilters({ limit: 50, offset: 0 });
    setSearchInput('');
    setGlobalFilter('');
  };

  // Pagination
  const currentPage = () => Math.floor((filters().offset || 0) / (filters().limit || 50)) + 1;
  const totalPages = () => Math.ceil((meta()?.total || 0) / (filters().limit || 50));

  const goToPage = (page: number) => {
    const limit = filters().limit || 50;
    setFilters((prev) => ({ ...prev, offset: (page - 1) * limit }));
  };

  const activeFilterCount = createMemo(() => {
    let count = 0;
    if (filters().productClass) count++;
    if (filters().categoryId) count++;
    if (filters().brandId) count++;
    if (filters().isActive !== undefined) count++;
    if (filters().search) count++;
    return count;
  });

  return (
    <div class="h-full flex flex-col bg-gradient-to-br from-background via-background to-surface/20">
      <Toaster position="top-right" richColors closeButton />

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

        {/* Stats Cards */}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="stat-card bg-gradient-to-br from-surface/80 to-surface/40 backdrop-blur-sm border border-border">
            <p class="text-muted text-xs font-medium uppercase tracking-wider">Total Productos</p>
            <p class="text-3xl font-bold title-primary mt-1">{stats().total}</p>
          </div>
          <div class="stat-card border" style={{ background: 'var(--color-info-bg)', 'border-color': 'var(--color-info-border)' }}>
            <p class="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-info-text)', opacity: 0.8 }}>Materiales</p>
            <p class="text-3xl font-bold mt-1" style={{ color: 'var(--color-info-text)' }}>{stats().byClass.MATERIAL}</p>
          </div>
          <div class="stat-card border" style={{ background: 'var(--color-warning-bg)', 'border-color': 'var(--color-warning-border)' }}>
            <p class="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-warning-text)', opacity: 0.8 }}>Herramientas</p>
            <p class="text-3xl font-bold mt-1" style={{ color: 'var(--color-warning-text)' }}>{stats().byClass.TOOL}</p>
          </div>
          <div class="stat-card border" style={{ background: 'var(--color-success-bg)', 'border-color': 'var(--color-success-border)' }}>
            <p class="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-success-text)', opacity: 0.8 }}>EPP / Activos</p>
            <p class="text-3xl font-bold mt-1" style={{ color: 'var(--color-success-text)' }}>{stats().byClass.EPP + stats().byClass.ASSET}</p>
          </div>
        </div>

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
              <DropdownMenu.Content class="dropdown-content min-w-[220px] p-3 space-y-2">
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
                        <input
                          type="checkbox"
                          checked={column.getIsVisible()}
                          onChange={(e) => column.toggleVisibility(e.currentTarget.checked)}
                          class="toggle-switch"
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
              class={`filter-pill ${!filters().productClass ? 'filter-pill--active' : ''}`}
              onClick={() => handleFilterClass(undefined)}
            >
              Todos
            </button>
            <For each={Object.entries(productClassLabels)}>
              {([key, label]) => (
                <button
                  class={`filter-pill ${filters().productClass === key ? 'filter-pill--active' : ''}`}
                  onClick={() => handleFilterClass(key as ProductClass)}
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
          class="table-container h-full overflow-auto relative"
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
                                    <DropdownMenu.Content class="dropdown-content min-w-[180px] p-3">
                                      {/* Text filter for SKU and Name */}
                                      <Show when={header.column.id === 'sku' || header.column.id === 'name'}>
                                        <input
                                          type="text"
                                          placeholder="Filtrar..."
                                          value={(header.column.getFilterValue() as string) ?? ''}
                                          onInput={(e) => header.column.setFilterValue(e.currentTarget.value || undefined)}
                                          class="column-filter-input"
                                        />
                                      </Show>
                                      {/* Select filter for product_class */}
                                      <Show when={header.column.id === 'product_class'}>
                                        <select
                                          value={(header.column.getFilterValue() as string) ?? ''}
                                          onChange={(e) => header.column.setFilterValue(e.currentTarget.value || undefined)}
                                          class="column-filter-select"
                                        >
                                          <option value="">Todos</option>
                                          <For each={Object.entries(productClassLabels)}>
                                            {([key, label]) => <option value={key}>{label}</option>}
                                          </For>
                                        </select>
                                      </Show>
                                      {/* Select filter for category */}
                                      <Show when={header.column.id === 'category'}>
                                        <select
                                          value={(header.column.getFilterValue() as string) ?? ''}
                                          onChange={(e) => header.column.setFilterValue(e.currentTarget.value || undefined)}
                                          class="column-filter-select"
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
                                          class="column-filter-select"
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
                                          class="column-filter-select"
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
                                          class="column-filter-input"
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
                        class={`table-row-hover hover:bg-surface/50 cursor-pointer ${row.getIsSelected() ? 'bg-primary-soft' : ''}`}
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
