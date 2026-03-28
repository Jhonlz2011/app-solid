/**
 * SuppliersPage — Orchestrator component.
 *
 * All state and logic extracted to useSuppliersState hook.
 * This component only handles layout and wiring of sub-components.
 */
import { Component, Show, lazy, Suspense } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { useIsMobile } from '@shared/hooks/useIsMobile';
import { useSuppliersState } from '../hooks/useSuppliersState';

// UI Components
import { DataTable } from '@shared/ui/DataTable';
import { PageHeader } from '@shared/ui/PageHeader';
import { SearchInput } from '@shared/ui/SearchInput';
import { DropdownMenu } from '@shared/ui/DropdownMenu';
import { DataTableSelectionBar, SelectionBarAction, SelectionBarSeparator } from '@shared/ui/DataTable/DataTableSelectionBar';
import { DataTableColumnVisibility } from '@shared/ui/DataTable/DataTableColumnVisibility';
import Button from '@shared/ui/Button';
import ConfirmDialog from '@shared/ui/ConfirmDialog';
import SupplierDeleteDialog from '../components/SupplierDeleteDialog';
import { SupplierCardList } from '../components/SupplierCardList';
import { SupplierFilterSheet } from '../components/SupplierFilterSheet';

// Lazy Components
const LazyUserNewSheet = lazy(() => import('../../users/components/UserNewSheet'));
const LazySupplierNewSheet = lazy(() => import('../components/SupplierNewSheet'));
const LazySupplierEditSheet = lazy(() => import('../components/SupplierEditSheet'));
const LazySupplierShowPanel = lazy(() => import('../components/SupplierShowPanel'));

// Icons
import {
    PlusIcon, TrashIcon, UsersIcon, DownloadIcon, UploadIcon,
    FilterIcon, CopyIcon, RotateCcwIcon, ChevronsUpDownIcon,
} from '@shared/ui/icons';

