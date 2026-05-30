/**
 * BrandsPage — Full-featured brands management page with DataTable.
 * Follows the SuppliersPage pattern.
 */
import { Component, Show } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { useBrandsState } from '../hooks/useBrandsState';

// UI Components
import { DataTable } from '@shared/ui/DataTable';
import { PageHeader } from '@shared/ui/PageHeader';
import { SearchInput } from '@shared/ui/SearchInput';
import { DataTableSelectionBar, SelectionBarAction, SelectionBarSeparator } from '@shared/ui/DataTable/DataTableSelectionBar';
import { DataTableColumnVisibility } from '@shared/ui/DataTable/DataTableColumnVisibility';
import Button from '@shared/ui/Button';
import ConfirmDialog from '@shared/ui/ConfirmDialog';

// Icons
import {
    PlusIcon, TrashIcon, BookmarkIcon, DownloadIcon, UploadIcon,
    CopyIcon, RotateCcwIcon, ChevronsUpDownIcon,
} from '@shared/ui/icons';
import { DropdownMenu } from '@shared/ui/DropdownMenu';

const BrandsPage: Component = () => {
    const state = useBrandsState();

    return (
        <div class="h-full flex flex-col bg-linear-to-br from-background via-background to-surface/20">
            <Outlet />

            {/* Header */}
            <div class="flex-shrink-0 p-3 sm:p-4 space-y-4 sm:space-y-5">
                <PageHeader
                    icon={<BookmarkIcon />}
                    iconBg="linear-gradient(135deg, #e11d48, #be123c)"
                    title="Marcas"
                    count={state.totalRows()}
                    info="Gestiona las marcas de tus productos. Puedes agregar, editar, desactivar y restaurar marcas."
                    actions={
                        <div class="flex items-center gap-2">
                            <Button variant="outline" icon={<UploadIcon />} onClick={() => toast.info('Importación próximamente')}>
                                <span class="hidden sm:inline">Importar</span>
                            </Button>
                            <Show when={state.auth.canAdd('brands')}>
                                <Button to="/brands/new" preload="intent" icon={<PlusIcon />}>
                                    <span class="hidden sm:inline">Nueva Marca</span>
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
                        placeholder="Buscar marcas..."
                        class="flex-1 w-full min-w-[150px] max-w-md"
                    />
                    <div class="flex items-center gap-2">
                        <Button variant="ghost" icon={<DownloadIcon />} onClick={() => toast.info('Exportación próximamente')}>
                            <span class="hidden sm:inline">Exportar</span>
                        </Button>
                        <DataTableColumnVisibility table={state.tableInstance()} />
                    </div>
                </div>
            </div>

            {/* DataTable */}
            <div class="flex-1 min-h-0 px-3 pb-3 sm:px-4 sm:pb-4 overflow-hidden">
                <div class="bg-card border border-border rounded-2xl shadow-card-soft h-full overflow-auto relative">
                    <DataTable
                        data={state.brands()}
                        columns={state.columns()}
                        isLoading={state.brandsQuery.isPending}
                        isPlaceholderData={state.brandsQuery.isPlaceholderData}
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
                        enableVirtualization={false}
                        estimatedRowHeight={56}
                        emptyIcon={<BookmarkIcon />}
                        emptyMessage="No hay marcas"
                        emptyDescription="Crea una nueva marca para comenzar"
                        tableRef={(table) => { state.setTableInstance(table); }}
                    />
                </div>
            </div>

            {/* Selection Bar */}
            <DataTableSelectionBar
                selectedCount={state.selectedCount()}
                totalRows={state.totalRows()}
                onClearSelection={() => state.setRowSelection({})}
            >
                <SelectionBarAction icon={<CopyIcon class="size-4" />} label="Copiar" onClick={state.handleCopySelection} iconOnMobile />
                <SelectionBarSeparator />
                <Show when={state.selectedActiveCount() > 0 && state.selectedInactiveCount() === 0}>
                    <SelectionBarAction
                        icon={<TrashIcon class="size-4" />} label="Desactivar" variant="danger"
                        onClick={state.handleBulkDelete} loading={state.bulkDeleteMut.isPending} loadingText="Desactivando..."
                    />
                </Show>
                <Show when={state.selectedInactiveCount() > 0 && state.selectedActiveCount() === 0}>
                    <SelectionBarAction
                        icon={<RotateCcwIcon class="size-4" />} label="Restaurar" variant="success"
                        onClick={() => state.setShowBulkRestoreConfirm(true)} loading={state.bulkRestoreMut.isPending} loadingText="Restaurando..."
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
                                <span class="flex-1 font-medium">Desactivar Activas</span>
                                <span class="bg-danger/20 text-danger font-bold text-xs px-1.5 py-0.5 rounded tabular-nums">{state.selectedActiveCount()}</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item onSelect={() => state.setShowBulkRestoreConfirm(true)}>
                                <RotateCcwIcon class="size-4 mr-2 text-emerald-500" />
                                <span class="flex-1 text-emerald-500 font-medium">Restaurar Inactivas</span>
                                <span class="bg-emerald-500/20 text-emerald-500 font-bold text-xs px-1.5 py-0.5 rounded tabular-nums">{state.selectedInactiveCount()}</span>
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu>
                </Show>
            </DataTableSelectionBar>

            {/* Dialogs */}
            <ConfirmDialog
                isOpen={state.showBulkDeleteConfirm()}
                onClose={() => state.setShowBulkDeleteConfirm(false)}
                onConfirm={state.confirmBulkDelete}
                title={`Desactivar ${state.selectedActiveCount()} marcas`}
                description="Las marcas seleccionadas quedarán inactivas. Podrás restaurarlas en cualquier momento."
                confirmLabel="Desactivar" variant="danger"
                isLoading={state.bulkDeleteMut.isPending}
            />
            <ConfirmDialog
                isOpen={state.showBulkRestoreConfirm()}
                onClose={() => state.setShowBulkRestoreConfirm(false)}
                onConfirm={state.confirmBulkRestore}
                title={`Restaurar ${state.selectedInactiveCount()} marcas`}
                description="Las marcas seleccionadas volverán a estar activas."
                confirmLabel="Restaurar" variant="success"
                isLoading={state.bulkRestoreMut.isPending}
            />
        </div>
    );
};

export default BrandsPage;
