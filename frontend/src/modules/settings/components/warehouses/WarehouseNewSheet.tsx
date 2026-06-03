import { Component, createSignal } from 'solid-js';
import { isNetworkError } from '@shared/utils/api-errors';
import { isOffline, showOfflineSavedToast } from '@shared/utils/offline-submit';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { WarehouseFormSchema, type WarehouseFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useCreateWarehouse } from '../../data/warehouses.mutations';
import { FloppyDiskIcon } from '@shared/ui/icons';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import TextField from '@shared/ui/TextField';
import Checkbox from '@shared/ui/Checkbox';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';

interface WarehouseNewSheetProps { onClose?: () => void; }

const WarehouseNewSheet: Component<WarehouseNewSheetProps> = (props) => {
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const createMut = useCreateWarehouse();
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    const form = createForm(() => ({
        defaultValues: { code: '', name: '', address: '', is_mobile: false } as WarehouseFormData,
        validatorAdapter: valibotValidator(),
        validators: { onChange: WarehouseFormSchema, onSubmit: WarehouseFormSchema },
        onSubmit: async ({ value }) => {
            if (isOffline()) {
                createMut.mutate({ code: value.code.toUpperCase(), name: value.name, address: value.address || undefined, is_mobile: value.is_mobile });
                showOfflineSavedToast();
                navigateAway();
                return;
            }
            createMut.mutate(
                { code: value.code.toUpperCase(), name: value.name, address: value.address || undefined, is_mobile: value.is_mobile },
                {
                    onSuccess: () => { toast.success('Bodega creada correctamente'); navigateAway(); },
                    onError: (err: any) => {
                        if (isNetworkError(err)) { toast.info('Guardado localmente', { description: 'Se sincronizará automáticamente al recuperar la conexión.', icon: '☁️' }); navigateAway(); return; }
                        toast.error(err.message || 'Error al crear bodega');
                    },
                },
            );
        },
    }));

    return (
        <Sheet
            bindDismiss={bindDismiss} isOpen={true} onClose={navigateAway}
            title="Nueva Bodega" description="Registra una nueva bodega o almacén" size="sm"
            footer={
                <>
                    <Button variant="outline" onClick={close} disabled={createMut.isPending}>Cancelar</Button>
                    <Button type="submit" form="warehouse-form" loading={createMut.isPending} loadingText="Creando..." icon={<FloppyDiskIcon />}>
                        Crear Bodega
                    </Button>
                </>
            }
        >
            <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
                <form id="warehouse-form" onSubmit={(e) => { e.preventDefault(); setHasAttemptedSubmit(true); form.handleSubmit(); }} class="space-y-5 py-2">
                    <div class="grid grid-cols-[100px_1fr] gap-4">
                        <form.Field name="code">
                            {(field) => (
                                <TextField.Root field={field()}>
                                    <TextField.Label>Código *</TextField.Label>
                                    <TextField.Input type="text" placeholder="BOD-01" class="uppercase font-mono" maxLength={20} />
                                    <TextField.ErrorMessage />
                                </TextField.Root>
                            )}
                        </form.Field>
                        <form.Field name="name">
                            {(field) => (
                                <TextField.Root field={field()}>
                                    <TextField.Label>Nombre *</TextField.Label>
                                    <TextField.Input type="text" placeholder="Bodega Principal, Almacén Norte..." />
                                    <TextField.ErrorMessage />
                                </TextField.Root>
                            )}
                        </form.Field>
                    </div>
                    <form.Field name="address">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Dirección</TextField.Label>
                                <TextField.Input type="text" placeholder="Av. Principal y Calle 10..." />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>
                    <form.Field name="is_mobile">
                        {(field) => (
                            <Checkbox
                                checked={field().state.value}
                                onChange={(checked: boolean) => field().handleChange(checked)}
                                label="Bodega Móvil"
                                description="Marca si esta bodega es un vehículo o unidad de transporte."
                            />
                        )}
                    </form.Field>
                </form>
            </FormSubmissionContext.Provider>
        </Sheet>
    );
};

export default WarehouseNewSheet;
