/**
 * UomPage — Full-featured UOM management page with DataTable.
 * Includes RBAC-gated actions and UomDeleteDialog.
 */
import { Component, Show } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { useUomState } from '../hooks/useUomState';
import UomDeleteDialog from '../components/UomDeleteDialog';

// UI Components
import { DataTable } from '@shared/ui/DataTable';
import { PageHeader } from '@shared/ui/PageHeader';
import { SearchInput } from '@shared/ui/SearchInput';
import { DataTableSelectionBar, SelectionBarAction } from '@shared/ui/DataTable/DataTableSelectionBar';
import { DataTableColumnVisibility } from '@shared/ui/DataTable/DataTableColumnVisibility';
import Button from '@shared/ui/Button';

// Icons
import {
    PlusIcon, RulerIcon, DownloadIcon, UploadIcon, CopyIcon,
} from '@shared/ui/icons';

const UomPage: Component = () => {
    const state = useUomState();
    return (
        <div class="h-full flex flex-col bg-gradient-to-br from-background via-background to-surface/20">
            <Outlet />

            {/* Header */}
            <div class="flex-shrink-0 p-3 sm:p-4 space-y-4 sm:space-y-5">
                <PageHeader
                    icon={<RulerIcon />}
                    iconBg="linear-gradient(135deg, #0ea5e9, #0284c7)"
                    title="Unidades de Medida"
                    count={state.totalRows()}
                    info="Unidades de medidas."
                    actions={
                        <div class="flex items-center gap-2">
                            <Show when={state.canCreate()}>
                                <Button to="/uom/new" preload="intent" icon={<PlusIcon />}>
                                    <span class="hidden @sm:inline">Nuevo</span>
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
                        placeholder="Buscar unidad..."
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
                        data={state.uomList()}
                        columns={state.columns()}
                        isLoading={state.uomQuery.isPending}
                        isPlaceholderData={state.uomQuery.isPlaceholderData}
                        pagination={{ pageIndex: state.page() - 1, pageSize: state.pageSize() }}
                        onPaginationChange={() => {}}
                        pageCount={state.pageCount()}
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
                        emptyIcon={<RulerIcon />}
                        emptyMessage="No hay unidades de medida"
                        emptyDescription="Crea una nueva unidad para comenzar"
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
            </DataTableSelectionBar>

            {/* Delete Dialog */}
            <UomDeleteDialog
                uom={state.deleteTarget()}
                onClose={() => state.setDeleteTarget(null)}
                onSuccess={() => toast.success('Unidad procesada correctamente')}
            />
        </div>
    );
};

export default UomPage;
