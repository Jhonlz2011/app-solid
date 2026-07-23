/**
 * ServicesPage — Orchestrator component for services.
 * Reuses state and logic from useProductsState hook with productType filter.
 */
import { Component, Show } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { useIsMobile } from '@shared/hooks/useIsMobile';
import { useProductsState } from '@/modules/products/hooks/useProductsState';

// UI Components
import { DataTable } from '@shared/ui/DataTable';
import { PageHeader } from '@shared/ui/PageHeader';
import { SearchInput } from '@shared/ui/SearchInput';
import { DropdownMenu } from '@shared/ui/DropdownMenu';
import { DataTableSelectionBar, SelectionBarAction, SelectionBarSeparator } from '@shared/ui/DataTable/DataTableSelectionBar';
import { DataTableColumnVisibility } from '@shared/ui/DataTable/DataTableColumnVisibility';
import LinkButton from '@shared/ui/LinkButton';
import Button from '@shared/ui/Button';
import ConfirmDialog from '@shared/ui/ConfirmDialog';
import ProductDeleteDialog from '@/modules/products/components/ProductDeleteDialog';
import { ProductFilterSheet } from '@/modules/products/components/ProductFilterSheet';

// Icons
import {
    PlusIcon, TrashIcon, DownloadIcon, UploadIcon,
    FilterIcon, CopyIcon, RotateCcwIcon, ChevronsUpDownIcon,
} from '@shared/ui/icons';

// Service icon (Wrench)
const WrenchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
);

