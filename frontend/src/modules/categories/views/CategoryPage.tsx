/**
 * CategoryPage — Full-featured category management with tree table.
 *
 * Includes: SearchInput, status filter, checkbox selection,
 * DataTableSelectionBar for batch actions, ConfirmDialogs.
 */
import { Component, Show } from 'solid-js';
import { Outlet, useNavigate } from '@tanstack/solid-router';
import { PageHeader } from '@shared/ui/PageHeader';
import { SearchInput } from '@shared/ui/SearchInput';
import Button from '@shared/ui/Button';
import { PlusIcon, TagIcon, CopyIcon, TrashIcon, RotateCcwIcon, ChevronsUpDownIcon, Expand, Collapse } from '@shared/ui/icons';
import { DataTableSelectionBar, SelectionBarAction, SelectionBarSeparator } from '@shared/ui/DataTable/DataTableSelectionBar';
import { DataTableColumnVisibility } from '@shared/ui/DataTable/DataTableColumnVisibility';
import { DropdownMenu } from '@shared/ui/DropdownMenu';
import CategoryTable from '../components/CategoryTable';
import CategoryDeleteDialog from '../components/CategoryDeleteDialog';
import ConfirmDialog from '@shared/ui/ConfirmDialog';
import { useCategoryState } from '../hooks/useCategoryState';
import { toast } from 'solid-sonner';

