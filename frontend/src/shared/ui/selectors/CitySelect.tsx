import { Component, Show, createSignal, createEffect, onCleanup, on } from 'solid-js';
import { Autocomplete } from '@shared/ui/Autocomplete';
import { useGeoNamesCities, type GeoNameCity } from '@shared/hooks/useGeoNamesCities';
import type { FieldLike } from '@shared/ui/form/form.types';

export interface CitySelectProps {
    value: string;
    onInputChange: (value: string) => void;
    onSelect: (city: GeoNameCity | null) => void;
    field?: FieldLike<any>;
    placeholder?: string;
    label?: string;
    countryCode?: string; // Optional: to display the flag icon prefix
}

export const CitySelect: Component<CitySelectProps> = (props) => {
    const cities = useGeoNamesCities();
    const [localQuery, setLocalQuery] = createSignal(props.value || '');
    const [selectedCity, setSelectedCity] = createSignal<string | null>(props.value || null);

    // Sync external value to local state ONLY if it's different, to prevent loops
    createEffect(on(() => props.value, (val) => {
        if (val !== localQuery()) {
            setLocalQuery(val ?? '');
            setSelectedCity(val ?? null);
        }
    }, { defer: true }));

    const handleInputChange = (val: string) => {
        setLocalQuery(val);
        
        if (val === selectedCity()) {
            props.onInputChange(val);
            return;
        }

        setSelectedCity(null);
        props.onInputChange(val);
        cities.setSearch(val);
    };

    const handleSelect = (city: GeoNameCity | null) => {
        if (city) {
            setSelectedCity(city.ciudad);
            setLocalQuery(city.ciudad);
            props.onSelect(city);
        } else {
            setSelectedCity(null);
            props.onSelect(null);
        }
    };

    return (
        <Autocomplete.Root field={props.field}>
            <Show when={props.label !== undefined}>
                <Autocomplete.Label>{props.label ?? 'Ciudad/Cantón'}</Autocomplete.Label>
            </Show>
            <Autocomplete.Input<GeoNameCity>
                value={localQuery()}
                onInputChange={handleInputChange}
                options={selectedCity() === localQuery() ? [] : (cities.query.data ?? [])}
                optionValue={(c) => c.ciudad}
                optionLabel={(c) => c.ciudad}
                onSelect={handleSelect}
                isLoading={cities.query.isFetching}
                placeholder={props.placeholder ?? 'Buscar ciudad...'}
                minLength={2}
                clearOnBlur={false}
                hideEmptyState={selectedCity() === localQuery()}
                inputPrefix={
                    props.countryCode ? (
                        <img
                            src={`https://flagcdn.com/${props.countryCode.toLowerCase()}.svg`}
                            alt={props.countryCode}
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
                            <span class="font-medium text-text truncate w-full" title={city.ciudad}>
                                {city.ciudad}
                            </span>
                            <span class="text-xs text-muted truncate w-full" title={city.pais}>
                                {city.pais}
                            </span>
                        </div>
                    </div>
                )}
            />
            <Autocomplete.ErrorMessage />
        </Autocomplete.Root>
    );
};

export default CitySelect;