const SuppliersPage: Component = () => {
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const state = useSuppliersState();

    // Cross-Module Modals — driven by ?modal= searchParam
    const openUserModal = () => navigate({ search: (prev: any) => ({ ...prev, modal: 'newUser' }) } as any);
    const closeAllModals = () => navigate({ search: (prev: any) => ({ ...prev, modal: undefined }) } as any);

    return (
        <div class="h-full flex flex-col bg-gradient-to-br from-background via-background to-surface/20">
            {/* Header */}
            <div class="flex-shrink-0 p-3 sm:p-4 space-y-4 sm:space-y-5">
                <PageHeader
                    icon={<UsersIcon />}
                    iconBg="linear-gradient(135deg, #10b981, #059669)"
                    title="Proveedores"
                    count={state.totalRows()}
                    info="Gestiona los proveedores de tu negocio. Puedes agregar, editar, eliminar y buscar proveedores."
                    actions={
                        <div class="flex items-center gap-2">
                            <Button variant="outline" icon={<UploadIcon />} onClick={() => toast.info('Importación próximamente')}>
                                <span class="hidden sm:inline">Importar</span>
                            </Button>
                            <Button
                                variant="outline"
                                icon={<UsersIcon />}
                                onMouseEnter={() => import('../../users/components/UserNewSheet')}
                                onClick={openUserModal}
                            >
                                <span class="hidden sm:inline">Nuevo Usuario</span>
                            </Button>
                            <Show when={state.auth.canAdd('suppliers')}>
                                <Button
                                    search={(prev: any) => ({ ...prev, panel: 'new', id: undefined })}
                                    onMouseEnter={() => import('../components/SupplierNewSheet')}
                                    preload="intent"
                                    icon={<PlusIcon />}
                                >
                                    <span class="hidden sm:inline">Nuevo</span>
                                </Button>
                            </Show>
                        </div>
                    }
                />

                {/* Toolbar */}
                <div class="flex flex-wrap items-center gap-2 sm:gap-3">
                    <SearchInput
                        value={state.search()}
                        onSearch={state.handleSearchInput}
                        placeholder="Buscar proveedores..."
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

            {/* DataTable / Card List */}
            <div class="flex-1 min-h-0 px-3 pb-3 sm:px-4 sm:pb-4 overflow-hidden">
                <div class="bg-card border border-border rounded-2xl shadow-card-soft h-full overflow-auto relative">
                    <Show
                        when={!isMobile()}
                        fallback={
                            <SupplierCardList
                                filters={state.filters}
                                rowSelection={state.rowSelection}
                                onRowSelectionChange={state.setRowSelection}
                                onView={state.handleView}
                                onEdit={state.handleEdit}
                                onDelete={state.handleDelete}
                                onRestore={state.handleRestore}
                            />
                        }
                    >
                        <DataTable
                            data={state.suppliers()}
                            columns={state.columns()}
                            isLoading={state.suppliersQuery.isPending}
                            isPlaceholderData={state.suppliersQuery.isPlaceholderData}
                            pagination={{ pageIndex: 0, pageSize: state.pageSize() }}
                            onPaginationChange={() => { }}
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
                            emptyIcon={<UsersIcon />}
                            emptyMessage="No hay proveedores"
                            emptyDescription="Crea uno nuevo para comenzar"
                            tableRef={(table) => { state.setTableInstance(table); }}
                        />
                    </Show>
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
            <SupplierFilterSheet
                isOpen={state.showFilterSheet()}
                onClose={() => state.setShowFilterSheet(false)}
                filters={state.filterSheetConfig}
            />

            {/* Dialogs */}
            <SupplierDeleteDialog
                supplier={state.deleteTarget()}
                onClose={() => state.setDeleteTarget(null)}
                onSuccess={() => toast.success('Proveedor eliminado')}
            />
            <ConfirmDialog
                isOpen={state.showBulkDeleteConfirm()}
                onClose={() => state.setShowBulkDeleteConfirm(false)}
                onConfirm={state.confirmBulkDelete}
                title={`Eliminar ${state.selectedActiveCount()} proveedores`}
                description="Los proveedores seleccionados quedarán inactivos. Podrás restaurarlos en cualquier momento."
                confirmLabel="Eliminar" variant="danger"
                isLoading={state.bulkDeleteMutation.isPending}
            />
            <ConfirmDialog
                isOpen={state.showBulkRestoreConfirm()}
                onClose={() => state.setShowBulkRestoreConfirm(false)}
                onConfirm={state.confirmBulkRestore}
                title={`Restaurar ${state.selectedInactiveCount()} proveedores`}
                description="Los proveedores seleccionados volverán a estar activos."
                confirmLabel="Restaurar" variant="success"
                isLoading={state.bulkRestoreMutation.isPending}
            />

            {/* SearchParams-driven sheets */}
            <Suspense>
                <Show when={state.panelSearch()?.panel === 'new'}>
                    <LazySupplierNewSheet onClose={state.handleClosePanel} />
                </Show>
                <Show when={state.panelSearch()?.panel === 'edit' && state.panelSearch()?.id}>
                    {(_) => <LazySupplierEditSheet
                        supplierId={state.panelSearch().id!}
                        onClose={state.handleClosePanel}
                        onBack={state.panelSearch()?.from === 'show'
                            ? () => navigate({ search: (prev: any) => ({ ...prev, panel: 'show', id: state.panelSearch().id!, from: undefined }) } as any)
                            : undefined
                        }
                    />}
                </Show>
                <Show when={(state.panelSearch()?.panel === 'show' || state.panelSearch()?.from === 'show') && state.panelSearch()?.id}>
                    {(_) => <LazySupplierShowPanel supplierId={state.panelSearch().id!} onClose={state.handleClosePanel} />}
                </Show>

                {/* Cross-Module Modals */}
                <Show when={state.panelSearch()?.modal === 'newUser'}>
                    <LazyUserNewSheet onClose={closeAllModals} />
                </Show>
            </Suspense>
        </div>
    );
};

export default SuppliersPage;
