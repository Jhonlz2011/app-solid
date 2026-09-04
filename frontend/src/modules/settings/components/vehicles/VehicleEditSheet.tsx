import { Component, createSignal, Show, createEffect } from 'solid-js';
import { useParams } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { CarrierVehicleFormSchema, type CarrierVehicleFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { executeFormMutation, handleFormApiErrors } from '@shared/utils/form.utils';
import { useVehicle } from '../../data/vehicles.queries';
import { useUpdateVehicle } from '../../data/vehicles.mutations';
import { FloppyDiskIcon } from '@icons/FloppyDiskIcon';
import { TruckIcon } from '@icons/TruckIcon';

import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { SkeletonLoader } from '@display/SkeletonLoader';
import TextField from '@form/TextField';
import Checkbox from '@form/Checkbox';
import Sheet from '@overlay/Sheet';
import Button from '@form/Button';

interface VehicleEditSheetProps {
    vehicleId?: number;
    onClose?: () => void;
}

const VehicleEditSheet: Component<VehicleEditSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => any;
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const vehicleId = () => props.vehicleId ?? Number(params()?.vehicleId);

    const vehicleQuery = useVehicle(vehicleId);
    const updateMut = useUpdateVehicle();
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    const form = createForm(() => ({
        defaultValues: {
            licensePlate: vehicleQuery.data?.license_plate ?? '',
            description: vehicleQuery.data?.description ?? '',
            isActive: vehicleQuery.data?.is_active ?? true,
        } as CarrierVehicleFormData,
        validators: {
            onChange: CarrierVehicleFormSchema,
            onSubmit: CarrierVehicleFormSchema,
        },
        onSubmit: async ({ value }) => {
            if (vehicleId() <= 0) return;
            try {
                await executeFormMutation({
                    mutation: updateMut,
                    variables: {
                        id: vehicleId(),
                        data: {
                            licensePlate: value.licensePlate.toUpperCase().trim(),
                            description: value.description || undefined,
                            isActive: value.isActive ?? true,
                        },
                    },
                    successMessage: 'Vehículo actualizado',
                    onComplete: navigateAway,
                });
            } catch (err) {
                handleFormApiErrors(form, err, 'Error al actualizar el vehículo', 'vehicle-edit-form');
            }
        },
    }));

    createEffect(() => {
        const v = vehicleQuery.data;
        if (v) {
            form.setFieldValue('licensePlate', v.license_plate);
            form.setFieldValue('description', v.description ?? '');
            form.setFieldValue('isActive', v.is_active);
        }
    });

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Editar Vehículo"
            description="Modifica los datos del vehículo de la empresa"
            size="sm"
            footer={
                <>
                    <Button variant="outline" onClick={close} disabled={updateMut.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="vehicle-edit-form"
                        loading={updateMut.isPending}
                        loadingText="Guardando..."
                        icon={<FloppyDiskIcon />}
                    >
                        Guardar Cambios
                    </Button>
                </>
            }
        >
            <Show
                when={!vehicleQuery.isLoading}
                fallback={
                    <div class="py-6 space-y-4">
                        <SkeletonLoader type="text" count={3} />
                    </div>
                }
            >
                <Show
                    when={vehicleQuery.data}
                    fallback={
                        <div class="py-12 text-center text-muted">
                            <p>No se encontró el vehículo solicitado.</p>
                        </div>
                    }
                >
                    <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
                        <form
                            id="vehicle-edit-form"
                            onSubmit={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setHasAttemptedSubmit(true);
                                form.handleSubmit();
                            }}
                            class="space-y-4 py-2"
                        >
                            <div class="flex items-center gap-3 p-3 bg-surface/60 rounded-xl border border-border/50 text-xs text-muted">
                                <div class="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                    <TruckIcon class="size-4 text-primary" />
                                </div>
                                <div>
                                    <p class="font-medium text-text">Vehículo de Flota Propia</p>
                                    <p class="text-muted">Asociado a operaciones y traslados de la empresa</p>
                                </div>
                            </div>

                            <form.Field name="licensePlate">
                                {(field) => (
                                    <TextField.Root field={field()} disabled={updateMut.isPending}>
                                        <TextField.Label>Placa del Vehículo *</TextField.Label>
                                        <TextField.Input
                                            type="text"
                                            placeholder="ej. ABC-1234"
                                            class="uppercase font-mono font-medium tracking-wider"
                                        />
                                        <TextField.ErrorMessage />
                                    </TextField.Root>
                                )}
                            </form.Field>

                            <form.Field name="description">
                                {(field) => (
                                    <TextField.Root field={field()} disabled={updateMut.isPending}>
                                        <TextField.Label>Descripción / Modelo</TextField.Label>
                                        <TextField.Input
                                            type="text"
                                            placeholder="ej. Camión Hino blanco 5T"
                                        />
                                        <TextField.ErrorMessage />
                                    </TextField.Root>
                                )}
                            </form.Field>

                            <form.Field name="isActive">
                                {(field) => (
                                    <div class="flex items-center gap-2 pt-1">
                                        <Checkbox
                                            name={field().name}
                                            checked={field().state.value}
                                            onChange={(checked) => field().handleChange(checked)}
                                            disabled={updateMut.isPending}
                                        />
                                        <span class="text-sm font-medium text-text">Vehículo activo y disponible</span>
                                    </div>
                                )}
                            </form.Field>
                        </form>
                    </FormSubmissionContext.Provider>
                </Show>
            </Show>
        </Sheet>
    );
};

export default VehicleEditSheet;
