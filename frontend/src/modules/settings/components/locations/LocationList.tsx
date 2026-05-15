import { Component, For, Show, createMemo } from 'solid-js';
import { Outlet, useParams, useNavigate, Link } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { useLocationsByWarehouse } from '../../data/warehouses.queries';
import { useWarehousesList } from '../../data/warehouses.queries';
import { useDeactivateLocation, useRestoreLocation } from '../../data/warehouses.mutations';
import type { LocationItem, WarehouseItem } from '../../data/warehouses.api';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import { StatusBadge } from '@shared/ui/Badge';
import { EditIcon, ChevronLeftIcon, FolderIcon, BoxIcon } from '@shared/ui/icons';

/** Build tree from flat list using depth+path ordering */
function buildLocationTree(flat: LocationItem[]): Array<LocationItem & { children: LocationItem[] }> {
    type NodeWithChildren = LocationItem & { children: NodeWithChildren[] };
    const roots: NodeWithChildren[] = [];
    const stack: NodeWithChildren[] = [];

    for (const item of flat) {
        const node: NodeWithChildren = { ...item, children: [] };
        while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
            stack.pop();
        }
        if (stack.length === 0) {
            roots.push(node);
        } else {
            stack[stack.length - 1].children.push(node);
        }
        stack.push(node);
    }
    return roots;
}

const LocationRow: Component<{
    item: LocationItem & { children: any[] };
    onEdit: (id: number) => void;
    onToggle: (item: LocationItem) => void;
}> = (props) => {
    const indent = () => props.item.depth * 24;

    return (
        <>
            <div
                class="grid grid-cols-[1fr_100px_140px_80px_100px] gap-4 px-4 py-2 items-center hover:bg-surface/20 transition-colors group"
            >
                <div class="flex items-center gap-2" style={{ "padding-left": `${indent()}px` }}>
                    {props.item.type === 'VIEW'
                        ? <FolderIcon class="size-4 text-primary shrink-0" />
                        : <BoxIcon class="size-4 text-muted shrink-0" />
                    }
                    <span
                        class="text-sm font-medium text-text"
                        classList={{ 'text-muted line-through': !(props.item.is_active ?? true) }}
                    >
                        {props.item.name}
                    </span>
                    <Show when={props.item.children.length > 0}>
                        <span class="text-[10px] text-muted bg-surface/50 px-1.5 py-0.5 rounded-full">
                            {props.item.children.length}
                        </span>
                    </Show>
                </div>
                <span class="text-xs font-mono text-muted">
                    {props.item.type === 'VIEW' ? 'Vista' : 'Interna'}
                </span>
                <span class="text-xs font-mono text-muted truncate" title={props.item.barcode ?? undefined}>
                    {props.item.barcode || '—'}
                </span>
                <div class="flex justify-center">
                    <StatusBadge isActive={props.item.is_active ?? true} />
                </div>
                <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        class="size-7 flex items-center justify-center rounded-lg hover:bg-primary/10 text-muted hover:text-primary transition-colors"
                        onClick={() => props.onEdit(props.item.id)}
                        title="Editar ubicación"
                    >
                        <EditIcon class="size-3.5" />
                    </button>
                    <button
                        class="text-xs px-2 py-1 rounded-lg transition-colors"
                        classList={{
                            'hover:bg-danger/10 text-muted hover:text-danger': (props.item.is_active ?? true),
                            'hover:bg-emerald-500/10 text-muted hover:text-emerald-500': !(props.item.is_active ?? true),
                        }}
                        onClick={() => props.onToggle(props.item)}
                    >
                        {(props.item.is_active ?? true) ? 'Desact.' : 'Restaurar'}
                    </button>
                </div>
            </div>
            {/* Recursively render children */}
            <For each={props.item.children}>
                {(child) => <LocationRow item={child} onEdit={props.onEdit} onToggle={props.onToggle} />}
            </For>
        </>
    );
};

const LocationList: Component = () => {
    const params = useParams({ strict: false }) as () => { warehouseId?: string };
    const navigate = useNavigate();

    const warehouseId = () => {
        const parsed = Number(params()?.warehouseId);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const warehousesQuery = useWarehousesList();
    const locationsQuery = useLocationsByWarehouse(() => warehouseId() || null);
    const deactivateMut = useDeactivateLocation();
    const restoreMut = useRestoreLocation();

    const warehouse = createMemo(() => {
        return (warehousesQuery.data ?? []).find((w: WarehouseItem) => w.id === warehouseId()) ?? null;
    });

    const locationTree = createMemo(() => {
        const flat = (locationsQuery.data ?? []) as LocationItem[];
        return buildLocationTree(flat);
    });

    const handleEdit = (id: number) => {
        navigate({ to: `/settings/warehouses/${warehouseId()}/locations/${id}/edit` });
    };

    const handleToggle = (item: LocationItem) => {
        const isActive = item.is_active ?? true;
        if (isActive) {
            deactivateMut.mutate(item.id, {
                onSuccess: () => toast.success(`"${item.name}" desactivada`),
                onError: (err: any) => toast.error(err.message || 'Error'),
            });
        } else {
            restoreMut.mutate(item.id, {
                onSuccess: () => toast.success(`"${item.name}" restaurada`),
                onError: (err: any) => toast.error(err.message || 'Error'),
            });
        }
    };

    return (
        <>
            {/* Deep-linked modal sheets */}
            <Outlet />

            <div class="space-y-4">
                {/* Header with back nav */}
                <div class="flex items-center gap-3">
                    <Link
                        to="/settings/warehouses"
                        class="size-8 flex items-center justify-center rounded-lg hover:bg-surface/50 text-muted hover:text-text transition-colors"
                    >
                        <ChevronLeftIcon class="size-4" />
                    </Link>
                    <div>
                        <h2 class="text-lg font-semibold text-text">
                            Ubicaciones — {warehouse()?.name ?? 'Cargando...'}
                        </h2>
                        <p class="text-xs text-muted mt-0.5">
                            Gestiona las zonas, pasillos, estantes y ubicaciones internas de esta bodega.
                        </p>
                    </div>
                    <div class="flex-1" />
                    <Link
                        to={`/settings/warehouses/${warehouseId()}/locations/new`}
                        class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors"
                    >
                        + Nueva Ubicación
                    </Link>
                </div>

                <Show when={!locationsQuery.isPending} fallback={<SkeletonLoader type="table-row" count={4} />}>
                    <Show
                        when={locationTree().length > 0}
                        fallback={
                            <div class="text-center py-12 text-muted">
                                <BoxIcon class="size-10 text-muted/30 mx-auto mb-2" />
                                <p class="text-sm">No hay ubicaciones creadas aún en esta bodega.</p>
                                <p class="text-xs mt-1">Crea zonas, pasillos o estantes para organizar tu inventario.</p>
                            </div>
                        }
                    >
                        <div class="border border-border rounded-xl overflow-hidden divide-y divide-border/50">
                            <div class="grid grid-cols-[1fr_100px_140px_80px_100px] gap-4 px-4 py-2.5 bg-surface/30 text-xs font-semibold uppercase tracking-wider text-muted">
                                <span>Nombre</span>
                                <span>Tipo</span>
                                <span>Código de Barras</span>
                                <span class="text-center">Estado</span>
                                <span class="text-right">Acciones</span>
                            </div>
                            <For each={locationTree()}>
                                {(item) => <LocationRow item={item} onEdit={handleEdit} onToggle={handleToggle} />}
                            </For>
                        </div>
                    </Show>
                </Show>
            </div>
        </>
    );
};

export default LocationList;
