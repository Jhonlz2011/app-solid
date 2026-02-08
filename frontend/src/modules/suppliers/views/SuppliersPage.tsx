import { Component, For, Show, createSignal, onMount, onCleanup, batch } from 'solid-js';
import { createSolidTable, flexRender, getCoreRowModel, getSortedRowModel, getFilteredRowModel, type ColumnDef, type SortingState, type VisibilityState, type RowSelectionState, type ColumnPinningState, type PaginationState } from '@tanstack/solid-table';
import { toast } from 'solid-sonner';
import { DropdownMenu } from '@shared/ui/DropdownMenu';
import { useNavigate, Outlet } from '@tanstack/solid-router';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { useSuppliers, useDeleteSupplier, useBulkDeleteSupplier, supplierKeys, suppliersApi } from '../data/suppliers.api';
import type { SupplierListItem } from '../models/supplier.types';
import { useWebSocket } from '@shared/store/ws.store';
import { useQueryClient } from '@tanstack/solid-query';

// Atomic Components
import { PageHeader } from '@shared/ui/PageHeader';
import { SearchInput } from '@shared/ui/SearchInput';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Switch from '@shared/ui/Switch';
import { EmptyState } from '@shared/ui/EmptyState';
import Checkbox from '@shared/ui/Checkbox';
import { Badge, StatusBadge } from '@shared/ui/Badge';
import { DataTableColumnHeader } from '@shared/ui/DataTableColumnHeader';
import Button from '@shared/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/Select';

