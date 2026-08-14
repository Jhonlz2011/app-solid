import { Component, Index, Show } from 'solid-js';
import TextField from '@shared/ui/TextField';
import { TrashIcon, PlusIcon } from '@shared/ui/icons';
import Button from '@shared/ui/Button';
import type { EntityFormApi } from '../entity-form.types';
import { CitySelect } from '@shared/ui/selectors';

interface AddressRowProps {
    form: EntityFormApi;
    index: number;
    onRemove: () => void;
}

const AddressRow: Component<AddressRowProps> = (props) => {
    return (
        <div class="relative grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-card rounded-xl border border-border/50 shadow-sm animate-in slide-in-from-top-2">
            <div class="col-span-12 md:col-span-5">
                <props.form.Field name={`addresses[${props.index}].addressLine`}>
                    {(subField: any) => (
                        <TextField.Root field={subField()}>
                            <TextField.Label>Dirección Completa</TextField.Label>
                            <TextField.Input type="text" placeholder="Av. Principal y Secundaria..." />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )}
                </props.form.Field>
            </div>
            
            <div class="col-span-12 sm:col-span-6 md:col-span-4">
                <props.form.Field name={`addresses[${props.index}].city`}>
                    {(subField: any) => {
                        const countryCode = props.form.useStore(s => s.values.addresses[props.index]?.countryCode);
                        
                        return (
                            <CitySelect
                                field={subField()}
                                label="Ciudad/Cantón"
                                value={subField().state.value || ''}
                                countryCode={countryCode() || ''}
                                placeholder="Buscar ciudad..."
                                onInputChange={(val) => {
                                    props.form.setFieldValue(`addresses[${props.index}].city`, val);
                                    props.form.setFieldValue(`addresses[${props.index}].country`, '');
                                    props.form.setFieldValue(`addresses[${props.index}].countryCode`, '');
                                }}
                                onSelect={(city) => {
                                    if (city) {
                                        props.form.setFieldValue(`addresses[${props.index}].city`, city.ciudad);
                                        props.form.setFieldValue(`addresses[${props.index}].country`, city.pais);
                                        props.form.setFieldValue(`addresses[${props.index}].countryCode`, city.codigo);
                                    }
                                }}
                            />
                        );
                    }}
                </props.form.Field>
            </div>

            <div class="col-span-12 sm:col-span-6 md:col-span-2">
                <props.form.Field name={`addresses[${props.index}].postalCode`}>
                    {(subField: any) => (
                        <TextField.Root field={subField()}>
                            <TextField.Label>Código Postal</TextField.Label>
                            <TextField.Input type="text" placeholder="Ej: 170515" />
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
                    title="Eliminar Dirección"
                >
                    <TrashIcon class="size-4" />
                </button>
            </div>
        </div>
    );
};

export interface EntityAddressArrayProps {
    form: EntityFormApi;
}

export const EntityAddressArray: Component<EntityAddressArrayProps> = (props) => {
    return (
        <props.form.Field name="addresses" mode="array">
            {(field) => (
                <div class="bg-surface/30 p-4 rounded-2xl border border-border/40">
                    <div class="flex items-center justify-between flex-wrap gap-3 mb-4 pb-3 border-b border-border/50">
                        <div class="flex items-center gap-2">
                            <div class="w-1.5 h-4 bg-primary rounded-full"></div>
                            <h3 class="font-semibold text-text uppercase tracking-wide text-sm">Direcciones &amp; Sucursales</h3>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            class="gap-1.5"
                            onClick={() => field().pushValue({ 
                                addressLine: '', 
                                city: '', 
                                country: 'Ecuador', 
                                countryCode: 'EC', 
                                postalCode: '', 
                                isMain: field().state.value.length === 0 
                            })}
                        >
                            <PlusIcon class="size-4" /> Añadir Dirección
                        </Button>
                    </div>
                    <div class="space-y-4">
                        <Show when={field().state.value.length === 0}>
                            <div class="text-center py-6 text-muted bg-surface/50 rounded-lg border border-dashed border-border/60">
                                No hay direcciones asignadas. Click en "Añadir Dirección" para empezar.
                            </div>
                        </Show>
                        <Index each={field().state.value}>
                            {(_, i) => (
                                <AddressRow form={props.form} index={i} onRemove={() => field().removeValue(i)} />
                            )}
                        </Index>
                    </div>
                </div>
            )}
        </props.form.Field>
    );
};
