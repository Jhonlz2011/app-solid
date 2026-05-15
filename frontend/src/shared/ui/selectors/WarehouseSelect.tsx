/**
 * WarehouseSelect — Reusable warehouse autocomplete with search.
 * Uses `useWarehousesList()` internally.
 */
import { Component, Show, createMemo, createSignal } from 'solid-js';
import { useWarehousesList } from '@modules/settings/data/warehouses.queries';
import { Autocomplete } from '@shared/ui/Autocomplete';

type Warehouse = { id: number; name: string; code: string };

export interface WarehouseSelectProps {
    value: number | null | undefined;
    onChange: (id: number | null) => void;
    label?: string;
    placeholder?: string;
    field?: any;
}

export const WarehouseSelect: Component<WarehouseSelectProps> = (props) => {
    const warehousesQuery = useWarehousesList();
    const warehouses = createMemo(() => (warehousesQuery.data ?? []) as Warehouse[]);
    const [search, setSearch] = createSignal('');

    // Filtered by search
    const filteredOptions = createMemo(() => {
        const s = search().toLowerCase().trim();
        if (!s) return warehouses();
        return warehouses().filter(w =>
            w.name.toLowerCase().includes(s) || w.code.toLowerCase().includes(s)
        );
    });

    // Init search text from value
    createMemo(() => {
        if (props.value && !search()) {
            const wh = warehouses().find(w => w.id === props.value);
            if (wh) setSearch(`${wh.code} — ${wh.name}`);
        }
    });

    return (
        <Autocomplete.Root field={props.field}>
            <Show when={props.label !== undefined}>
                <Autocomplete.Label>{props.label ?? 'Bodega'}</Autocomplete.Label>
            </Show>
            <Autocomplete.Input<Warehouse>
                value={search()}
                onInputChange={setSearch}
                options={filteredOptions()}
                optionValue={(w) => String(w.id)}
                optionLabel={(w) => `${w.code} — ${w.name}`}
                placeholder={props.placeholder ?? 'Buscar bodega...'}
                hideEmptyState={false}
                minLength={0}
                onSelect={(wh) => {
                    if (wh) {
                        props.onChange(wh.id);
                        setSearch(`${wh.code} — ${wh.name}`);
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

export default WarehouseSelect;
