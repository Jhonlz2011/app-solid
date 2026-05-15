import { Component, Show, createSignal, createEffect, on } from 'solid-js';
import { useParams } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { LocationFormSchema, type LocationFormData } from '@app/schema/frontend';
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

interface LocationEditSheetProps { onClose?: () => void; onBack?: () => void; }

const LocationEditSheet: Component<LocationEditSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => { locationId?: string };
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);
    const auth = useAuth();
    const canEdit = () => auth.canEdit('locations');

    const locationId = () => Number(params()?.locationId) || 0;

    const locationQuery = useLocationList();
    const updateMut = useUpdateLocation();

    const locationItem = () => ((locationQuery.data ?? []) as LocationItem[]).find(l => l.id === locationId()) ?? null;

    const form = createForm(() => ({
        defaultValues: { name: '', type: 'INTERNAL', barcode: '', parent_id: null } as LocationFormData,
        validatorAdapter: valibotValidator(),
        validators: { onChange: LocationFormSchema, onSubmit: LocationFormSchema },
        onSubmit: async ({ value }) => {
            if (!locationId() || !canEdit()) return;
            updateMut.mutate(
                {
                    id: locationId(),
                    data: {
                        name: value.name,
                        type: value.type as 'VIEW' | 'INTERNAL',
                        barcode: value.barcode || null,
                    },
                },
                {
                    onSuccess: () => { toast.success('Ubicación actualizada'); navigateAway(); },
                    onError: (err: any) => toast.error(err.message || 'Error al actualizar'),
                },
            );
        },
    }));

    // Hydrate form when location data loads
    createEffect(on(locationItem, (item) => {
        if (item) {
            form.setFieldValue('name', item.name);
            form.setFieldValue('type', item.type as any);
            form.setFieldValue('barcode', item.barcode ?? '');
            form.setFieldValue('parent_id', item.parent_id as any);
        }
    }));

    const handleSubmit = () => { setHasAttemptedSubmit(true); form.handleSubmit(); };

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
                        <Button type="submit" form="location-edit-form" loading={updateMut.isPending} loadingText="Guardando..." icon={<FloppyDiskIcon />} onClick={handleSubmit}>
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
                            form={form}
                            formId="location-edit-form"
                            hasAttemptedSubmit={hasAttemptedSubmit}
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