// Icons
import { PlusIcon, EditIcon, TrashIcon, ColumnsIcon, UsersIcon, PinIcon, EyeIcon, EyeOffIcon, PinOffIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from '@shared/ui/icons';

// =============================================================================
// Column Pinning Helper - Sticky column implementation
// =============================================================================

type CSSProperties = { [key: string]: string | number };

// Get pinning styles for sticky columns
// Returns className and inline styles for proper positioning
function getCommonPinningStyles(column: {
    getIsPinned: () => false | 'left' | 'right';
    getStart: (position?: 'left' | 'center' | 'right') => number;
    getAfter: (position?: 'left' | 'center' | 'right') => number;
    getSize: () => number;
}): { className: string; style: CSSProperties } {
    const isPinned = column.getIsPinned();
    const colSize = column.getSize();

    // Not pinned - use width for proportional distribution with table-layout: fixed
    if (!isPinned) {
        return {
            className: '',
            style: {
                width: `${colSize}px`,
            }
        };
    }

    const isLeft = isPinned === 'left';
    const position = isLeft ? column.getStart('left') : column.getAfter('right');

    return {
        className: [
            'sticky z-[20]',
            // Base background
            'bg-card',
        ].join(' '),
        style: {
            ...(isLeft ? { left: `${position}px` } : { right: `${position}px` }),
            width: `${colSize}px`,
            'min-width': `${colSize}px`,
            'max-width': `${colSize}px`,
        }
    };
}

const SuppliersPage: Component = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // State
    const [search, setSearch] = createSignal('');
    const [sorting, setSorting] = createSignal<SortingState>([]);
    const [columnVisibility, setColumnVisibility] = createSignal<VisibilityState>({});
    const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});
    const [columnPinning, setColumnPinning] = createSignal<ColumnPinningState>({ left: ['select'], right: ['actions'] });
    const [pagination, setPagination] = createSignal<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });


    // WebSocket
    const { subscribe, unsubscribe } = useWebSocket();

    onMount(() => {
        subscribe('suppliers');

        const handleUpdate = () => {
            queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
        };

        window.addEventListener('entity:created', handleUpdate);
        window.addEventListener('entity:updated', handleUpdate);
        window.addEventListener('entity:deleted', handleUpdate);

        onCleanup(() => {
            unsubscribe('suppliers');
            window.removeEventListener('entity:created', handleUpdate);
            window.removeEventListener('entity:updated', handleUpdate);
            window.removeEventListener('entity:deleted', handleUpdate);
        });
    });

    // Queries
    const suppliersQuery = useSuppliers(() => ({
        limit: pagination().pageSize,
        offset: pagination().pageIndex * pagination().pageSize,
        search: search(),
    }));

    const deleteMutation = useDeleteSupplier();
    const bulkDeleteMutation = useBulkDeleteSupplier();

    // Derived data
    const suppliers = () => suppliersQuery.data?.data ?? [];
    const selectedCount = () => Object.keys(rowSelection()).length;

    // Handlers
    const handleSearchInput = (value: string) => {
        batch(() => {
            setSearch(value);
            setPagination(prev => ({ ...prev, pageIndex: 0 }));
        });
    };

    const handleNew = () => {
        navigate({ to: '/suppliers/new' });
    };

    const handleEdit = (supplier: SupplierListItem) => {
        // Pre-seed cache
        queryClient.setQueryData(['supplier', supplier.id], supplier);
        navigate({ to: `/suppliers/edit/${supplier.id}` });
    };

    const handleView = (supplier: SupplierListItem) => {
        queryClient.setQueryData(['supplier', supplier.id], supplier);
        navigate({ to: `/suppliers/show/${supplier.id}` });
    };

    const handlePrefetch = (supplier: SupplierListItem) => {
        queryClient.prefetchQuery({
            queryKey: supplierKeys.detail(supplier.id),
            queryFn: () => suppliersApi.get(supplier.id),
            staleTime: 1000 * 60 * 5,
        });
    };

    const handleDelete = (supplier: SupplierListItem) => {
        if (confirm(`¿Eliminar proveedor "${supplier.business_name}"?`)) {
            deleteMutation.mutate(supplier.id, {
                onSuccess: () => toast.success('Proveedor eliminado'),
                onError: (err: any) => toast.error(err.message || 'Error al eliminar'),
            });
        }
    };

    const handleBulkDelete = () => {
        const ids = Object.keys(rowSelection()).map(Number);
        if (confirm(`¿Eliminar ${ids.length} proveedores? Esta acción no se puede deshacer.`)) {
            bulkDeleteMutation.mutate(ids, {
                onSuccess: () => {
                    toast.success(`${ids.length} proveedores eliminados`);
                    setRowSelection({});
                },
                onError: (err: any) => toast.error(err.message || 'Error al eliminar'),
            });
        }
    };


    // Columns - using SupplierListItem type for table data
    const columns: ColumnDef<SupplierListItem>[] = [
        {
            id: 'select',
            header: ({ table }) => (
                <Checkbox
                    indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
                    checked={table.getIsAllPageRowsSelected()}
                    onChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                />
            ),
            cell: ({ row }) => (
                <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={row.getIsSelected()}
                        onChange={(checked) => row.toggleSelected(checked)}
                    />
                </div>
            ),
            size: 36,
            enableSorting: false,
            enableHiding: false,
            enablePinning: false,
        },
        {
            accessorKey: 'business_name',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Razón Social" />,
            meta: { title: 'Razón Social' },
            size: 210,
            cell: (info) => (
                <div class="min-w-0">
                    <div class="font-medium text-text truncate">{info.getValue<string>()}</div>
                    <Show when={info.row.original.trade_name}>
                        <div class="text-xs text-muted truncate">{info.row.original.trade_name}</div>
                    </Show>
                </div>
            ),
        },
        {
            accessorKey: 'tax_id',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Identificación" />,
            meta: { title: 'Identificación' },
            size: 170,
            cell: (info) => (
                <div>
                    <div class="font-mono text-sm font-semibold text-primary">{info.getValue<string>()}</div>
                    <div class="text-xs text-muted">{info.row.original.tax_id_type}</div>
                </div>
            ),
        },
        {
            accessorKey: 'email_billing',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Contacto" />,
            meta: { title: 'Contacto' },
            size: 200,
            cell: (info) => (
                <div class="min-w-0">
                    <div class="text-sm truncate">{info.getValue<string>()}</div>
                    <div class="text-xs text-muted truncate">{info.row.original.phone}</div>
                </div>
            ),
        },
        {
            accessorKey: 'address_fiscal',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Dirección" />,
            meta: { title: 'Dirección' },
            size: 200,
            cell: (info) => <span class="text-sm text-muted truncate block max-w-full">{info.getValue<string>()}</span>,
        },
        {
            accessorKey: 'person_type',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
            meta: { title: 'Tipo' },
            size: 120,
            cell: (info) => {
                const type = info.getValue<string>();
                return (
                    <Badge variant={type === 'JURIDICA' ? 'primary' : 'info'}>
                        {type === 'JURIDICA' ? 'Jurídica' : 'Natural'}
                    </Badge>
                );
            },
        },
        {
            accessorKey: 'is_active',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
            meta: { title: 'Estado' },
            size: 120,
            cell: (info) => <StatusBadge isActive={info.getValue<boolean>()} />,
        },
        {
            id: 'actions',
            header: '',
            size: 78,
            enableHiding: false,
            enablePinning: false,
            cell: (info) => (
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(info.row.original); }}
                        class="p-1.5 rounded-lg hover:bg-blue-500/20 text-muted hover:text-blue-400"
                        title="Editar"
                    >
                        <EditIcon />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(info.row.original); }}
                        class="p-1.5 rounded-lg hover:bg-red-500/20 text-muted hover:text-red-400"
                        title="Eliminar"
                    >
                        <TrashIcon />
                    </button>
                </div>
            ),
        },
    ];

    const table = createSolidTable({
        get data() { return suppliers() },
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getRowId: (row) => String(row.id), // Better selection tracking
        onSortingChange: setSorting,
        onRowSelectionChange: setRowSelection,
        onColumnVisibilityChange: setColumnVisibility,
        onColumnPinningChange: (updater) => {
            setColumnPinning((prev) => {
                const newState = typeof updater === 'function' ? updater(prev) : updater;
                // Keep 'actions' always at the end of right pinned columns
                if (newState.right && newState.right.length > 0) {
                    const withoutActions = newState.right.filter((id) => id !== 'actions');
                    newState.right = [...withoutActions, 'actions'];
                }
                return newState;
            });
        },
        enableColumnPinning: true,
        manualPagination: true,
        // Calcular pageCount de forma segura: si total > 0, Math.ceil(total/pageSize), sino 1 (para evitar -1)
        // Calcular pageCount de forma segura: si total > 0, Math.ceil(total/pageSize), sino 1 (para evitar -1)
        get pageCount() {
            return (suppliersQuery.data?.meta.total ?? 0) > 0
                ? Math.ceil((suppliersQuery.data?.meta.total ?? 0) / pagination().pageSize)
                : 1;
        },
        get rowCount() { return suppliersQuery.data?.meta.total ?? 0; },
        onPaginationChange: setPagination,
        state: {
            get sorting() { return sorting() },
            get rowSelection() { return rowSelection() },
            get columnVisibility() { return columnVisibility() },
            get columnPinning() { return columnPinning() },
            get pagination() { return pagination() },
        },
    });

    return (
        <div class="h-full flex flex-col bg-gradient-to-br from-background via-background to-surface/20">
            {/* Header */}
            <div class="flex-shrink-0 p-5 space-y-5">
                <PageHeader
                    icon={<UsersIcon />}
                    iconBg="linear-gradient(135deg, #10b981, #059669)"
                    title="Proveedores"
                    count={suppliersQuery.data?.meta.total}
                    info="Gestiona los proveedores de tu negocio. Puedes agregar, editar, eliminar y buscar proveedores."
                    actions={
                        <Button onClick={handleNew} icon={<PlusIcon />}>
                            Nuevo Proveedor
                        </Button>
                    }
                />

                {/* Toolbar */}
                <div class="flex flex-wrap items-center gap-3">
                    <SearchInput
                        value={search()}
                        onSearch={handleSearchInput}
                        placeholder="Buscar proveedores..."
                        class="flex-1 min-w-[200px] max-w-md"
                    />

                    {/* Column Settings */}
                    <DropdownMenu placement="bottom-end">
                        <DropdownMenu.Trigger class="btn btn-ghost gap-2">
                            <ColumnsIcon />
                            <span class="hidden sm:inline">Columnas</span>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content class="min-w-[280px] p-2">
                            <DropdownMenu.Label class="text-xs font-semibold text-muted tracking-wider mb-2">
                                Visibilidad de columnas
                            </DropdownMenu.Label>

                            {/* Column list with visibility and pin controls */}
                            <div class="max-h-[320px] overflow-y-auto">
                                <For each={table.getAllLeafColumns().filter(col => col.getCanHide() || col.getCanPin())}>
                                    {(column) => {
                                        const isPinned = () => column.getIsPinned();
                                        const canPin = () => column.getCanPin();
                                        const canHide = () => column.getCanHide();
                                        const isVisible = () => column.getIsVisible();
                                        const title = () => (column.columnDef.meta as { title?: string })?.title ?? column.id;

                                        return (
                                            <div class="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-surface-2 transition-colors">
                                                {/* Column name */}
                                                <span class="flex-1 text-sm text-text truncate" title={title()}>
                                                    {title()}
                                                </span>

                                                {/* Pin controls */}
                                                <Show when={canPin()}>
                                                    <div class="flex items-center gap-0.5 bg-surface rounded-md p-0.5">
                                                        {/* Pin Left */}
                                                        <button
                                                            onClick={() => column.pin(isPinned() === 'left' ? false : 'left')}
                                                            class={`p-1 rounded transition-colors ${isPinned() === 'left'
                                                                ? 'bg-primary text-white'
                                                                : 'text-muted hover:text-text hover:bg-surface-2'
                                                                }`}
                                                            title={isPinned() === 'left' ? 'Desfijar' : 'Fijar izquierda'}
                                                        >
                                                            <PinIcon class="size-3.5 rotate-45" />
                                                        </button>
                                                        {/* Pin Right */}
                                                        <button
                                                            onClick={() => column.pin(isPinned() === 'right' ? false : 'right')}
                                                            class={`p-1 rounded transition-colors ${isPinned() === 'right'
                                                                ? 'bg-primary text-white'
                                                                : 'text-muted hover:text-text hover:bg-surface-2'
                                                                }`}
                                                            title={isPinned() === 'right' ? 'Desfijar' : 'Fijar derecha'}
                                                        >
                                                            <PinIcon class="size-3.5 -rotate-45" />
                                                        </button>
                                                    </div>
                                                </Show>

                                                {/* Visibility toggle */}
                                                <Show when={canHide()}>
                                                    <Switch
                                                        checked={isVisible()}
                                                        onChange={column.toggleVisibility}
                                                        aria-label={`Mostrar/ocultar ${title()}`}
                                                    />
                                                </Show>
                                            </div>
                                        );
                                    }}
                                </For>
                            </div>

                            {/* Quick actions */}
                            {/* Quick actions */}
                            <DropdownMenu.Separator class="my-2" />
                            <div class="flex flex-col gap-2 p-1">
                                <div class="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="flex-1 text-xs h-8 px-2"
                                        onClick={() => table.getAllLeafColumns().forEach(col => col.getCanHide() && col.toggleVisibility(true))}
                                        icon={<EyeIcon class="size-3.5" />}
                                    >
                                        Mostrar todo
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="flex-1 text-xs h-8 px-2"
                                        onClick={() => {
                                            // Solo ocultar las que se pueden ocultar
                                            table.getAllLeafColumns().forEach(col => col.getCanHide() && col.toggleVisibility(false));
                                        }}
                                        icon={<EyeOffIcon class="size-3.5" />}
                                    >
                                        Ocultar todo
                                    </Button>
                                </div>
                                <Show when={table.getAllLeafColumns().some(col => col.getIsPinned() && col.id !== 'select' && col.id !== 'actions')}>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        class="w-full justify-start text-xs h-8 font-normal text-muted hover:text-primary px-2"
                                        onClick={() => table.getAllLeafColumns().forEach(col => {
                                            if (col.id !== 'select' && col.id !== 'actions') col.pin(false);
                                        })}
                                        icon={<PinOffIcon class="size-3.5" />}
                                    >
                                        Restablecer fijado
                                    </Button>
                                </Show>
                            </div>
                        </DropdownMenu.Content>
                    </DropdownMenu>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            <Show when={selectedCount() > 0}>
                <div
                    class="flex-shrink-0 mx-6 mb-4 px-4 py-3 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200 border"
                    style={{ background: 'var(--color-info-bg)', 'border-color': 'var(--color-info-border)' }}
                >
                    <span class="text-sm font-medium" style={{ color: 'var(--color-info-text)' }}>
                        {selectedCount()} proveedor(es) seleccionado(s)
                    </span>
                    <div class="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setRowSelection({})}>
                            Cancelar
                        </Button>
                        <Button
                            variant="danger"
                            size="sm"
                            onClick={handleBulkDelete}
                            loading={bulkDeleteMutation.isPending}
                            loadingText="Eliminando..."
                            icon={<TrashIcon />}
                        >
                            Eliminar
                        </Button>
                    </div>
                </div>
            </Show>

            {/* Table Container */}
            <div class="flex-1 min-h-0 px-5 pb-5 overflow-hidden flex flex-col">
                <div class="bg-card border border-border rounded-2xl shadow-card-soft h-full flex flex-col overflow-hidden">
                    <div class="flex-1 overflow-auto relative">
                        <Table>
                            <TableHeader class="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                                <For each={table.getHeaderGroups()}>
                                    {(headerGroup) => (
                                        <TableRow>
                                            <For each={headerGroup.headers}>
                                                {(header) => {
                                                    const { className: pinClasses, style: pinStyles } = getCommonPinningStyles(header.column);
                                                    const isPinned = header.column.getIsPinned();

                                                    return (
                                                        <TableHead
                                                            class={`text-xs uppercase tracking-wider text-muted font-semibold ${pinClasses} ${isPinned ? 'z-[30]' : ''}`}
                                                            style={pinStyles}
                                                        >
                                                            <Show when={!header.isPlaceholder}>
                                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                                            </Show>
                                                        </TableHead>
                                                    );
                                                }}
                                            </For>
                                        </TableRow>
                                    )}
                                </For>
                            </TableHeader>
                            <TableBody>
                                <Show
                                    when={!suppliersQuery.isPending}
                                    fallback={<SkeletonLoader type="table-row" count={8} />}
                                >
                                    <Show
                                        when={table.getRowModel().rows.length > 0}
                                        fallback={
                                            <TableRow>
                                                <TableCell colSpan={columns.length} class="h-96">
                                                    <EmptyState
                                                        icon={<UsersIcon />}
                                                        message="No hay proveedores"
                                                        description="Crea uno nuevo para comenzar"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        }
                                    >
                                        <For each={table.getRowModel().rows}>
                                            {(row) => (
                                                <TableRow
                                                    class={`cursor-pointer group ${row.getIsSelected()
                                                        ? 'row-selected bg-row-selected hover:bg-row-selected-hover'
                                                        : 'hover:bg-table-hover'
                                                        }`}
                                                    onClick={() => handleView(row.original)}
                                                    onMouseEnter={() => handlePrefetch(row.original)}
                                                >
                                                    <For each={row.getVisibleCells()}>
                                                        {(cell) => {
                                                            const { className: pinClasses, style: pinStyles } = getCommonPinningStyles(cell.column);

                                                            return (
                                                                <TableCell
                                                                    class={`group-[.row-selected]:bg-row-selected group-[&:not(.row-selected)]:group-hover:bg-table-hover group-[.row-selected]:group-hover:bg-row-selected-hover
                                                                ${pinClasses}`}
                                                                    style={pinStyles}
                                                                    onClick={(e) => cell.column.id === 'select' && e.stopPropagation()}
                                                                >
                                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                                </TableCell>
                                                            );
                                                        }}
                                                    </For>
                                                </TableRow>
                                            )}
                                        </For>
                                    </Show>
                                </Show>
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Controls */}
                    <div class="flex-shrink-0 p-4 border-t border-border bg-card">
                        <div class="flex items-center justify-between gap-4">
                            <div class="hidden sm:flex-1 text-sm text-muted">
                                {table.getFilteredSelectedRowModel().rows.length > 0 ? (
                                    <span>{table.getFilteredSelectedRowModel().rows.length} de {table.getFilteredRowModel().rows.length} fila(s) seleccionada(s).</span>
                                ) : (
                                    <span>Total: {suppliersQuery.data?.meta.total ?? 0} registros</span>
                                )}
                            </div>

                            <div class="flex items-center gap-4 lg:gap-8">
                                <div class="flex items-center gap-2">
                                    <p class="text-sm font-medium text-muted hidden sm:inline">Filas por página</p>
                                    <Select
                                        value={pagination().pageSize}
                                        onChange={(val) => table.setPageSize(Number(val))}
                                        options={[10, 20, 30, 40, 50]}
                                        itemComponent={(props) => (
                                            <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
                                        )}
                                    >
                                        <SelectTrigger class="h-8 w-[70px]">
                                            <SelectValue<number>>{state => state.selectedOption()}</SelectValue>
                                        </SelectTrigger>
                                        <SelectContent />
                                    </Select>
                                </div>

                                <div class="flex w-[100px] items-center justify-center text-sm font-medium text-muted">
                                    Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
                                </div>

                                <div class="flex items-center gap-1.5">
                                    <Button
                                        variant="outline"
                                        size="icon_md"
                                        class="hidden lg:flex"
                                        onClick={() => table.setPageIndex(0)}
                                        disabled={!table.getCanPreviousPage()}
                                    >
                                        <span class="sr-only">Ir a la primera página</span>
                                        <ChevronsLeftIcon class="size-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon_md"
                                        class="h-8 w-8 p-0"
                                        onClick={() => table.previousPage()}
                                        disabled={!table.getCanPreviousPage()}
                                    >
                                        <span class="sr-only">Anterior</span>
                                        <ChevronLeftIcon class="size-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon_md"
                                        onClick={() => table.nextPage()}
                                        disabled={!table.getCanNextPage()}
                                    >
                                        <span class="sr-only">Siguiente</span>
                                        <ChevronRightIcon class="size-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon_md"
                                        class="hidden lg:flex"
                                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                                        disabled={!table.getCanNextPage()}
                                    >
                                        <span class="sr-only">Ir a la última página</span>
                                        <ChevronsRightIcon class="size-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Child routes (Panels) */}
            <Outlet />
        </div >
    );
};

export default SuppliersPage;
