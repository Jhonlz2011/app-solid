import { Component, createSignal, createMemo, For } from 'solid-js';
import { useParams } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { LocationFormSchema, type LocationFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useCreateLocation } from '../../data/warehouses.mutations';
import { useLocationsByWarehouse } from '../../data/warehouses.queries';
import type { LocationItem } from '../../data/warehouses.api';
import { FloppyDiskIcon } from '@shared/ui/icons';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/Select';
import { FieldLabel } from '@shared/ui/TextField';
import TextField from '@shared/ui/TextField';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';

interface LocationNewSheetProps { onClose?: () => void; }

const LocationNewSheet: Component<LocationNewSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => { warehouseId?: string };
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const createMut = useCreateLocation();
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    const warehouseId = () => Number(params()?.warehouseId) || 0;
    const locationsQuery = useLocationsByWarehouse(() => warehouseId() || null);

    const parentOptions = createMemo(() =>
        ((locationsQuery.data ?? []) as LocationItem[])
            .filter(l => (l.is_active ?? true))
            .map(l => ({ id: l.id, name: l.name, depth: l.depth }))
    );

    const form = createForm(() => ({
        defaultValues: { name: '', parent_id: null, barcode: '', type: 'INTERNAL' } as LocationFormData,
        validatorAdapter: valibotValidator(),
        validators: { onChange: LocationFormSchema, onSubmit: LocationFormSchema },
        onSubmit: async ({ value }) => {
            if (!warehouseId()) return;
            createMut.mutate(
                { warehouse_id: warehouseId(), name: value.name, parent_id: value.parent_id, barcode: value.barcode || null, type: value.type },
                {
                    onSuccess: () => { toast.success('Ubicación creada correctamente'); navigateAway(); },
                    onError: (err: any) => toast.error(err.message || 'Error al crear ubicación'),
                },
            );
        },
    }));

    const typeOptions = [
        { value: 'INTERNAL', label: '📦 Interna (almacena stock)' },
        { value: 'VIEW', label: '📁 Vista (agrupador)' },
    ];

    return (
        <Sheet
            bindDismiss={bindDismiss} isOpen={true} onClose={navigateAway}
            title="Nueva Ubicación" description="Crea una zona, pasillo, estante o ubicación dentro de la bodega" size="sm"
            footer={
                <>
                    <Button variant="outline" onClick={close} disabled={createMut.isPending}>Cancelar</Button>
                    <Button type="submit" form="location-form" loading={createMut.isPending} loadingText="Creando..." icon={<FloppyDiskIcon />}>
                        Crear Ubicación
                    </Button>
                </>
            }
        >
            <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
                <form id="location-form" onSubmit={(e) => { e.preventDefault(); setHasAttemptedSubmit(true); form.handleSubmit(); }} class="space-y-5 py-2">
                    <form.Field name="name">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Nombre *</TextField.Label>
                                <TextField.Input type="text" placeholder="Zona A, Pasillo 1, Estante 3..." />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>

                    <div>
                        <FieldLabel>Ubicación Padre</FieldLabel>
                        <Select
                            value={parentOptions().find(o => o.id === form.getFieldValue('parent_id'))}
                            onChange={(opt: any) => form.setFieldValue('parent_id', opt?.id ?? null)}
                            options={parentOptions()}
                            optionValue="id"
                            optionTextValue="name"
                            placeholder="— Raíz (sin padre) —"
                            itemComponent={(itemProps: any) => (
                                <SelectItem item={itemProps.item}>
                                    <span style={{ "padding-left": `${(itemProps.item.rawValue?.depth ?? 0) * 12}px` }}>
                                        {itemProps.item.rawValue?.depth > 0 ? '└ ' : ''}{itemProps.item.rawValue?.name}
                                    </span>
                                </SelectItem>
                            )}
                        >
                            <SelectTrigger>
                                <SelectValue<any>>
                                    {(state) => state.selectedOption()?.name ?? '— Raíz (sin padre) —'}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent />
                        </Select>
                        <p class="text-[11px] text-muted mt-1.5 ml-1">
                            Selecciona una ubicación padre para crear una jerarquía (ej. Zona → Pasillo → Estante).
                        </p>
                    </div>

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
                                    <TextField.Input type="text" placeholder="LOC-A01-P1-E3" maxLength={50} />
                                    <TextField.ErrorMessage />
                                </TextField.Root>
                            )}
                        </form.Field>
                    </div>
                </form>
            </FormSubmissionContext.Provider>
        </Sheet>
    );
};

export default LocationNewSheet;
