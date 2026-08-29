import { Component, createSignal } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { WarehouseFormSchema, type WarehouseFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { executeFormMutation, handleFormApiErrors } from '@shared/utils/form.utils';
import { useCreateWarehouse } from '../../data/warehouses.mutations';
import { FloppyDiskIcon } from '@icons/FloppyDiskIcon';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import TextField from '@form/TextField';
import Checkbox from '@form/Checkbox';
import Sheet from '@overlay/Sheet';
import Button from '@form/Button';

interface WarehouseNewSheetProps { onClose?: () => void; }

const WarehouseNewSheet: Component<WarehouseNewSheetProps> = (props) => {
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const createMut = useCreateWarehouse();
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    const form = createForm(() => ({
        defaultValues: { code: '', name: '', address: '', is_mobile: false } as WarehouseFormData,
        validators: { onChange: WarehouseFormSchema, onSubmit: WarehouseFormSchema },
        onSubmit: async ({ value }) => {
            try {
                await executeFormMutation({
                    mutation: createMut,
                    variables: {
                        code: value.code.toUpperCase(),
                        name: value.name,
                        address: value.address || undefined,
                        is_mobile: value.is_mobile,
                    },
                    successMessage: 'Bodega creada correctamente',
                    onComplete: navigateAway,
                });
            } catch (err) {
                handleFormApiErrors(form, err, 'Error al crear la bodega', 'warehouse-new-form');
            }
        },
    }));

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Nueva Bodega"
            description="Registra una nueva bodega o almacén"
            size="sm"
            footer={
                <>
                    <Button variant="outline" onClick={close} disabled={createMut.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="warehouse-new-form"
                        loading={createMut.isPending}
                        loadingText="Creando..."
                        icon={<FloppyDiskIcon />}
                    >
                        Crear Bodega
                    </Button>
                </>
            }
        >
            <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
                <form
                    id="warehouse-new-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setHasAttemptedSubmit(true);
                        form.handleSubmit();
                    }}
                    class="space-y-5 py-2"
                >
                    <form.Field name="code">
                        {(field) => (
                            <TextField.Root field={field()} disabled={createMut.isPending}>
                                <TextField.Label>Código *</TextField.Label>
                                <TextField.Input type="text" placeholder="BOD-01" class="uppercase" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>

                    <form.Field name="name">
                        {(field) => (
                            <TextField.Root field={field()} disabled={createMut.isPending}>
                                <TextField.Label>Nombre *</TextField.Label>
                                <TextField.Input type="text" placeholder="Bodega Principal" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>

                    <form.Field name="address">
                        {(field) => (
                            <TextField.Root field={field()} disabled={createMut.isPending}>
                                <TextField.Label>Dirección</TextField.Label>
                                <TextField.Input type="text" placeholder="Av. Principal 123" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>

                    <form.Field name="is_mobile">
                        {(field) => (
                            <div class="flex items-center gap-2 pt-2">
                                <Checkbox
                                    name={field().name}
                                    checked={field().state.value}
                                    onChange={(checked) => field().handleChange(checked)}
                                    disabled={createMut.isPending}
                                />
                                <span class="text-sm font-medium text-text">Es bodega móvil (vehículo)</span>
                            </div>
                        )}
                    </form.Field>
                </form>
            </FormSubmissionContext.Provider>
        </Sheet>
    );
};

export default WarehouseNewSheet;
