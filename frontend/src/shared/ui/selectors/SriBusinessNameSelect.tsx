/**
 * SriBusinessNameSelect — Autocomplete selector for SRI business name search.
 * Encapsulates the debounced SRI name search, custom item rendering,
 * and free-text mode (clearOnBlur=false).
 */
import { Component, Show, createSignal, createEffect, onCleanup, on } from 'solid-js';
import { useSriSearchByName } from '@modules/sri/sri.queries';
import type { SriSearchResult } from '@modules/sri/sri.types';
import { Autocomplete } from '@form/Autocomplete';
import type { FieldLike } from '@shared/ui/form/form.types';

export interface SriBusinessNameSelectProps {
    value: string;
    onInputChange: (value: string) => void;
    onSelect: (result: SriSearchResult | null) => void;
    field?: FieldLike<any>;
    placeholder?: string;
    label?: string;
    inputId?: string;
}

export const SriBusinessNameSelect: Component<SriBusinessNameSelectProps> = (props) => {
    const [localQuery, setLocalQuery] = createSignal(props.value || '');
    const [sriQuery, setSriQuery] = createSignal('');
    const [selectedName, setSelectedName] = createSignal<string | null>(props.value || null);

    let debounceTimer: ReturnType<typeof setTimeout>;
    onCleanup(() => clearTimeout(debounceTimer));

    // Sync external changes (e.g. form reset or programmatic set)
    createEffect(on(() => props.value, (val) => {
        const nextVal = val ?? '';
        if (nextVal !== localQuery()) {
            setLocalQuery(nextVal);
            setSelectedName(nextVal || null);
        }
    }, { defer: true }));

    const nameSearch = useSriSearchByName(sriQuery);

    const handleInputChange = (value: string) => {
        setLocalQuery(value);
        
        if (value === '') {
            clearTimeout(debounceTimer);
            setSriQuery('');
        }

        if (value === selectedName()) {
            props.onInputChange(value);
            return;
        }

        setSelectedName(null);
        props.onInputChange(value);
    };

    const handleSearchAction = (value: string) => {
        clearTimeout(debounceTimer);
        if (value.length >= 3) {
            debounceTimer = setTimeout(() => setSriQuery(value), 400);
        } else {
            setSriQuery('');
        }
    };

    const handleSelect = (result: SriSupplierResponse | null) => {
        clearTimeout(debounceTimer);
        if (result) {
            setSelectedName(result.razonSocial);
            setLocalQuery(result.razonSocial);
            setSriQuery('');
        } else {
            setSelectedName(null);
            setLocalQuery('');
            setSriQuery('');
        }
        props.onSelect(result);
    };

    return (
        <Autocomplete.Root field={props.field}>
            <Show when={props.label !== undefined}>
                <Autocomplete.Label>{props.label ?? 'Razón Social (Búsqueda SRI)'}</Autocomplete.Label>
            </Show>
            <Autocomplete.Input<SriSupplierResponse>
                inputId={props.inputId ?? 'businessName-input'}
                value={localQuery()}
                onInputChange={handleInputChange}
                onSearchAction={handleSearchAction}
                options={localQuery().length >= 3 ? (nameSearch.data ?? []) : []}
                optionValue={(opt) => opt.ruc}
                optionLabel={(opt) => opt.razonSocial}
                itemRenderer={(opt) => (
                    <div class="flex flex-col w-full gap-1 min-w-0">
                        <div class="flex w-full items-center justify-between gap-1 min-w-0">
                            <span class="font-medium text-text truncate max-w-[70%] flex-1 min-w-0">{opt.razonSocial}</span>
                            <span class={`shrink-0 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${opt.isActive ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
                                {opt.isActive ? 'Activo' : 'Suspendido'}
                            </span>
                        </div>
                        <div class="flex w-full items-center gap-2 text-xs text-muted min-w-0">
                            <span class="font-mono bg-surface-alt px-1.5 py-0.5 rounded border border-border shrink-0">{opt.ruc}</span>
                            <Show when={opt.nombreComercial && opt.nombreComercial !== opt.razonSocial}>
                                <span class="truncate flex-1 min-w-0">({opt.nombreComercial})</span>
                            </Show>
                        </div>
                    </div>
                )}
                onSelect={handleSelect}
                isLoading={nameSearch.isFetching && selectedName() !== localQuery()}
                hideEmptyState={selectedName() === localQuery()}
                clearOnBlur={false}
                placeholder={props.placeholder ?? 'Ingrese 3 letras o más para Autocompletar SRI'}
            />
            <Autocomplete.ErrorMessage />
        </Autocomplete.Root>
    );
};

export default SriBusinessNameSelect;
