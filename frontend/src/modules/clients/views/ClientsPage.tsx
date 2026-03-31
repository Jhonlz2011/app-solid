/**
 * ClientsPage — Orchestrator component.
 *
 * All state and logic extracted to useClientsState hook.
 * This component only handles layout and wiring of sub-components.
 */
import { Component, Show } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { useIsMobile } from '@shared/hooks/useIsMobile';
import { useClientsState } from '../hooks/useClientsState';

// UI Components
import { DataTable } from '@shared/ui/DataTable';
import { PageHeader } from '@shared/ui/PageHeader';
import { SearchInput } from '@shared/ui/SearchInput';
import { DropdownMenu } from '@shared/ui/DropdownMenu';
import { DataTableSelectionBar, SelectionBarAction, SelectionBarSeparator } from '@shared/ui/DataTable/DataTableSelectionBar';
import { DataTableColumnVisibility } from '@shared/ui/DataTable/DataTableColumnVisibility';
import Button from '@shared/ui/Button';
import ConfirmDialog from '@shared/ui/ConfirmDialog';
import ClientDeleteDialog from '../components/ClientDeleteDialog';
import { ClientCardList } from '../components/ClientCardList';
import { ClientFilterSheet } from '../components/ClientFilterSheet';

// Icons
import {
    PlusIcon, TrashIcon, UsersIcon, DownloadIcon, UploadIcon,
    FilterIcon, CopyIcon, RotateCcwIcon, ChevronsUpDownIcon,
} from '@shared/ui/icons';

const ClientsPage: Component = () => {
    const isMobile = useIsMobile();
    const state = useClientsState();

    // Cross-Module Modals — driven by ?modal= searchParam


    return (
        <div class="h-full flex flex-col bg-gradient-to-br from-background via-background to-surface/20">

            {/* Modals from Router (Sheets/Panels) */}
                <Outlet />
            {/* Header */}
            <div class="flex-shrink-0 p-3 sm:p-4 space-y-4 sm:space-y-5">
                <PageHeader
                    icon={<UsersIcon />}
                    iconBg="linear-gradient(135deg, #10b981, #059669)"
                    title="Clientes"
                    count={state.totalRows()}
                    info="Gestiona los clientes de tu negocio. Puedes agregar, editar, eliminar y buscar clientes."
                    actions={
                        <div class="flex items-center gap-2">
                            <Button variant="outline" icon={<UploadIcon />} onClick={() => toast.info('Importación próximamente')}>
                                <span class="hidden sm:inline">Importar</span>
                            </Button>
                            <Show when={state.auth.canAdd('clients')}>
                                <Button
                                    to="/clients/new"
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
                        placeholder="Buscar clientes..."
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
                            <ClientCardList
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
                            data={state.clients()}
                            columns={state.columns()}
                            isLoading={state.clientsQuery.isPending}
                            isPlaceholderData={state.clientsQuery.isPlaceholderData}
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
                            emptyMessage="No hay clientes"
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
            <ClientFilterSheet
                isOpen={state.showFilterSheet()}
                onClose={() => state.setShowFilterSheet(false)}
                filters={state.filterSheetConfig}
            />

            {/* Dialogs */}
            <ClientDeleteDialog
                client={state.deleteTarget()}
                onClose={() => state.setDeleteTarget(null)}
                onSuccess={() => toast.success('Cliente eliminado')}
            />
            <ConfirmDialog
                isOpen={state.showBulkDeleteConfirm()}
                onClose={() => state.setShowBulkDeleteConfirm(false)}
                onConfirm={state.confirmBulkDelete}
                title={`Eliminar ${state.selectedActiveCount()} clientes`}
                description="Los clientes seleccionados quedarán inactivos. Podrás restaurarlos en cualquier momento."
                confirmLabel="Eliminar" variant="danger"
                isLoading={state.bulkDeleteMutation.isPending}
            />
            <ConfirmDialog
                isOpen={state.showBulkRestoreConfirm()}
                onClose={() => state.setShowBulkRestoreConfirm(false)}
                onConfirm={state.confirmBulkRestore}
                title={`Restaurar ${state.selectedInactiveCount()} clientes`}
                description="Los clientes seleccionados volverán a estar activos."
                confirmLabel="Restaurar" variant="success"
                isLoading={state.bulkRestoreMutation.isPending}
            />
        </div>
    );
};

export default ClientsPage;
