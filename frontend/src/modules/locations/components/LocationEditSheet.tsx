import { Component, Show } from 'solid-js';
import { useParams } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useLocationList } from '../data/locations.queries';
import { useUpdateLocation } from '../data/locations.mutations';
import type { LocationItem } from '../data/locations.api';
import { useAuth } from '@modules/auth/store/auth.store';
import { FloppyDiskIcon } from '@shared/ui/icons';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import LocationForm from './LocationForm';
import type { LocationFormData } from '@app/schema/frontend';

interface LocationEditSheetProps { onClose?: () => void; onBack?: () => void; }

const LocationEditSheet: Component<LocationEditSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => { locationId?: string };
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const auth = useAuth();
    const canEdit = () => auth.canEdit('locations');

    const locationId = () => Number(params()?.locationId) || 0;

    const locationQuery = useLocationList();
    const updateMut = useUpdateLocation();

    const locationItem = () => ((locationQuery.data ?? []) as LocationItem[]).find(l => l.id === locationId()) ?? null;

    const handleSubmit = async (data: LocationFormData) => {
        if (!locationId() || !canEdit()) return;
        try {
            await updateMut.mutateAsync({
                id: locationId(),
                data: {
                    name: data.name,
                    type: data.type as 'VIEW' | 'INTERNAL',
                    warehouse_id: data.warehouse_id ?? null,
                    parent_id: data.parent_id ?? null,
                },
            });
            toast.success('Ubicación actualizada');
            navigateAway();
        } catch (err: any) {
            toast.error(err.message || 'Error al actualizar');
            throw err;
        }
    };

    return (
        <Sheet
            bindDismiss={bindDismiss} isOpen={true} onClose={navigateAway} onBack={props.onBack}
            title="Editar Ubicación"
            description="Modifica los datos de la ubicación"
            size="md"
            footer={
                <>
                    <div class="flex-1" />
                    <Button variant="outline" onClick={close} disabled={updateMut.isPending}>Cancelar</Button>
                    <Show when={canEdit()}>
                        <Button 
                            type="submit" 
                            form="location-edit-form" 
                            loading={updateMut.isPending} 
                            loadingText="Guardando..." 
                            icon={<FloppyDiskIcon />}
                        >
                            Guardar
                        </Button>
                    </Show>
                </>
            }
        >
            <Show when={locationId()} fallback={<div class="py-12 text-center text-muted">ID inválido</div>}>
                <Show when={!locationQuery.isLoading} fallback={<SkeletonLoader type="text" count={3} />}>
                    <Show when={locationItem()} fallback={<div class="py-12 text-center text-muted">Ubicación no encontrada</div>}>
                        <LocationForm
                            location={locationItem()}
                            onSubmit={handleSubmit}
                            isSubmitting={updateMut.isPending}
                            formId="location-edit-form"
                            disabled={!canEdit()}
                            editingId={locationId()}
                        />
                    </Show>
                </Show>
            </Show>
        </Sheet>
    );
};

export default LocationEditSheet;