const CategoryPage: Component = () => {
    const navigate = useNavigate();
    const state = useCategoryState();

    const handleNewCategory = (parentId?: number) => {
        navigate({ 
            to: '/categories/new',
            search: parentId ? { parentId: String(parentId) } : undefined,
        } as any);
    };

    const handleShowCategory = (id: number) => {
        navigate({ to: `/categories/${id}/show`, search: undefined });
    };

    return (
        <div class="h-full flex flex-col bg-linear-to-br from-background via-background to-surface/20">
            {/* Deep nested routing for Sheets/Panels */}
            <Outlet />

            {/* Header */}
            <div class="shrink-0 p-3 sm:p-4 space-y-4 sm:space-y-5">
                <PageHeader
                    icon={<TagIcon />}
                    iconBg="linear-gradient(135deg, #f59e0b, #d97706)"
                    title="Categorías"
                    count={state.totalCount()}
                    info="Organiza las categorías de tus productos y define la estructura de tu catálogo."
                    actions={
                        <Show when={state.canCreate()}>
                            <Button to="/categories/new" preload="intent" icon={<PlusIcon />}>
                                <span class="hidden sm:inline">Nueva Categoría</span>
                            </Button>
                        </Show>
                    }
                />

                {/* ─── Toolbar ─── */}
                <div class="@container w-full">
                    <div class="grid grid-cols-1 @md:grid-cols-2 gap-3 items-center w-full">  
                        <div class="flex flex-row items-stretch @xs:items-center gap-2 w-full">
                            <SearchInput
                                value={state.search()}
                                onSearch={state.setSearch}
                                placeholder="Buscar categoría..."
                                class="flex-1 min-w-0 @sm:min-w-3xs max-w-md w-full"
                            />
                        
                            <Show when={state.tableInstance()}>
                                <div class="flex items-center min-w-fit">
                                    <DataTableColumnVisibility table={state.tableInstance()} />
                                </div>
                            </Show>
                        </div>
                        <Show when={state.tableInstance()}>
                            <div class="flex items-center gap-2 justify-end @md:justify-self-end w-full @md:w-auto">
                                <Button
                                    variant="ghost"
                                    size="md" 
                                    radius="xl"
                                    onClick={() => state.tableInstance().toggleAllRowsExpanded(true)}
                                    title="Expandir todas"
                                    class="text-muted hover:text-text focus-within:text-text"
                                    icon={<Expand />}
                                >
                                    <span class="hidden @2xl:inline">Expandir</span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="md"
                                    radius="xl"
                                    onClick={() => state.tableInstance().toggleAllRowsExpanded(false)}
                                    title="Colapsar todas"
                                    class="text-muted hover:text-text focus-within:text-text"
                                    icon={<Collapse />}
                                >
                                    <span class="hidden @2xl:inline">Colapsar</span>
                                </Button>
                            </div>
                        </Show>
                    </div>
                </div>
            </div>

            {/* Content — Tree Table */}
            <div class="flex-1 min-h-0 px-3 pb-3 sm:px-4 sm:pb-4 overflow-visible">
                <CategoryTable
                    data={state.filteredList()}
                    rawData={state.rawList()}
                    isLoading={state.categoryQuery.isPending}
                    onEdit={handleShowCategory}
                    onAddChild={handleNewCategory}
                    onDelete={(id) => {
                        const item = (state.categoryQuery.data as any)?.find((c: any) => c.id === id);
                        if (item) state.handleDelete(item);
                    }}
                    onRestore={(id) => {
                        const item = (state.categoryQuery.data as any)?.find((c: any) => c.id === id);
                        if (item) state.handleRestore(item);
                    }}
                    rowSelection={state.rowSelection()}
                    onRowSelectionChange={state.setRowSelection}
                    onTableReady={state.setTableInstance}
                    filters={state.filters}
                />
            </div>

            {/* Selection Bar */}
            <DataTableSelectionBar
                selectedCount={state.selectedCount()}
                totalRows={state.filteredCount()}
                onClearSelection={() => state.clearSelection()}
            >
                <SelectionBarAction
                    icon={<CopyIcon class="size-4" />}
                    label="Copiar"
                    onClick={state.handleCopySelection}
                    iconOnMobile
                />
                <SelectionBarSeparator />
                <Show when={state.canDelete()}>
                    <Show when={state.selectedActiveCount() > 0 && state.selectedInactiveCount() === 0}>
                        <SelectionBarAction
                            icon={<TrashIcon class="size-4" />}
                            label="Desactivar"
                            onClick={state.handleBulkDelete}
                            variant="danger"
                        />
                    </Show>
                    <Show when={state.selectedInactiveCount() > 0 && state.selectedActiveCount() === 0}>
                        <SelectionBarAction
                            icon={<RotateCcwIcon class="size-4" />}
                            label="Restaurar"
                            variant="success"
                            onClick={state.handleBulkRestore}
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
                                    <span class="flex-1 font-medium">Desactivar Activos</span>
                                    <span class="bg-danger/20 text-danger font-bold text-xs px-1.5 py-0.5 rounded tabular-nums">{state.selectedActiveCount()}</span>
                                </DropdownMenu.Item>
                                <DropdownMenu.Item onSelect={state.handleBulkRestore}>
                                    <RotateCcwIcon class="size-4 mr-2 text-emerald-500" />
                                    <span class="flex-1 text-emerald-500 font-medium">Restaurar Inactivos</span>
                                    <span class="bg-emerald-500/20 text-emerald-500 font-bold text-xs px-1.5 py-0.5 rounded tabular-nums">{state.selectedInactiveCount()}</span>
                                </DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu>
                    </Show>
                </Show>
            </DataTableSelectionBar>

            {/* Delete Dialog */}
            <CategoryDeleteDialog
                category={state.deleteTarget()}
                onClose={() => state.setDeleteTarget(null)}
                onSuccess={() => {
                    const target = state.deleteTarget();
                    if (target) {
                        state.clearSelection([target.id]);
                    }
                    toast.success('Categoría procesada correctamente');
                }}
            />

            <ConfirmDialog
                isOpen={state.showBulkDeleteConfirm()}
                onClose={() => state.setShowBulkDeleteConfirm(false)}
                onConfirm={state.confirmBulkDelete}
                title={`Desactivar ${state.selectedActiveCount()} categorías`}
                description="Las categorías seleccionadas quedarán inactivas. Podrás restaurarlas en cualquier momento."
                confirmLabel="Desactivar" variant="danger"
                isLoading={state.bulkDeactivateMut.isPending}
            />

            <ConfirmDialog
                isOpen={state.showBulkRestoreConfirm()}
                onClose={() => state.setShowBulkRestoreConfirm(false)}
                onConfirm={state.confirmBulkRestore}
                title={`Restaurar ${state.selectedInactiveCount()} categorías`}
                description="Las categorías seleccionadas volverán a estar activas."
                confirmLabel="Restaurar" variant="success"
                isLoading={state.bulkRestoreMut.isPending}
            />
        </div>
    );
};

export default CategoryPage;
