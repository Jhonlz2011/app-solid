import { Show, createMemo } from 'solid-js';
import { Combobox as KCombobox } from '@kobalte/core/combobox';
import { SearchIcon, XIcon } from './icons';

export interface AutocompleteProps<T> {
    value: string;
    onInputChange: (value: string) => void;
    options: T[];
    optionValue: (option: T) => string;
    optionLabel: (option: T) => string;
    optionDescription?: (option: T) => string;
    itemRenderer?: (option: T) => import('solid-js').JSX.Element;
    inputPrefix?: import('solid-js').JSX.Element;
    onSelect?: (option: T) => void;
    placeholder?: string;
    disabled?: boolean;
    isLoading?: boolean;
    class?: string;
    onSearchAction?: () => void;
    minLength?: number;
}

export function Autocomplete<T>(props: AutocompleteProps<T>) {
    // Guard: suppress ALL onInputChange calls for 150ms after a selection.
    // Kobalte fires onInputChange multiple times (internal sync + blur) after onChange.
    let _lastSelectionTime = 0;

    // Agreamos el valor en crudo (string) a las opciones para que Kobalte 
    // no borre el input al perder el foco y permita escritura libre (free text).
    const dynamicOptions = createMemo(() => {
        const val = props.value;
        const opts: Array<T | string> = [...props.options];
        if (val) {
            const exists = props.options.some(
                opt => props.optionValue(opt) === val || props.optionLabel(opt) === val
            );
            if (!exists) {
                opts.push(val);
            }
        }
        return opts;
    });

    // Encuentra el objeto completo si el valor es un string y coincide con alguna opción
    const selectedItem = createMemo(() => {
        const val = props.value;
        if (!val) return undefined;
        const found = props.options.find(
            opt => props.optionValue(opt) === val || props.optionLabel(opt) === val
        );
        return found ?? val; 
    });

    return (
        <KCombobox<T | string>
            class={`flex flex-col gap-1.5 ${props.class ?? ''}`}
            options={dynamicOptions()}
            onInputChange={(v) => {
                // Suppress Kobalte's internal onInputChange calls after selection
                if (Date.now() - _lastSelectionTime < 150) return;
                props.onInputChange(v);
            }}
            value={selectedItem()}
            onChange={(selected) => {
                if (!selected) return;
                
                if (typeof selected === 'string') {
                    props.onInputChange(selected);
                } else {
                    // Set timestamp guard before onSelect
                    _lastSelectionTime = Date.now();
                    if (props.onSelect) {
                        props.onSelect(selected);
                    }
                }
            }}
            optionValue={(opt) => typeof opt === 'string' ? opt : props.optionValue(opt)}
            // IMPORTANT: Escaping double quotes here because Kobalte uses this internally
            // to query the DOM via `querySelector('[data-key="..."]')`
            optionTextValue={(opt) => typeof opt === 'string' ? opt.replace(/"/g, "'") : props.optionLabel(opt).replace(/"/g, "'")}
            optionLabel={(opt) => typeof opt === 'string' ? opt : props.optionLabel(opt)}
            defaultFilter={() => true} // DISABLE LOCAL FILTERING SO SERVER RESULTS ALWAYS SHOW
            disabled={props.disabled}
            placeholder={props.placeholder}
            itemComponent={(itemProps) => {
                const opt = itemProps.item.rawValue;
                if (typeof opt === 'string') {
                    // Ocultamos la opción manual de la lista visual,
                    // pero satisfacemos el requerimiento interno de Kobalte
                    return (
                        <KCombobox.Item item={itemProps.item} class="hidden">
                             <KCombobox.ItemLabel>{opt}</KCombobox.ItemLabel>
                        </KCombobox.Item>
                    );
                }
                
                return (
                    <KCombobox.Item 
                        item={itemProps.item}
                        class="relative flex w-full cursor-pointer select-none items-center justify-between rounded-lg px-3 py-2 text-sm outline-none transition-colors duration-150 text-text-secondary data-[highlighted]:bg-primary-soft data-[highlighted]:text-primary-strong data-[selected]:text-primary data-[selected]:font-medium"
                    >
                        <Show when={props.itemRenderer} fallback={
                            <div class="flex flex-col">
                                <span class="font-medium text-text">{props.optionLabel(opt)}</span>
                                <Show when={props.optionDescription}>
                                    <span class="text-xs text-muted truncate">{props.optionDescription!(opt)}</span>
                                </Show>
                            </div>
                        }>
                            {props.itemRenderer!(opt)}
                        </Show>
                    </KCombobox.Item>
                );
            }}
        >
            <KCombobox.Control>
                <KCombobox.Trigger class="group flex w-full items-center justify-between cursor-pointer px-4 rounded-xl border transition-all duration-200 bg-card-alt border-border text-text hover:bg-card hover:border-border-strong has-[:focus-visible]:border-primary/65 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/25 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50">
                    <Show when={props.inputPrefix}>
                        <div class="mr-2 flex-shrink-0">{props.inputPrefix}</div>
                    </Show>
                    <KCombobox.Input 
                        placeholder={props.placeholder}
                        class="flex-1 bg-transparent py-1.5 outline-none placeholder:text-muted text-text font-medium min-w-0"
                        onPointerDown={(e) => {
                            // Detener la propagación para que Kobalte no capture el click como un intento de selección
                            e.stopPropagation();
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && props.onSearchAction) {
                                props.onSearchAction();
                            }
                        }}
                    />
                    <div class="ml-2 flex flex-shrink-0 items-center justify-center text-muted group-hover:text-text-secondary transition-colors h-full">
                        <Show when={props.isLoading}>
                            <svg class="animate-spin size-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </Show>
                        <Show when={!props.isLoading}>
                            <Show when={props.value} fallback={
                                <div 
                                    classList={{ 'cursor-pointer hover:text-primary': !!props.onSearchAction }}
                                    onClick={(e) => {
                                        if (props.onSearchAction) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            props.onSearchAction();
                                        }
                                    }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    <SearchIcon class="size-4" />
                                </div>
                            }>
                                <div 
                                    class="cursor-pointer hover:text-danger rounded-md"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        props.onInputChange('');
                                        // Optionally alert parent that it was cleared
                                        if (props.onSelect) {
                                            props.onSelect(null as any); 
                                        }
                                    }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    title="Limpiar"
                                >
                                    <XIcon class="size-3.5" strokeWidth={3} />
                                </div>
                            </Show>
                        </Show>
                    </div>
                </KCombobox.Trigger>
            </KCombobox.Control>

            <KCombobox.Portal>
                <KCombobox.Content 
                    class="relative z-[100] min-w-[8rem] overflow-hidden bg-card border border-border shadow-md rounded-xl p-1 transform-origin-var data-[expanded]:animate-in data-[expanded]:fade-in-0 data-[expanded]:zoom-in-95 data-[expanded]:slide-in-from-top-2 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[closed]:slide-out-to-top-2"
                    classList={{ 'hidden': props.options.length === 0 && (props.value?.length ?? 0) < (props.minLength ?? 3) }}
                >
                    <Show 
                        when={props.options.length > 0} 
                        fallback={
                            <div class="p-4 text-center text-sm text-muted">
                                {props.isLoading ? 'Buscando...' : 'No se encontraron resultados.'}
                            </div>
                        }
                    >
                        <KCombobox.Listbox class={`max-h-[256px] overflow-y-auto outline-none p-1 bg-card text-text transition-opacity duration-200 ${props.isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100 pointer-events-auto'}`} />
                    </Show>
                </KCombobox.Content>
            </KCombobox.Portal>
        </KCombobox>
    );
}
