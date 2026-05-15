/**
 * FamilySelect — Reusable product family autocomplete with search.
 * Uses `useFamiliesList()` internally.
 */
import { Component, Show, createMemo, createSignal } from 'solid-js';
import { useFamiliesList } from '@modules/settings/data/families.queries';
import { Autocomplete } from '@shared/ui/Autocomplete';

type Family = { id: number; name: string };

export interface FamilySelectProps {
    value: number | null | undefined;
    onChange: (id: number | null) => void;
    label?: string;
    placeholder?: string;
    field?: any;
    onCreateNew?: () => void;
}

export const FamilySelect: Component<FamilySelectProps> = (props) => {
    const familiesQuery = useFamiliesList();
    const families = createMemo(() => (familiesQuery.data ?? []) as Family[]);
    const [search, setSearch] = createSignal('');

    // Filtered by search
    const filteredOptions = createMemo(() => {
        const s = search().toLowerCase().trim();
        if (!s) return families();
        return families().filter(f => f.name.toLowerCase().includes(s));
    });

    // Init search text from value
    createMemo(() => {
        if (props.value && !search()) {
            const family = families().find(f => f.id === props.value);
            if (family) setSearch(family.name);
        }
    });

    return (
        <Autocomplete.Root field={props.field}>
            <Show when={props.label !== undefined}>
                <Autocomplete.Label>{props.label ?? 'Familia de Producto'}</Autocomplete.Label>
            </Show>
            <Autocomplete.Input<Family>
                value={search()}
                onInputChange={setSearch}
                options={filteredOptions()}
                optionValue={(f) => String(f.id)}
                optionLabel={(f) => f.name}
                placeholder={props.placeholder ?? 'Buscar familia...'}
                hideEmptyState={false}
                minLength={0}
                onCreateNew={props.onCreateNew}
                createNewLabel="Crear familia"
                onSelect={(family) => {
                    if (family) {
                        props.onChange(family.id);
                        setSearch(family.name);
                    } else {
                        props.onChange(null);
                        setSearch('');
                    }
                }}
            />
            <Autocomplete.ErrorMessage />
        </Autocomplete.Root>
    );
};

export default FamilySelect;
