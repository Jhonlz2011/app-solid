import { Component, Index, Show } from 'solid-js';
import TextField from '@form/TextField';
import { TrashIcon } from '@icons/TrashIcon';
import { PlusIcon } from '@icons/PlusIcon';
import Button from '@form/Button';
import type { EntityFormApi } from '../entity-form.types';

interface ContactRowProps {
    form: EntityFormApi;
    index: number;
    onRemove: () => void;
}

const ContactRow: Component<ContactRowProps> = (props) => {
    return (
        <div class="relative grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-card rounded-xl border border-border/50 shadow-sm animate-in slide-in-from-top-2">
            <div class="col-span-12 md:col-span-3">
                <props.form.Field name={`contacts[${props.index}].name`}>
                    {(subField) => (
                        <TextField.Root field={subField()}>
                            <TextField.Label>Nombre Completo</TextField.Label>
                            <TextField.Input type="text" placeholder="Ej: Juan Pérez" />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )}
                </props.form.Field>
            </div>
            <div class="col-span-12 md:col-span-3">
                <props.form.Field name={`contacts[${props.index}].position`}>
                    {(subField) => (
                        <TextField.Root field={subField()}>
                            <TextField.Label>Cargo/Área</TextField.Label>
                            <TextField.Input type="text" placeholder="Ej: Ventas" />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )}
                </props.form.Field>
            </div>
            <div class="col-span-12 md:col-span-3">
                <props.form.Field name={`contacts[${props.index}].email`}>
                    {(subField) => (
                        <TextField.Root field={subField()}>
                            <TextField.Label>Email</TextField.Label>
                            <TextField.Input type="email" placeholder="@" />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )}
                </props.form.Field>
            </div>
            <div class="col-span-12 md:col-span-2">
                <props.form.Field name={`contacts[${props.index}].phone`}>
                    {(subField) => (
                        <TextField.Root field={subField()}>
                            <TextField.Label>Teléfono</TextField.Label>
                            <TextField.Input type="text" placeholder="099..." />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )}
                </props.form.Field>
            </div>
            <div class="col-span-12 md:col-span-1 flex items-center justify-end md:justify-center pt-5">
                <button
                    type="button"
                    onClick={props.onRemove}
                    class="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                    title="Eliminar Contacto"
                >
                    <TrashIcon class="size-4" />
                </button>
            </div>
        </div>
    );
};

export interface EntityContactsArrayProps {
    form: EntityFormApi;
}

export const EntityContactsArray: Component<EntityContactsArrayProps> = (props) => {
    return (
        <props.form.Field name="contacts" mode="array">
            {(field) => (
                <div class="bg-surface/30 p-4 rounded-2xl border border-border/40">
                    <div class="flex items-center justify-between flex-wrap gap-3 mb-4 pb-3 border-b border-border/50">
                        <div class="flex items-center gap-2">
                            <div class="w-1.5 h-4 bg-primary rounded-full"></div>
                            <h3 class="font-semibold text-text uppercase tracking-wide text-sm">Lista de Contactos (Opcional)</h3>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            class="gap-1.5"
                            onClick={() => field().pushValue({ name: '', position: '', email: '', phone: '', isPrimary: false })}
                        >
                            <PlusIcon class="size-4" /> Añadir Contacto
                        </Button>
                    </div>
                    <div class="space-y-4">
                        <Show when={field().state.value.length === 0}>
                            <div class="text-center py-6 text-muted bg-surface/50 rounded-lg border border-dashed border-border/60">
                                No hay contactos adicionales configurados.<br />Click en "Añadir Contacto" para empezar.
                            </div>
                        </Show>
                        <Index each={field().state.value}>
                            {(_, i) => (
                                <ContactRow form={props.form} index={i} onRemove={() => field().removeValue(i)} />
                            )}
                        </Index>
                    </div>
                </div>
            )}
        </props.form.Field>
    );
};
