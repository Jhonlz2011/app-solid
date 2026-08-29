import { Component, createSignal } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { CarrierVehicleFormSchema, type CarrierVehicleFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { executeFormMutation, handleFormApiErrors } from '@shared/utils/form.utils';
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
        validators: {
            onChange: CarrierVehicleFormSchema,
            onSubmit: CarrierVehicleFormSchema,
        },
        onSubmit: async ({ value }) => {
            try {
                await executeFormMutation({
                    mutation: createMut,
                    variables: {
                        licensePlate: value.licensePlate.toUpperCase().trim(),
                        description: value.description || undefined,
                        isActive: value.isActive ?? true,
                    },
                    successMessage: 'Vehículo registrado correctamente',
                    onComplete: navigateAway,
                });
            } catch (err) {
                handleFormApiErrors(form, err, 'Error al registrar el vehículo', 'vehicle-new-form');
            }
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
                        form="vehicle-new-form"
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
                    id="vehicle-new-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setHasAttemptedSubmit(true);
                        form.handleSubmit();
                    }}
                    class="space-y-4 py-2"
                >
                    {/* Header icon callout */}
                    <div class="flex items-center gap-3 p-3 bg-surface/60 rounded-xl border border-border/50 text-xs text-muted">
                        <div class="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <TruckIcon class="size-4 text-primary" />
                        </div>
                        <span>Los vehículos registrados estarán disponibles para asociar a guías de remisión y despachos internos.</span>
                    </div>

                    <form.Field name="licensePlate">
                        {(field) => (
                            <TextField.Root field={field()} disabled={createMut.isPending}>
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
                            <TextField.Root field={field()} disabled={createMut.isPending}>
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
                                    disabled={createMut.isPending}
                                />
                                <span class="text-sm font-medium text-text">Vehículo activo y disponible</span>
                            </div>
                        )}
                    </form.Field>
                </form>
            </FormSubmissionContext.Provider>
        </Sheet>
    );
};

export default VehicleNewSheet;
