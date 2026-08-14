import { Component, Index, Show } from 'solid-js';
import TextField from '@shared/ui/TextField';
import Checkbox from '@shared/ui/Checkbox';
import { TrashIcon, PlusIcon, UserIcon, TruckIcon } from '@shared/ui/icons';
import Button from '@shared/ui/Button';
import type { EntityFormApi } from '../entity-form.types';

export interface EntityCarrierTabProps {
    form: EntityFormApi;
}

export const EntityCarrierTab: Component<EntityCarrierTabProps> = (props) => {
    const handleImportTitularAsDriver = () => {
        const values = props.form.state.values;
        const currentDrivers = values.drivers || [];
        
        // Evitar duplicar si ya existe
        const alreadyExists = currentDrivers.some(d => d.identificationNumber === values.taxId);
        if (alreadyExists) return;

        props.form.setFieldValue('drivers', [
            ...currentDrivers,
            {
                identificationNumber: values.taxId || '',
                fullName: values.businessName || '',
                phone: values.phone || '',
                isActive: true,
            }
        ]);
    };

    const isEmployee = () => props.form.state.values.isEmployee;

    return (
        <div class="space-y-6">
            <Show when={isEmployee()}>
                <div class="flex items-start gap-3 p-3.5 bg-primary/5 border border-primary/15 rounded-2xl text-xs text-muted leading-relaxed">
                    <TruckIcon class="size-5 text-primary shrink-0 mt-0.5" />
                    <div>
                        <span class="font-semibold text-text">Flota Propia de la Empresa:</span> Los empleados pueden conducir cualquiera de los vehículos registrados centralizadamente en <strong class="text-text">Configuración &gt; Vehículos</strong> al emitir Guías de Remisión. No es necesario duplicar placas aquí a menos que el empleado disponga de un vehículo exclusivo o propio.
                    </div>
                </div>
            </Show>
            {/* ================================================================= */}
            {/* 1. SECCIÓN DE VEHÍCULOS / FLOTA                                   */}
            {/* ================================================================= */}
            <props.form.Field name="vehicles" mode="array">
                {(field) => (
                    <div class="bg-surface/30 p-4 rounded-2xl border border-border/40">
                        <div class="flex items-center justify-between flex-wrap gap-3 mb-4 pb-3 border-b border-border/50">
                            <div class="flex items-center gap-2">
                                <div class="w-1.5 h-4 bg-primary rounded-full"></div>
                                <h3 class="font-semibold text-text uppercase tracking-wide text-sm flex items-center gap-2">
                                    <TruckIcon class="size-4 text-primary" />
                                    Vehículos de Transporte / Flota
                                </h3>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                class="gap-1.5"
                                type="button"
                                onClick={() => field().pushValue({ licensePlate: '', description: '', isActive: true })}
                            >
                                <PlusIcon class="size-4" /> Añadir Vehículo
                            </Button>
                        </div>

                        <div class="space-y-4">
                            <Show when={field().state.value.length === 0}>
                                <div class="text-center py-6 text-muted bg-surface/50 rounded-lg border border-dashed border-border/60">
                                    No hay vehículos registrados para este transportista.<br />
                                    Haz clic en "Añadir Vehículo" para registrar placas para guías de remisión.
                                </div>
                            </Show>

                            <Index each={field().state.value}>
                                {(_, i) => (
                                    <div class="relative grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-card rounded-xl border border-border/50 shadow-sm animate-in slide-in-from-top-2 items-start">
                                        <div class="col-span-12 md:col-span-4">
                                            <props.form.Field name={`vehicles[${i}].licensePlate`}>
                                                {(subField) => (
                                                    <TextField.Root field={subField()}>
                                                        <TextField.Label>Placa del Vehículo</TextField.Label>
                                                        <TextField.Input
                                                            type="text"
                                                            placeholder="Ej: PBX-1234"
                                                            class="uppercase font-mono font-semibold"
                                                            onInput={(e) => {
                                                                const val = e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                                                                e.currentTarget.value = val;
                                                                subField().handleChange(val);
                                                            }}
                                                        />
                                                        <TextField.ErrorMessage />
                                                    </TextField.Root>
                                                )}
                                            </props.form.Field>
                                        </div>

                                        <div class="col-span-12 md:col-span-5">
                                            <props.form.Field name={`vehicles[${i}].description`}>
                                                {(subField) => (
                                                    <TextField.Root field={subField()}>
                                                        <TextField.Label>Descripción / Modelo</TextField.Label>
                                                        <TextField.Input type="text" placeholder="Ej: Camión Hino 500 Blanco" />
                                                        <TextField.ErrorMessage />
                                                    </TextField.Root>
                                                )}
                                            </props.form.Field>
                                        </div>

                                        <div class="col-span-6 md:col-span-2 pt-6">
                                            <props.form.Field name={`vehicles[${i}].isActive`}>
                                                {(subField) => (
                                                    <Checkbox field={subField()} class="font-medium">
                                                        Activo
                                                    </Checkbox>
                                                )}
                                            </props.form.Field>
                                        </div>

                                        <div class="col-span-6 md:col-span-1 flex items-center justify-end md:justify-center pt-5">
                                            <button
                                                type="button"
                                                onClick={() => field().removeValue(i)}
                                                class="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                                                title="Eliminar Vehículo"
                                            >
                                                <TrashIcon class="size-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </Index>
                        </div>
                    </div>
                )}
            </props.form.Field>

            {/* ================================================================= */}
            {/* 2. SECCIÓN DE CONDUCTORES / CHOFERES                              */}
            {/* ================================================================= */}
            <props.form.Field name="drivers" mode="array">
                {(field) => (
                    <div class="bg-surface/30 p-4 rounded-2xl border border-border/40">
                        <div class="flex items-center justify-between flex-wrap gap-3 mb-4 pb-3 border-b border-border/50">
                            <div class="flex items-center gap-2">
                                <div class="w-1.5 h-4 bg-primary rounded-full"></div>
                                <h3 class="font-semibold text-text uppercase tracking-wide text-sm flex items-center gap-2">
                                    <UserIcon class="size-4 text-primary" />
                                    Conductores Asignados (Choferes)
                                </h3>
                            </div>
                            <div class="flex items-center gap-2">
                                <Show when={props.form.state.values.taxId && props.form.state.values.businessName}>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        class="gap-1.5 text-xs text-muted hover:text-text"
                                        type="button"
                                        onClick={handleImportTitularAsDriver}
                                        title="Copiar los datos de la pestaña General como conductor"
                                    >
                                        <UserIcon class="size-3.5" /> Usar Titular como Chofer
                                    </Button>
                                </Show>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    class="gap-1.5"
                                    type="button"
                                    onClick={() => field().pushValue({ identificationNumber: '', fullName: '', phone: '', isActive: true })}
                                >
                                    <PlusIcon class="size-4" /> Añadir Conductor
                                </Button>
                            </div>
                        </div>

                        <div class="space-y-4">
                            <Show when={field().state.value.length === 0}>
                                <div class="text-center py-6 text-muted bg-surface/50 rounded-lg border border-dashed border-border/60">
                                    No hay conductores registrados para este transportista.<br />
                                    Haz clic en "Añadir Conductor" o "Usar Titular como Chofer".
                                </div>
                            </Show>

                            <Index each={field().state.value}>
                                {(_, i) => (
                                    <div class="relative grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-card rounded-xl border border-border/50 shadow-sm animate-in slide-in-from-top-2 items-start">
                                        <div class="col-span-12 md:col-span-3">
                                            <props.form.Field name={`drivers[${i}].identificationNumber`}>
                                                {(subField) => (
                                                    <TextField.Root field={subField()}>
                                                        <TextField.Label>Identificación (Cédula/RUC)</TextField.Label>
                                                        <TextField.Input
                                                            type="text"
                                                            placeholder="Ej: 1712345678"
                                                            maxLength={13}
                                                            onInput={(e) => {
                                                                const numeric = e.currentTarget.value.replace(/\D/g, '');
                                                                e.currentTarget.value = numeric;
                                                                subField().handleChange(numeric);
                                                            }}
                                                        />
                                                        <TextField.ErrorMessage />
                                                    </TextField.Root>
                                                )}
                                            </props.form.Field>
                                        </div>

                                        <div class="col-span-12 md:col-span-4">
                                            <props.form.Field name={`drivers[${i}].fullName`}>
                                                {(subField) => (
                                                    <TextField.Root field={subField()}>
                                                        <TextField.Label>Nombre Completo del Conductor</TextField.Label>
                                                        <TextField.Input type="text" placeholder="Ej: Pedro Pérez" />
                                                        <TextField.ErrorMessage />
                                                    </TextField.Root>
                                                )}
                                            </props.form.Field>
                                        </div>

                                        <div class="col-span-12 md:col-span-2">
                                            <props.form.Field name={`drivers[${i}].phone`}>
                                                {(subField) => (
                                                    <TextField.Root field={subField()}>
                                                        <TextField.Label>Teléfono / Celular</TextField.Label>
                                                        <TextField.Input type="text" placeholder="099..." />
                                                        <TextField.ErrorMessage />
                                                    </TextField.Root>
                                                )}
                                            </props.form.Field>
                                        </div>

                                        <div class="col-span-6 md:col-span-2 pt-6">
                                            <props.form.Field name={`drivers[${i}].isActive`}>
                                                {(subField) => (
                                                    <Checkbox field={subField()} class="font-medium">
                                                        Activo
                                                    </Checkbox>
                                                )}
                                            </props.form.Field>
                                        </div>

                                        <div class="col-span-6 md:col-span-1 flex items-center justify-end md:justify-center pt-5">
                                            <button
                                                type="button"
                                                onClick={() => field().removeValue(i)}
                                                class="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                                                title="Eliminar Conductor"
                                            >
                                                <TrashIcon class="size-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </Index>
                        </div>
                    </div>
                )}
            </props.form.Field>
        </div>
    );
};
