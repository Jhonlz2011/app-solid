import { Component, createSignal } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { CarrierVehicleFormSchema, type CarrierVehicleFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { useCreateVehicle } from '../../data/vehicles.mutations';
import { FloppyDiskIcon } from '@icons/FloppyDiskIcon';
import { TruckIcon } from '@icons/TruckIcon';

import { FormSubmissionContext } from '@shared/ui/form/form.types';
import TextField from '@form/TextField';
import Checkbox from '@form/Checkbox';
import Sheet from '@overlay/Sheet';
import Button from '@form/Button';

interface VehicleNewSheetProps {
    onClose?: () => void;
}

const VehicleNewSheet: Component<VehicleNewSheetProps> = (props) => {
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const createMut = useCreateVehicle();
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    const form = createForm(() => ({
        defaultValues: {
            licensePlate: '',
            description: '',
            isActive: true,
        } as CarrierVehicleFormData,
        validatorAdapter: valibotValidator(),
        validators: {
            onChange: CarrierVehicleFormSchema,
            onSubmit: CarrierVehicleFormSchema,
        },
        onSubmit: async ({ value }) => {
            createMut.mutate(
                {
                    licensePlate: value.licensePlate.toUpperCase().trim(),
                    description: value.description || undefined,
                    isActive: value.isActive ?? true,
                },
                {
                    onSuccess: () => navigateAway(),
                }
            );
        },
    }));

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Nuevo Vehículo"
            description="Registra un vehículo en la flota propia de la empresa"
            size="sm"
            footer={
                <>
                    <Button variant="outline" onClick={close} disabled={createMut.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="vehicle-form"
                        loading={createMut.isPending}
                        loadingText="Guardando..."
                        icon={<FloppyDiskIcon />}
                    >
                        Guardar Vehículo
                    </Button>
                </>
            }
        >
            <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
                <form
                    id="vehicle-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setHasAttemptedSubmit(true);
                        form.handleSubmit();
                    }}
                    class="space-y-5 p-1"
                >
                    <div class="flex items-center gap-3 p-3 bg-primary/5 border border-primary/15 rounded-xl text-xs text-muted leading-relaxed">
                        <TruckIcon class="size-5 text-primary shrink-0" />
                        <span>Este vehículo estará disponible para despachos y Guías de Remisión de la empresa.</span>
                    </div>

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
        </Sheet>
    );
};

export default VehicleNewSheet;
