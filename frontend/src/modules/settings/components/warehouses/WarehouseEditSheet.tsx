import { Component, Show, createSignal, createEffect } from 'solid-js';
import { isNetworkError } from '@shared/utils/api-errors';
import { useParams } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { WarehouseFormSchema, type WarehouseFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useWarehousesList } from '../../data/warehouses.queries';
import { useUpdateWarehouse, useDeactivateWarehouse, useRestoreWarehouse } from '../../data/warehouses.mutations';
import type { WarehouseItem } from '../../data/warehouses.api';
import { FloppyDiskIcon } from '@shared/ui/icons';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import TextField from '@shared/ui/TextField';
import Checkbox from '@shared/ui/Checkbox';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';

interface WarehouseEditSheetProps { onClose?: () => void; onBack?: () => void; }

const WarehouseEditSheet: Component<WarehouseEditSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => { warehouseId?: string };
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    const warehouseId = () => { const p = Number(params()?.warehouseId); return Number.isFinite(p) ? p : 0; };

    const warehousesQuery = useWarehousesList();
    const updateMut = useUpdateWarehouse();
    const deactivateMut = useDeactivateWarehouse();
    const restoreMut = useRestoreWarehouse();

    const warehouse = () => (warehousesQuery.data ?? []).find((w: WarehouseItem) => w.id === warehouseId()) ?? null;

    const form = createForm(() => ({
        defaultValues: { code: '', name: '', address: '', is_mobile: false } as WarehouseFormData,
        validatorAdapter: valibotValidator(),
        validators: { onChange: WarehouseFormSchema, onSubmit: WarehouseFormSchema },
        onSubmit: async ({ value }) => {
            if (warehouseId() === 0) return;
            updateMut.mutate(
                { id: warehouseId(), data: { code: value.code.toUpperCase(), name: value.name, address: value.address || null, is_mobile: value.is_mobile } },
                {
                    onSuccess: () => { toast.success('Bodega actualizada'); navigateAway(); },
                    onError: (err: any) => {
                        if (isNetworkError(err)) { toast.info('Guardado localmente', { description: 'Se sincronizará automáticamente al recuperar la conexión.', icon: '☁️' }); navigateAway(); return; }
                        toast.error(err.message || 'Error al actualizar');
                    },
                },
            );
        },
    }));

    createEffect(() => {
        const w = warehouse();
        if (w) {
            form.setFieldValue('code', w.code);
            form.setFieldValue('name', w.name);
            form.setFieldValue('address', w.address ?? '');
            form.setFieldValue('is_mobile', w.is_mobile ?? false);
        }
    });

    const handleToggleActive = () => {
        const w = warehouse();
        if (!w) return;
        const isActive = w.is_active ?? true;
        (isActive ? deactivateMut : restoreMut).mutate(w.id, {
            onSuccess: () => { toast.success(isActive ? 'Bodega desactivada' : 'Bodega restaurada'); navigateAway(); },
            onError: (err: any) => {
                if (isNetworkError(err)) { toast.info('Guardado localmente', { description: 'Se sincronizará automáticamente al recuperar la conexión.', icon: '☁️' }); navigateAway(); return; }
                toast.error(err.message || 'Error');
            },
        });
    };

    const isSaving = () => updateMut.isPending || deactivateMut.isPending || restoreMut.isPending;

    return (
        <Sheet
            bindDismiss={bindDismiss} isOpen={true} onClose={navigateAway} onBack={props.onBack}
            title="Editar Bodega" description="Modifica los datos de la bodega" size="sm"
            footer={
                <>
                    <Show when={warehouse()}>
                        <Button variant={(warehouse()?.is_active ?? true) ? 'danger' : 'success'} onClick={handleToggleActive} loading={deactivateMut.isPending || restoreMut.isPending}>
                            {(warehouse()?.is_active ?? true) ? 'Desactivar' : 'Restaurar'}
                        </Button>
                    </Show>
                    <div class="flex-1" />
                    <Button variant="outline" onClick={close} disabled={isSaving()}>Cancelar</Button>
                    <Button type="submit" form="warehouse-edit-form" loading={updateMut.isPending} loadingText="Guardando..." icon={<FloppyDiskIcon />}>
                        Guardar
                    </Button>
                </>
            }
        >
            <Show when={warehouseId() > 0} fallback={<div class="py-12 text-center text-muted">ID de bodega inválido</div>}>
                <Show when={!warehousesQuery.isLoading} fallback={<SkeletonLoader type="text" count={3} />}>
                    <Show when={warehouse()} fallback={<div class="py-12 text-center text-muted">Bodega no encontrada</div>}>
                        <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
                            <form id="warehouse-edit-form" onSubmit={(e) => { e.preventDefault(); setHasAttemptedSubmit(true); form.handleSubmit(); }} class="space-y-5 py-2">
                                <div class="grid grid-cols-[100px_1fr] gap-4">
                                    <form.Field name="code">
                                        {(field) => (
                                            <TextField.Root field={field()}>
                                                <TextField.Label>Código *</TextField.Label>
                                                <TextField.Input type="text" class="uppercase font-mono" maxLength={20} />
                                                <TextField.ErrorMessage />
                                            </TextField.Root>
                                        )}
                                    </form.Field>
                                    <form.Field name="name">
                                        {(field) => (
                                            <TextField.Root field={field()}>
                                                <TextField.Label>Nombre *</TextField.Label>
                                                <TextField.Input type="text" />
                                                <TextField.ErrorMessage />
                                            </TextField.Root>
                                        )}
                                    </form.Field>
                                </div>
                                <form.Field name="address">
                                    {(field) => (
                                        <TextField.Root field={field()}>
                                            <TextField.Label>Dirección</TextField.Label>
                                            <TextField.Input type="text" />
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
                                            description="Vehículo o unidad de transporte."
                                        />
                                    )}
                                </form.Field>
                            </form>
                        </FormSubmissionContext.Provider>
                    </Show>
                </Show>
            </Show>
        </Sheet>
    );
};

export default WarehouseEditSheet;
