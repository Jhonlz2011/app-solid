/**
 * LocationPage — Full-featured location management with tree table.
 *
 * Includes: SearchInput, WarehouseSelect filter, type/status filter chips,
 * checkbox selection, DataTableSelectionBar for batch actions.
 */
import { Component, Show } from 'solid-js';
import { Outlet, useNavigate } from '@tanstack/solid-router';
import { PageHeader } from '@shared/ui/PageHeader';
import { SearchInput } from '@shared/ui/SearchInput';
import Button from '@shared/ui/Button';
import { PlusIcon, ShelvesIcon, CopyIcon, Expand, Collapse, TrashIcon, RotateCcwIcon, ChevronsUpDownIcon } from '@shared/ui/icons';
import { DataTableSelectionBar, SelectionBarAction, SelectionBarSeparator } from '@shared/ui/DataTable/DataTableSelectionBar';
import { DataTableColumnVisibility } from '@shared/ui/DataTable/DataTableColumnVisibility';
import { DropdownMenu } from '@shared/ui/DropdownMenu';
import LocationTable from '../components/LocationTable';
import LocationDeleteDialog from '../components/LocationDeleteDialog';
import ConfirmDialog from '@shared/ui/ConfirmDialog';
import { useLocationState } from '../hooks/useLocationState';
import { toast } from 'solid-sonner';

const LocationPage: Component = () => {
    const navigate = useNavigate();
    const state = useLocationState();

    const handleNewLocation = (parentId?: number) => {
        navigate({
            to: '/locations/new',
            search: parentId ? { parentId: String(parentId) } : undefined,
        } as any);
    };

    const handleShowLocation = (id: number) => {
        navigate({ to: `/locations/${id}/show` } as any);
    };

    return (
        <div class="h-full flex flex-col bg-linear-to-br from-background via-background to-surface/20">
            {/* Deep nested routing for Sheets/Panels */}
            <Outlet />

            {/* Header */}
            <div class="shrink-0 p-3 sm:p-4 space-y-4 sm:space-y-5">
                <PageHeader
                    icon={<ShelvesIcon />}
                    iconBg="linear-gradient(135deg, #8b5cf6, #7c3aed)"
                    title="Ubicaciones"
                    count={state.totalCount()}
                    info="Organiza las ubicaciones de tus bodegas y zonas de almacenamiento."
                    actions={
                        <Show when={state.canCreate()}>
                            <Button to="/locations/new" preload="intent" icon={<PlusIcon />}>
                                <span class="hidden sm:inline">Nueva Ubicación</span>
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
                            placeholder="Buscar ubicación..."
                            /* flex-1 para que crezca y max-w-md para que no se descontrole en pantallas gigantes */
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
                <LocationTable
                    data={state.filteredList()}
                    rawData={(state.locationQuery.data ?? []) as any[]}
                    isLoading={state.locationQuery.isPending}
                    totalCount={state.filteredCount()}
                    onEdit={handleShowLocation}
                    onAddChild={handleNewLocation}
                    onDelete={state.handleDelete}
                    onRestore={state.handleRestore}
                    rowSelection={state.rowSelection()}
                    onRowSelectionChange={state.setRowSelection}
                    filters={state.filters}
                    tableRef={state.setTableInstance}
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
                            <DropdownMenu.Content class="min-w-45">
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
            <LocationDeleteDialog
                location={state.deleteTarget()}
                onClose={() => state.setDeleteTarget(null)}
                onSuccess={() => {
                    const target = state.deleteTarget();
                    if (target) {
                        state.clearSelection([target.id]);
                    }
                    toast.success('Ubicación procesada correctamente');
                }}
            />

            <ConfirmDialog
                isOpen={state.showBulkDeleteConfirm()}
                onClose={() => state.setShowBulkDeleteConfirm(false)}
                onConfirm={state.confirmBulkDelete}
                title={`Desactivar ${state.selectedActiveCount()} ubicaciones`}
                description="Las ubicaciones seleccionadas quedarán inactivas. Podrás restaurarlas en cualquier momento."
                confirmLabel="Desactivar" variant="danger"
                isLoading={state.bulkDeactivateMut.isPending}
            />

            <ConfirmDialog
                isOpen={state.showBulkRestoreConfirm()}
                onClose={() => state.setShowBulkRestoreConfirm(false)}
                onConfirm={state.confirmBulkRestore}
                title={`Restaurar ${state.selectedInactiveCount()} ubicaciones`}
                description="Las ubicaciones seleccionadas volverán a estar activas."
                confirmLabel="Restaurar" variant="success"
                isLoading={state.bulkRestoreMut.isPending}
            />
        </div>
    );
};

export default LocationPage;
