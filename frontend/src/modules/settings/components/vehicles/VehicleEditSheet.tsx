import { Component, createSignal, Show, createEffect } from 'solid-js';
import { useParams } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { CarrierVehicleFormSchema, type CarrierVehicleFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
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
        validatorAdapter: valibotValidator(),
        validators: {
            onChange: CarrierVehicleFormSchema,
            onSubmit: CarrierVehicleFormSchema,
        },
        onSubmit: async ({ value }) => {
            if (vehicleId() <= 0) return;
            updateMut.mutate(
                {
                    id: vehicleId(),
                    data: {
                        licensePlate: value.licensePlate.toUpperCase().trim(),
                        description: value.description || undefined,
                        isActive: value.isActive ?? true,
                    },
                },
                {
                    onSuccess: () => navigateAway(),
                }
            );
        },
    }));

    createEffect(() => {
        if (vehicleQuery.data) {
            form.reset({
                licensePlate: vehicleQuery.data.license_plate,
                description: vehicleQuery.data.description ?? '',
                isActive: vehicleQuery.data.is_active,
            });
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
                    <div class="space-y-4 p-4">
                        <SkeletonLoader type="text" count={3} />
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
                        class="space-y-5 p-1"
                    >
                        <form.Field name="licensePlate">
                            {(field) => (
                                <TextField.Root field={field()}>
                                    <TextField.Label>Placa del Vehículo</TextField.Label>
                                    <TextField.Input
                                        type="text"
                                        placeholder="Ej: PBX-1234"
                                        class="uppercase font-mono font-semibold"
                                        onInput={(e) => {
                                            const val = e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                                            e.currentTarget.value = val;
                                            field().handleChange(val);
                                        }}
                                    />
                                    <TextField.Description>Placa vehicular según matrícula o RTV.</TextField.Description>
                                    <TextField.ErrorMessage />
                                </TextField.Root>
                            )}
                        </form.Field>

                        <form.Field name="description">
                            {(field) => (
                                <TextField.Root field={field()}>
                                    <TextField.Label>Descripción / Modelo</TextField.Label>
                                    <TextField.Input
                                        type="text"
                                        placeholder="Ej: Camión Hino 500 Blanco (Furgón)"
                                        onInput={(e) => field().handleChange(e.currentTarget.value)}
                                    />
                                    <TextField.Description>Marca, modelo o color para identificar el vehículo fácilmente.</TextField.Description>
                                    <TextField.ErrorMessage />
                                </TextField.Root>
                            )}
                        </form.Field>

                        <form.Field name="isActive">
                            {(field) => (
                                <Checkbox field={field()} class="font-medium pt-2">
                                    Vehículo Activo (disponible para despachos)
                                </Checkbox>
                            )}
                        </form.Field>
                    </form>
                </FormSubmissionContext.Provider>
            </Show>
        </Sheet>
    );
};

export default VehicleEditSheet;
