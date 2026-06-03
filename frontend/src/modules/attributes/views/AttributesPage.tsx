/**
 * AttributesPage — Full-featured Attribute management page with DataTable.
 * Includes RBAC-gated actions and AttributeDeleteDialog.
 */
import { Component, Show } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { useAttributeState } from '../hooks/useAttributeState';
import AttributeDeleteDialog from '../components/AttributeDeleteDialog';

// UI Components
import { DataTable } from '@shared/ui/DataTable';
import { PageHeader } from '@shared/ui/PageHeader';
import { SearchInput } from '@shared/ui/SearchInput';
import { DataTableSelectionBar, SelectionBarAction } from '@shared/ui/DataTable/DataTableSelectionBar';
import { DataTableColumnVisibility } from '@shared/ui/DataTable/DataTableColumnVisibility';
import Button from '@shared/ui/Button';
import LinkButton from '@shared/ui/LinkButton';

// Icons
import {
    PlusIcon, DownloadIcon, CopyIcon, LayoutIcon,
} from '@shared/ui/icons';

const AttributesPage: Component = () => {
    const state = useAttributeState();
    return (
        <div class="h-full flex flex-col bg-linear-to-br from-background via-background to-surface/20">
            <Outlet />
            {/* Header */}
            <div class="shrink-0 p-3 sm:p-4 space-y-4 sm:space-y-5">
                <PageHeader
                    icon={<LayoutIcon />}
                    iconBg="linear-gradient(135deg, #8b5cf6, #7c3aed)"
                    title="Atributos"
                    count={state.totalRows()}
                    info="Atributos para clasificar productos."
                    actions={
                        <div class="flex items-center gap-2">
                            <Show when={state.canCreate()}>
                                <LinkButton to="/attributes/new" preload="intent" icon={<PlusIcon />}>
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
                        placeholder="Buscar atributo..."
                        class="flex-1 w-full min-w-xs max-w-md"
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
                        data={state.attributeList()}
                        columns={state.columns()}
                        isLoading={state.attrQuery.isPending}
                        isPlaceholderData={state.attrQuery.isPlaceholderData}
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
                        emptyIcon={<LayoutIcon />}
                        emptyMessage="No hay atributos"
                        emptyDescription="Crea un nuevo atributo para comenzar"
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
            <AttributeDeleteDialog
                attribute={state.deleteTarget()}
                onClose={() => state.setDeleteTarget(null)}
                onSuccess={() => toast.success('Atributo procesado correctamente')}
            />
        </div>
    );
};

export default AttributesPage;
