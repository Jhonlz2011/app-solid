import { Component, Show, createSignal, createEffect } from 'solid-js';
import { useParams } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { WarehouseFormSchema, type WarehouseFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { executeFormMutation, handleFormApiErrors } from '@shared/utils/form.utils';
import { useWarehousesList } from '../../data/warehouses.queries';
import { useUpdateWarehouse, useDeactivateWarehouse, useRestoreWarehouse } from '../../data/warehouses.mutations';
import type { WarehouseItem } from '../../data/warehouses.api';
import { FloppyDiskIcon } from '@icons/FloppyDiskIcon';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { SkeletonLoader } from '@display/SkeletonLoader';
import TextField from '@form/TextField';
import Checkbox from '@form/Checkbox';
import Sheet from '@overlay/Sheet';
import Button from '@form/Button';

interface WarehouseEditSheetProps { onClose?: () => void; }

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
        validators: { onChange: WarehouseFormSchema, onSubmit: WarehouseFormSchema },
        onSubmit: async ({ value }) => {
            if (warehouseId() === 0) return;
            try {
                await executeFormMutation({
                    mutation: updateMut,
                    variables: {
                        id: warehouseId(),
                        data: {
                            code: value.code.toUpperCase(),
                            name: value.name,
                            address: value.address || null,
                            is_mobile: value.is_mobile,
                        },
                    },
                    successMessage: 'Bodega actualizada',
                    onComplete: navigateAway,
                });
            } catch (err) {
                handleFormApiErrors(form, err, 'Error al actualizar la bodega', 'warehouse-edit-form');
            }
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
        const mut = isActive ? deactivateMut : restoreMut;

        executeFormMutation({
            mutation: mut,
            variables: w.id,
            successMessage: isActive ? 'Bodega desactivada' : 'Bodega restaurada',
            onComplete: navigateAway,
        });
    };

    const isSaving = () => updateMut.isPending || deactivateMut.isPending || restoreMut.isPending;

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Editar Bodega"
            description="Modifica los datos de la bodega"
            size="sm"
            footer={
                <>
                    <Show when={warehouse()}>
                        <Button
                            variant={(warehouse()?.is_active ?? true) ? 'danger' : 'success'}
                            onClick={handleToggleActive}
                            loading={deactivateMut.isPending || restoreMut.isPending}
                        >
                            {(warehouse()?.is_active ?? true) ? 'Desactivar' : 'Restaurar'}
                        </Button>
                    </Show>
                    <div class="flex-1" />
                    <Button variant="outline" onClick={close} disabled={isSaving()}>Cancelar</Button>
                    <Button
                        type="submit"
                        form="warehouse-edit-form"
                        loading={updateMut.isPending}
                        loadingText="Guardando..."
                        icon={<FloppyDiskIcon />}
                    >
                        Guardar
                    </Button>
                </>
            }
        >
            <Show when={warehouseId() > 0} fallback={<div class="py-12 text-center text-muted">ID de bodega inválido</div>}>
                <Show when={!warehousesQuery.isLoading} fallback={<SkeletonLoader type="text" count={3} />}>
                    <Show when={warehouse()} fallback={<div class="py-12 text-center text-muted">Bodega no encontrada</div>}>
                        <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
                            <form
                                id="warehouse-edit-form"
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
                                        <TextField.Root field={field()} disabled={isSaving()}>
                                            <TextField.Label>Código *</TextField.Label>
                                            <TextField.Input type="text" class="uppercase" />
                                            <TextField.ErrorMessage />
                                        </TextField.Root>
                                    )}
                                </form.Field>

                                <form.Field name="name">
                                    {(field) => (
                                        <TextField.Root field={field()} disabled={isSaving()}>
                                            <TextField.Label>Nombre *</TextField.Label>
                                            <TextField.Input type="text" />
                                            <TextField.ErrorMessage />
                                        </TextField.Root>
                                    )}
                                </form.Field>

                                <form.Field name="address">
                                    {(field) => (
                                        <TextField.Root field={field()} disabled={isSaving()}>
                                            <TextField.Label>Dirección</TextField.Label>
                                            <TextField.Input type="text" />
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
                                                disabled={isSaving()}
                                            />
                                            <span class="text-sm font-medium text-text">Es bodega móvil (vehículo)</span>
                                        </div>
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