const ServicesPage: Component = () => {
    const isMobile = useIsMobile();
    // Initialize state with productType: ['SERVICIO']
    const state = useProductsState({ productType: ['SERVICIO'] });

    return (
        <div class="h-full flex flex-col bg-linear-to-br from-background via-background to-surface/20">
            {/* Deep-Nested Routes (New/Show/Edit sheets) */}
            <Outlet />

            {/* Header */}
            <div class="shrink-0 p-3 sm:p-4 space-y-4 sm:space-y-5">
                <PageHeader
                    icon={<WrenchIcon />}
                    iconBg="linear-gradient(135deg, #f59e0b, #ef4444)"
                    title="Servicios"
                    count={state.totalRows()}
                    info="Gestiona los servicios de tu negocio."
                    actions={
                        <div class="flex items-center gap-2">
                            <Button variant="outline" icon={<UploadIcon />} onClick={() => toast.info('Importación próximamente')}>
                                <span class="hidden @sm:inline">Importar</span>
                            </Button>
                            <Show when={state.auth.canAdd('services')}>
                                <LinkButton to="/services/new" preload="intent" icon={<PlusIcon />}>
                                    <span class="hidden @sm:inline">Nuevo</span>
                                </LinkButton>
                            </Show>
                        </div>
                    }
                />

                {/* Toolbar */}
                <div class="flex flex-wrap items-center gap-2 sm:gap-3">
                    <SearchInput
                        value={state.search()}
                        onSearch={state.handleSearchInput}
                        placeholder="Buscar servicios..."
                        class="flex-1 w-full min-w-[150px] max-w-md"
                    />
                    <div class="flex items-center gap-2">
                        <Button variant="ghost" icon={<DownloadIcon />} onClick={() => toast.info('Exportación próximamente')}>
                            <span class="hidden sm:inline">Exportar</span>
                        </Button>
                        <Show when={isMobile()}>
                            <Button
                                variant="ghost"
                                class="relative"
                                icon={<FilterIcon />}
                                onClick={() => state.setShowFilterSheet(true)}
                            >
                                <span class="hidden sm:inline">Filtros</span>
                                <Show when={state.hasActiveFilters()}>
                                    <span class="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary" />
                                </Show>
                            </Button>
                        </Show>
                        <Show when={!isMobile()}>
                            <DataTableColumnVisibility table={state.tableInstance()} />
                        </Show>
                    </div>
                </div>
            </div>

            {/* DataTable */}
            <div class="flex-1 min-h-0 px-3 pb-3 sm:px-4 sm:pb-4 overflow-hidden">
                <div class="bg-card border border-border rounded-2xl shadow-card-soft h-full overflow-auto relative">
                    <DataTable
                        data={state.products()}
                        columns={state.columns()}
                        isLoading={state.productsQuery.isPending}
                        isPlaceholderData={state.productsQuery.isPlaceholderData}
                        pagination={{ pageIndex: 0, pageSize: state.pageSize() }}
                        onPaginationChange={() => {}}
                        pageCount={1}
                        totalRows={state.totalRows()}
                        cursorPagination={{
                            hasNextPage: state.hasNextPage(),
                            hasPrevPage: state.hasPrevPage(),
                            onNextPage: state.handleNextPage,
                            onPrevPage: state.handlePrevPage,
                            onFirstPage: state.handleFirstPage,
                            onLastPage: state.handleLastPage,
                            onPageSizeChange: state.handlePageSizeChange,
                        }}
                        sorting={state.sorting()}
                        onSortingChange={state.handleSortingChange}
                        enableRowSelection={true}
                        rowSelection={state.rowSelection()}
                        onRowSelectionChange={state.setRowSelection}
                        getRowId={(row) => String(row.id)}
                        enableColumnPinning={true}
                        columnVisibility={state.columnVisibility()}
                        onColumnVisibilityChange={state.setColumnVisibility}
                        columnPinning={state.columnPinning()}
                        onColumnPinningChange={state.setColumnPinning}
                        onRowHover={state.handlePrefetch}
                        enableVirtualization={false}
                        estimatedRowHeight={56}
                        emptyIcon={<WrenchIcon />}
                        emptyMessage="No hay servicios"
                        emptyDescription="Crea uno nuevo para comenzar"
                        tableRef={(table) => { state.setTableInstance(table); }}
                    />
                </div>
            </div>

            {/* Floating Selection Bar */}
            <DataTableSelectionBar
                selectedCount={state.selectedCount()}
                totalRows={state.totalRows()}
                onClearSelection={() => state.setRowSelection({})}
            >
                <SelectionBarAction icon={<CopyIcon class="size-4" />} label="Copiar" onClick={state.handleCopySelection} iconOnMobile />
                <SelectionBarSeparator />
                <Show when={state.selectedActiveCount() > 0 && state.selectedInactiveCount() === 0}>
                    <SelectionBarAction
                        icon={<TrashIcon class="size-4" />} label="Eliminar" variant="danger"
                        onClick={state.handleBulkDelete} loading={state.bulkDeleteMutation.isPending} loadingText="Eliminando..."
                    />
                </Show>
                <Show when={state.selectedInactiveCount() > 0 && state.selectedActiveCount() === 0}>
                    <SelectionBarAction
                        icon={<RotateCcwIcon class="size-4" />} label="Restaurar" variant="success"
                        onClick={() => state.setShowBulkRestoreConfirm(true)} loading={state.bulkRestoreMutation.isPending} loadingText="Restaurando..."
                    />
                </Show>
                <Show when={state.selectedActiveCount() > 0 && state.selectedInactiveCount() > 0}>
                    <DropdownMenu placement="top-start">
                        <DropdownMenu.Trigger variant="ghost" size="sm" class="h-8 px-2.5 text-sm gap-1.5 focus-visible:ring-0">
                            <span>Acciones</span>
                            <ChevronsUpDownIcon class="size-3.5" />
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content class="min-w-[180px]">
                            <DropdownMenu.Item onSelect={state.handleBulkDelete} destructive>
                                <TrashIcon class="size-4 mr-2" />
                                <span class="flex-1 font-medium">Eliminar Activos</span>
                                <span class="bg-danger/20 text-danger font-bold text-xs px-1.5 py-0.5 rounded tabular-nums">{state.selectedActiveCount()}</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item onSelect={() => state.setShowBulkRestoreConfirm(true)}>
                                <RotateCcwIcon class="size-4 mr-2 text-emerald-500" />
                                <span class="flex-1 text-emerald-500 font-medium">Restaurar Inactivos</span>
                                <span class="bg-emerald-500/20 text-emerald-500 font-bold text-xs px-1.5 py-0.5 rounded tabular-nums">{state.selectedInactiveCount()}</span>
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu>
                </Show>
            </DataTableSelectionBar>

            {/* Filter Sheet (Mobile) */}
            <ProductFilterSheet
                isOpen={state.showFilterSheet()}
                onClose={() => state.setShowFilterSheet(false)}
                filters={state.filterSheetConfig}
            />

            {/* Dialogs */}
            <ProductDeleteDialog
                product={state.deleteTarget()}
                onClose={() => state.setDeleteTarget(null)}
                onSuccess={() => toast.success('Servicio eliminado')}
            />
            <ConfirmDialog
                isOpen={state.showBulkDeleteConfirm()}
                onClose={() => state.setShowBulkDeleteConfirm(false)}
                onConfirm={state.confirmBulkDelete}
                title={`Eliminar ${state.selectedActiveCount()} servicios`}
                description="Los servicios seleccionados quedarán inactivos. Podrás restaurarlos en cualquier momento."
                confirmLabel="Eliminar" variant="danger"
                isLoading={state.bulkDeleteMutation.isPending}
            />
            <ConfirmDialog
                isOpen={state.showBulkRestoreConfirm()}
                onClose={() => state.setShowBulkRestoreConfirm(false)}
                onConfirm={state.confirmBulkRestore}
                title={`Restaurar ${state.selectedInactiveCount()} servicios`}
                description="Los servicios seleccionados volverán a estar activos."
                confirmLabel="Restaurar" variant="success"
                isLoading={state.bulkRestoreMutation.isPending}
            />
        </div>
    );
};

export default ServicesPage;
