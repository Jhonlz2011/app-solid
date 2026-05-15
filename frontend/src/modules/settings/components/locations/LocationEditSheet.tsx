import { Component, Show, createSignal, createEffect, createMemo } from 'solid-js';
import { useParams } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { LocationFormSchema, type LocationFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useLocationsByWarehouse } from '../../data/warehouses.queries';
import { useUpdateLocation, useDeactivateLocation, useRestoreLocation } from '../../data/warehouses.mutations';
import type { LocationItem } from '../../data/warehouses.api';
import { FloppyDiskIcon } from '@shared/ui/icons';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/Select';
import { FieldLabel } from '@shared/ui/TextField';
import TextField from '@shared/ui/TextField';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';

interface LocationEditSheetProps { onClose?: () => void; onBack?: () => void; }

const LocationEditSheet: Component<LocationEditSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => { warehouseId?: string; locationId?: string };
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    const warehouseId = () => Number(params()?.warehouseId) || 0;
    const locationId = () => Number(params()?.locationId) || 0;

    const locationsQuery = useLocationsByWarehouse(() => warehouseId() || null);
    const updateMut = useUpdateLocation();
    const deactivateMut = useDeactivateLocation();
    const restoreMut = useRestoreLocation();

    const location = createMemo(() =>
        ((locationsQuery.data ?? []) as LocationItem[]).find(l => l.id === locationId()) ?? null
    );

    const form = createForm(() => ({
        defaultValues: { name: '', barcode: '', type: 'INTERNAL', parent_id: null } as LocationFormData,
        validatorAdapter: valibotValidator(),
        validators: { onChange: LocationFormSchema, onSubmit: LocationFormSchema },
        onSubmit: async ({ value }) => {
            if (locationId() === 0) return;
            updateMut.mutate(
                { id: locationId(), data: { name: value.name, barcode: value.barcode || null, type: value.type } },
                {
                    onSuccess: () => { toast.success('Ubicación actualizada'); navigateAway(); },
                    onError: (err: any) => toast.error(err.message || 'Error al actualizar'),
                },
            );
        },
    }));

    createEffect(() => {
        const l = location();
        if (l) {
            form.setFieldValue('name', l.name);
            form.setFieldValue('barcode', l.barcode ?? '');
            form.setFieldValue('type', l.type);
        }
    });

    const handleToggleActive = () => {
        const l = location();
        if (!l) return;
        const isActive = l.is_active ?? true;
        (isActive ? deactivateMut : restoreMut).mutate(l.id, {
            onSuccess: () => { toast.success(isActive ? 'Ubicación desactivada' : 'Ubicación restaurada'); navigateAway(); },
            onError: (err: any) => toast.error(err.message || 'Error'),
        });
    };

    const typeOptions = [
        { value: 'INTERNAL', label: '📦 Interna' },
        { value: 'VIEW', label: '📁 Vista' },
    ];

    const isSaving = () => updateMut.isPending || deactivateMut.isPending || restoreMut.isPending;

    return (
        <Sheet
            bindDismiss={bindDismiss} isOpen={true} onClose={navigateAway} onBack={props.onBack}
            title="Editar Ubicación" description="Modifica los datos de la ubicación" size="sm"
            footer={
                <>
                    <Show when={location()}>
                        <Button variant={(location()?.is_active ?? true) ? 'danger' : 'success'} onClick={handleToggleActive} loading={deactivateMut.isPending || restoreMut.isPending}>
                            {(location()?.is_active ?? true) ? 'Desactivar' : 'Restaurar'}
                        </Button>
                    </Show>
                    <div class="flex-1" />
                    <Button variant="outline" onClick={close} disabled={isSaving()}>Cancelar</Button>
                    <Button type="submit" form="location-edit-form" loading={updateMut.isPending} loadingText="Guardando..." icon={<FloppyDiskIcon />}>
                        Guardar
                    </Button>
                </>
            }
        >
            <Show when={locationId() > 0} fallback={<div class="py-12 text-center text-muted">ID inválido</div>}>
                <Show when={!locationsQuery.isLoading} fallback={<SkeletonLoader type="text" count={2} />}>
                    <Show when={location()} fallback={<div class="py-12 text-center text-muted">Ubicación no encontrada</div>}>
                        <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
                            <form id="location-edit-form" onSubmit={(e) => { e.preventDefault(); setHasAttemptedSubmit(true); form.handleSubmit(); }} class="space-y-5 py-2">
                                {/* Path badge */}
                                <div class="flex items-center gap-2 p-2 bg-surface/50 border border-border/50 rounded-lg">
                                    <span class="text-[10px] font-mono text-muted uppercase tracking-wide">Path:</span>
                                    <span class="text-xs font-mono text-primary">{location()?.path}</span>
                                </div>

                                <form.Field name="name">
                                    {(field) => (
                                        <TextField.Root field={field()}>
                                            <TextField.Label>Nombre *</TextField.Label>
                                            <TextField.Input type="text" />
                                            <TextField.ErrorMessage />
                                        </TextField.Root>
                                    )}
                                </form.Field>

                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <FieldLabel>Tipo</FieldLabel>
                                        <Select
                                            value={typeOptions.find(o => o.value === form.getFieldValue('type'))}
                                            onChange={(opt: any) => form.setFieldValue('type', opt?.value ?? 'INTERNAL')}
                                            options={typeOptions}
                                            optionValue="value"
                                            optionTextValue="label"
                                            placeholder="Seleccionar..."
                                            itemComponent={(itemProps: any) => (
                                                <SelectItem item={itemProps.item}>{itemProps.item.rawValue?.label}</SelectItem>
                                            )}
                                        >
                                            <SelectTrigger>
                                                <SelectValue<any>>
                                                    {(state) => state.selectedOption()?.label ?? 'Seleccionar...'}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent />
                                        </Select>
                                    </div>
                                    <form.Field name="barcode">
                                        {(field) => (
                                            <TextField.Root field={field()}>
                                                <TextField.Label>Código de Barras</TextField.Label>
                                                <TextField.Input type="text" maxLength={50} />
                                                <TextField.ErrorMessage />
                                            </TextField.Root>
                                        )}
                                    </form.Field>
                                </div>
                            </form>
                        </FormSubmissionContext.Provider>
                    </Show>
                </Show>
            </Show>
        </Sheet>
    );
};

export default LocationEditSheet;
