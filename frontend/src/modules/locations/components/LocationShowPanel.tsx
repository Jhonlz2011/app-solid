import { Component, Show } from 'solid-js';
import { useParams, Outlet } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { useLocationList } from '../data/locations.queries';
import { LOCATION_TYPE_META } from '../data/locations.constants';
import type { LocationType } from '@app/schema/enums';
import type { LocationItem } from '../data/locations.api';
import { EditIcon, MapPinIcon } from '@shared/ui/icons';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Button from '@shared/ui/Button';
import Sheet from '@shared/ui/Sheet';
import { StatusBadge } from '@shared/ui/Badge';
import { InfoRow } from '@shared/ui/InfoRow';

interface LocationShowPanelProps {
    locationId?: number;
    onClose?: () => void;
}

const LocationShowPanel: Component<LocationShowPanelProps> = (props) => {
    const params = useParams({ strict: false }) as () => { locationId?: string };
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const locationId = () => {
        if (props.locationId) return props.locationId;
        const parsed = Number(params()?.locationId);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const locationQuery = useLocationList();
    const locationItem = () => ((locationQuery.data ?? []) as LocationItem[]).find(l => l.id === locationId()) ?? null;

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Detalles de la Ubicación"
            description="Información completa de esta ubicación"
            size="xl"
            footer={
                <Button variant="outline" onClick={close}>
                    Cerrar Panel
                </Button>
            }
        >
            <Show
                when={locationId() > 0}
                fallback={
                    <div class="flex flex-col items-center justify-center py-12 text-center h-full">
                        <div class="text-4xl mb-4 opacity-50">🔍</div>
                        <p class="text-muted font-medium">ID de ubicación inválido</p>
                    </div>
                }
            >
                <Show
                    when={!locationQuery.isLoading}
                    fallback={
                        <div class="space-y-6 pt-4">
                            <div class="flex items-center gap-4">
                                <SkeletonLoader type="avatar" class="size-16" />
                                <div class="space-y-2">
                                    <SkeletonLoader type="text" class="w-48 h-6" />
                                    <SkeletonLoader type="text" class="w-32 h-4" />
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <SkeletonLoader type="card" class="h-24" />
                            </div>
                        </div>
                    }
                >
                    <Show
                        when={locationItem()}
                        fallback={
                            <div class="flex flex-col items-center justify-center py-12 text-center h-full">
                                <div class="text-4xl mb-4 opacity-50">📭</div>
                                <p class="text-muted font-medium">No se encontró la ubicación</p>
                            </div>
                        }
                    >
                        {(location) => {
                            const typeMeta = () => LOCATION_TYPE_META[location().type as LocationType];
                            const TypeIcon = () => {
                                const meta = typeMeta();
                                return meta ? <meta.icon class="size-5" /> : null;
                            };

                            return (
                                <div class="flex flex-col gap-5 pt-5">
                                    {/* Header */}
                                    <div class="flex items-start justify-between flex-shrink-0">
                                        <div class="flex gap-4 items-center">
                                            <div class="size-14 rounded-2xl bg-info/10 flex items-center justify-center text-info shadow-inner border border-info/20">
                                                <MapPinIcon class="size-6" />
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <h3 class="text-xl font-bold text-text leading-tight">{location().name}</h3>
                                                <p class="text-sm font-mono text-muted/80">{location().path}</p>
                                                <div class="flex gap-2 items-center mt-1">
                                                    <StatusBadge isActive={location().is_active ?? true} />
                                                    <Show when={typeMeta()}>
                                                        <span class={`inline-flex items-center gap-1 text-[10px] font-bold uppercase py-0.5 px-2 rounded-sm tracking-wider ${typeMeta()!.color}`}>
                                                            <TypeIcon />
                                                            {typeMeta()!.label}
                                                        </span>
                                                    </Show>
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            class="gap-2 shrink-0 bg-surface/50 hover:bg-surface"
                                            to={`./edit`}
                                            disabled={!locationId()}
                                        >
                                            <EditIcon class="size-4 text-muted" />
                                            Editar
                                        </Button>
                                    </div>

                                    {/* Info Card */}
                                    <div class="bg-surface/30 rounded-2xl border border-border/40 overflow-hidden shadow-sm">
                                        <div class="bg-surface/50 px-5 py-3 border-b border-border/40 font-semibold text-sm text-text flex items-center gap-2">
                                            <div class="size-1.5 rounded-full bg-primary"></div>
                                            Información de la Ubicación
                                        </div>
                                        <div class="p-5 grid grid-cols-1 gap-6">
                                            <InfoRow label="Nombre" value={location().name} />
                                            <InfoRow label="Ruta (ltree)" value={location().path} />
                                            <InfoRow label="Tipo" value={typeMeta()?.label ?? location().type} />
                                            <InfoRow label="Profundidad" value={String(location().depth)} />
                                            <InfoRow label="Código de Barras" value={location().barcode ?? '—'} />
                                            <InfoRow label="Bodega ID" value={location().warehouse_id ? String(location().warehouse_id) : 'Virtual (sin bodega)'} />
                                        </div>
                                    </div>
                                </div>
                            );
                        }}
                    </Show>
                </Show>
            </Show>

            <Outlet />
        </Sheet>
    );
};

export default LocationShowPanel;
