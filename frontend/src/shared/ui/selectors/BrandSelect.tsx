/**
 * BrandSelect — Reusable brand autocomplete with search.
 * Uses `useBrandsList()` internally.
 */
import { Component, Show, createMemo, createSignal } from 'solid-js';
import { useBrandsList } from '@modules/brands/data/brands.queries';
import { Autocomplete } from '@shared/ui/Autocomplete';

type Brand = { id: number; name: string };

export interface BrandSelectProps {
    value: number | null | undefined;
    onChange: (id: number | null) => void;
    label?: string;
    placeholder?: string;
    field?: any;
    onCreateNew?: () => void;
}

export const BrandSelect: Component<BrandSelectProps> = (props) => {
    const brandsQuery = useBrandsList();
    const brands = createMemo(() => (brandsQuery.data ?? []) as Brand[]);
    const [search, setSearch] = createSignal('');

    // Filtered by search
    const filteredOptions = createMemo(() => {
        const s = search().toLowerCase().trim();
        if (!s) return brands();
        return brands().filter(b => b.name.toLowerCase().includes(s));
    });

    // Init search text from value
    createMemo(() => {
        if (props.value && !search()) {
            const brand = brands().find(b => b.id === props.value);
            if (brand) setSearch(brand.name);
        }
    });

    return (
        <Autocomplete.Root field={props.field}>
            <Show when={props.label !== undefined}>
                <Autocomplete.Label>{props.label ?? 'Marca'}</Autocomplete.Label>
            </Show>
            <Autocomplete.Input<Brand>
                value={search()}
                onInputChange={setSearch}
                options={filteredOptions()}
                optionValue={(b) => String(b.id)}
                optionLabel={(b) => b.name}
                placeholder={props.placeholder ?? 'Buscar marca...'}
                hideEmptyState={false}
                minLength={0}
                onCreateNew={props.onCreateNew}
                createNewLabel="Crear marca"
                onSelect={(brand) => {
                    if (brand) {
                        props.onChange(brand.id);
                        setSearch(brand.name);
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

export default BrandSelect;
