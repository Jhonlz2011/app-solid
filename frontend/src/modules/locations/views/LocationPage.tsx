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
import { PlusIcon, MapPinIcon, CopyIcon, DownloadIcon, AlertCircleIcon, IdCardIcon } from '@shared/ui/icons';
import { DataTableSelectionBar, SelectionBarAction, SelectionBarSeparator } from '@shared/ui/DataTable/DataTableSelectionBar';
import { WarehouseSelect } from '@shared/ui/selectors/WarehouseSelect';
import { cn } from '@shared/lib/utils';
import LocationTable from '../components/LocationTable';
import LocationDeleteDialog from '../components/LocationDeleteDialog';
import { useLocationState } from '../hooks/useLocationState';
import { LOCATION_TYPE_META, locationTypeOptions } from '../data/locations.constants';
import { toast } from 'solid-sonner';

const LocationPage: Component = () => {
    const navigate = useNavigate();
    const state = useLocationState();

    const handleNewLocation = (parentId?: number) => {
        navigate({
            to: '/locations/new',
            search: parentId ? ({ parentId: String(parentId) } as any) : undefined,
        });
    };

    const handleShowLocation = (id: number) => {
        navigate({ to: `/locations/${id}/show` });
    };

    return (
        <div class="h-full flex flex-col bg-gradient-to-br from-background via-background to-surface/20">
            {/* Deep nested routing for Sheets/Panels */}
            <Outlet />

            {/* Header */}
            <div class="flex-shrink-0 p-3 sm:p-4 space-y-4 sm:space-y-5">
                <PageHeader
                    icon={<MapPinIcon />}
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
                <div class="flex flex-wrap items-center gap-2 sm:gap-3">
                    {/* Search */}
                    <SearchInput
                        value={state.search()}
                        onSearch={state.setSearch}
                        placeholder="Buscar ubicación..."
                        class="flex-1 w-full min-w-[150px] max-w-md"
                    />

                    {/* Warehouse filter */}
                    <div class="w-[220px] min-w-[180px]">
                        <WarehouseSelect
                            value={state.warehouseFilter()}
                            onChange={(id) => state.setWarehouseFilter(id)}
                            placeholder="Todas las bodegas"
                        />
                    </div>

                    {/* Type filter chips */}
                    <div class="flex items-center gap-1 bg-surface/50 rounded-lg p-0.5 border border-border/50">
                        <button
                            type="button"
                            class={cn(
                                "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                                state.typeFilter() === null
                                    ? "bg-card text-text shadow-sm"
                                    : "text-muted hover:text-text"
                            )}
                            onClick={() => state.setTypeFilter(null)}
                        >
                            Todos
                        </button>
                        {locationTypeOptions.map(opt => (
                            <button
                                type="button"
                                class={cn(
                                    "px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1",
                                    state.typeFilter() === opt.value
                                        ? "bg-card text-text shadow-sm"
                                        : "text-muted hover:text-text"
                                )}
                                onClick={() => state.setTypeFilter(state.typeFilter() === opt.value ? null : opt.value)}
                            >
                                <span class={`size-1.5 rounded-full ${LOCATION_TYPE_META[opt.value as keyof typeof LOCATION_TYPE_META].color.split(' ')[0] === 'text-blue-500' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Status filter */}
                    <div class="flex items-center gap-1 bg-surface/50 rounded-lg p-0.5 border border-border/50">
                        <button
                            type="button"
                            class={cn(
                                "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                                state.statusFilter() === 'active'
                                    ? "bg-card text-text shadow-sm"
                                    : "text-muted hover:text-text"
                            )}
                            onClick={() => state.setStatusFilter('active')}
                        >
                            Activos
                        </button>
                        <button
                            type="button"
                            class={cn(
                                "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                                state.statusFilter() === 'inactive'
                                    ? "bg-card text-text shadow-sm"
                                    : "text-muted hover:text-text"
                            )}
                            onClick={() => state.setStatusFilter('inactive')}
                        >
                            Inactivos
                        </button>
                        <button
                            type="button"
                            class={cn(
                                "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                                state.statusFilter() === 'all'
                                    ? "bg-card text-text shadow-sm"
                                    : "text-muted hover:text-text"
                            )}
                            onClick={() => state.setStatusFilter('all')}
                        >
                            Todos
                        </button>
                    </div>

                    {/* Export */}
                    <Button variant="ghost" icon={<DownloadIcon />} onClick={() => toast.info('Exportación próximamente')}>
                        <span class="hidden sm:inline">Exportar</span>
                    </Button>
                </div>
            </div>

            {/* Content — Tree Table */}
            <div class="flex-1 min-h-0 px-3 pb-3 sm:px-4 sm:pb-4 overflow-hidden">
                <LocationTable
                    data={state.filteredList()}
                    rawData={(state.locationQuery.data ?? []) as any[]}
                    isLoading={state.locationQuery.isPending}
                    totalCount={state.filteredCount()}
                    onEdit={handleShowLocation}
                    onAddChild={handleNewLocation}
                    rowSelection={state.rowSelection()}
                    onRowSelectionChange={state.setRowSelection}
                />
            </div>

            {/* Selection Bar */}
            <DataTableSelectionBar
                selectedCount={state.selectedCount()}
                totalRows={state.filteredCount()}
                onClearSelection={() => state.setRowSelection({})}
            >
                <SelectionBarAction
                    icon={<CopyIcon class="size-4" />}
                    label="Copiar"
                    onClick={state.handleCopySelection}
                    iconOnMobile
                />
                <SelectionBarSeparator />
                <Show when={state.canDelete()}>
                    <SelectionBarAction
                        icon={<AlertCircleIcon class="size-4" />}
                        label="Desactivar"
                        onClick={state.handleBatchDeactivate}
                        variant="danger"
                    />
                    <SelectionBarAction
                        icon={<IdCardIcon class="size-4" />}
                        label="Restaurar"
                        onClick={state.handleBatchRestore}
                    />
                </Show>
            </DataTableSelectionBar>

            {/* Delete Dialog */}
            <LocationDeleteDialog
                location={state.deleteTarget()}
                onClose={() => state.setDeleteTarget(null)}
            />
        </div>
    );
};

export default LocationPage;
