/**
 * WarehouseSelect — Reusable warehouse autocomplete with search + clear.
 * Uses `useWarehousesList()` internally.
 */
import { Component, Show, createMemo, createSignal, createEffect } from 'solid-js';
import { useWarehousesList } from '@modules/settings/data/warehouses.queries';
import { Autocomplete } from '@shared/ui/Autocomplete';
import { WarehouseIcon } from '@shared/ui/icons';
import type { WarehouseItem } from '@modules/settings/data/warehouses.api';

export interface WarehouseSelectProps {
    value: number | null | undefined;
    onChange: (id: number | null) => void;
    label?: string;
    placeholder?: string;
    field?: any;
    disabled?: boolean;
}

export const WarehouseSelect: Component<WarehouseSelectProps> = (props) => {
    const warehousesQuery = useWarehousesList();
    const warehouses = createMemo(() => (warehousesQuery.data ?? []) as WarehouseItem[]);
    const [search, setSearch] = createSignal('');

    // Filtered by search
    const filteredOptions = createMemo(() => {
        const s = search().toLowerCase().trim();
        if (!s) return warehouses();
        return warehouses().filter(w => {
            const label = `${w.code} — ${w.name}`.toLowerCase();
            return w.name.toLowerCase().includes(s) ||
                   w.code.toLowerCase().includes(s) ||
                   label.includes(s) ||
                   s.includes(label);
        });
    });

    // Sync display text from external value
    createEffect(() => {
        const v = props.value;
        if (v && warehouses().length > 0) {
            const wh = warehouses().find(w => w.id === v);
            if (wh) {
                setSearch(`${wh.code} — ${wh.name}`);
            }
        } else if (!v) {
            setSearch('');
        }
    });

    return (
        <Autocomplete.Root field={props.field}>
            <Show when={props.label !== undefined}>
                <Autocomplete.Label>{props.label ?? 'Bodega'}</Autocomplete.Label>
            </Show>
            <Autocomplete.Input<WarehouseItem>
                disabled={props.disabled}
                value={search()}
                onInputChange={setSearch}
                options={filteredOptions()}
                optionValue={(w) => String(w.id)}
                optionLabel={(w) => `${w.code} — ${w.name}`}
                placeholder={props.placeholder ?? 'Todas las bodegas'}
                hideEmptyState={false}
                minLength={0}
                inputPrefix={<WarehouseIcon class="size-4 text-muted" />}
                itemRenderer={(wh) => (
                    <div class="flex items-center justify-between w-full min-w-0 py-0.5">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <div class="flex-shrink-0 flex items-center justify-center size-7 rounded-lg bg-primary-soft text-primary transition-colors">
                                <WarehouseIcon class="size-4" />
                            </div>
                            <div class="flex flex-col min-w-0">
                                <span class="font-semibold text-text text-sm truncate">{wh.name}</span>
                                <span class="text-xs text-muted font-mono">{wh.code}</span>
                            </div>
                        </div>
                        <Show when={wh.locationCount !== undefined}>
                            <div class="flex-shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface border border-border text-xs text-text-secondary font-medium">
                                <span class="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>{wh.locationCount} {wh.locationCount === 1 ? 'ubicación' : 'ubicaciones'}</span>
                            </div>
                        </Show>
                    </div>
                )}
                onSelect={(wh) => {
                    if (wh) {
                        props.onChange(wh.id);
                        setSearch(`${wh.code} — ${wh.name}`);
                    } else {
                        props.onChange(null);
                        setSearch('');
                    }
                }}
                onBlur={() => {
                    const v = props.value;
                    if (v && warehouses().length > 0) {
                        const wh = warehouses().find(w => w.id === v);
                        if (wh) {
                            setSearch(`${wh.code} — ${wh.name}`);
                        }
                    } else if (!v) {
                        setSearch('');
                    }
                }}
            />
            <Autocomplete.ErrorMessage />
        </Autocomplete.Root>
    );
};

export default WarehouseSelect;
