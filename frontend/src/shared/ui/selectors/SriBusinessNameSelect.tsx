/**
 * SriBusinessNameSelect — Autocomplete selector for SRI business name search.
 * Encapsulates the debounced SRI name search, custom item rendering,
 * and free-text mode (clearOnBlur=false).
 */
import { Component, Show, createSignal, onCleanup } from 'solid-js';
import { useSriSearchByName } from '@modules/sri/sri.queries';
import type { SriSupplierResponse } from '@modules/sri/sri.types';
import { Autocomplete } from '@shared/ui/Autocomplete';
import type { FieldLike } from '@shared/ui/form/form.types';

export interface SriBusinessNameSelectProps {
    value: string;
    onInputChange: (value: string) => void;
    onSelect: (result: SriSupplierResponse | null) => void;
    field?: FieldLike<any>;
    placeholder?: string;
    label?: string;
    inputId?: string;
}

export const SriBusinessNameSelect: Component<SriBusinessNameSelectProps> = (props) => {
    const [sriQuery, setSriQuery] = createSignal(props.value || '');

    let debounceTimer: ReturnType<typeof setTimeout>;
    onCleanup(() => clearTimeout(debounceTimer));

    const nameSearch = useSriSearchByName(sriQuery);

    const handleInputChange = (value: string) => {
        props.onInputChange(value);
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => setSriQuery(value), 400);
    };

    const handleSelect = (result: SriSupplierResponse | null) => {
        if (result) {
            setSriQuery(result.razonSocial);
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
                value={props.value}
                onInputChange={handleInputChange}
                options={props.value.length >= 3 ? (nameSearch.data ?? []) : []}
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
                isLoading={nameSearch.isFetching}
                hideEmptyState={true}
                clearOnBlur={false}
                placeholder={props.placeholder ?? 'Ingrese 3 letras o más para Autocompletar SRI'}
            />
            <Autocomplete.ErrorMessage />
        </Autocomplete.Root>
    );
};

export default SriBusinessNameSelect;
