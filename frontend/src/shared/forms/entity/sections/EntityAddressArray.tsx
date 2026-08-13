import { Component, createSignal, createEffect, Index, Show } from 'solid-js';
import { useGeoNamesCities, type GeoNameCity } from '@shared/hooks/useGeoNamesCities';
import TextField from '@shared/ui/TextField';
import { Autocomplete } from '@shared/ui/Autocomplete';
import { TrashIcon, PlusIcon } from '@shared/ui/icons';
import Button from '@shared/ui/Button';
import type { EntityFormApi } from '../entity-form.types';

interface AddressRowProps {
    form: EntityFormApi;
    index: number;
    onRemove: () => void;
}

const AddressRow: Component<AddressRowProps> = (props) => {
    const cities = useGeoNamesCities();
    const [localCountry, setLocalCountry] = createSignal('');
    const [localCountryCode, setLocalCountryCode] = createSignal('');
    const [inputText, setInputText] = createSignal('');

    const handleCitySelect = (city: GeoNameCity | null) => {
        if (!city) return;
        props.form.setFieldValue(`addresses[${props.index}].city`, city.ciudad);
        props.form.setFieldValue(`addresses[${props.index}].country`, city.pais);
        props.form.setFieldValue(`addresses[${props.index}].countryCode`, city.codigo);
        setLocalCountry(city.pais);
        setLocalCountryCode(city.codigo);
        setInputText(`${city.ciudad}, ${city.pais}`);
    };

    const handleInputChange = (val: string) => {
        if (val === inputText()) return;
        setInputText(val);
        setLocalCountryCode('');
        setLocalCountry('');
        const cityPart = val.includes(',') ? val.split(',')[0].trim() : val;
        props.form.setFieldValue(`addresses[${props.index}].city`, cityPart);
        cities.setSearch(cityPart);
    };

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
                        createEffect(() => {
                            const currentCity = subField().state.value;
                            if (currentCity && currentCity !== inputText().split(',')[0].trim()) {
                                const country = props.form.getFieldValue(`addresses[${props.index}].country`) || '';
                                const code = props.form.getFieldValue(`addresses[${props.index}].countryCode`) || '';
                                setLocalCountry(country);
                                setLocalCountryCode(code);
                                setInputText(country ? `${currentCity}, ${country}` : currentCity);
                            } else if (!currentCity && inputText()) {
                                setLocalCountry('');
                                setLocalCountryCode('');
                                setInputText('');
                            }
                        });

                        return (
                        <Autocomplete.Root field={subField()}>
                            <Autocomplete.Label>Ciudad</Autocomplete.Label>
                            <Autocomplete.Input<GeoNameCity>
                                value={inputText()}
                                onInputChange={handleInputChange}
                                options={cities.query.data ?? []}
                                optionValue={(c) => `${c.ciudad}, ${c.pais}`}
                                optionLabel={(c) => `${c.ciudad}, ${c.pais}`}
                                onSelect={handleCitySelect}
                                isLoading={cities.query.isFetching}
                                placeholder="Buscar ciudad..."
                                minLength={2}
                                inputPrefix={
                                    localCountryCode() ? (
                                        <img
                                            src={`https://flagcdn.com/${localCountryCode().toLowerCase()}.svg`}
                                            alt={localCountryCode()}
                                            class="size-5 rounded-sm object-cover shadow-sm"
                                            loading="lazy"
                                        />
                                    ) : undefined
                                }
                                itemRenderer={(city) => (
                                    <div class="flex items-center gap-2.5 w-full min-w-0">
                                        <img
                                            src={city.bandera}
                                            alt={city.codigo}
                                            class="size-5 rounded-sm object-cover shadow-sm shrink-0"
                                            loading="lazy"
                                        />
                                        <div class="flex flex-col min-w-0 flex-1">
                                            <span class="font-medium text-text truncate w-full" title={city.ciudad}>{city.ciudad}</span>
                                            <span class="text-xs text-muted truncate w-full" title={city.pais}>{city.pais}</span>
                                        </div>
                                    </div>
                                )}
                            />
                            <Autocomplete.ErrorMessage />
                        </Autocomplete.Root>
                    ); }}
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
                            onClick={() => field().pushValue({ addressLine: '', city: '', country: 'Ecuador', countryCode: 'EC', postalCode: '', isMain: field().state.value.length === 0 })}
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
