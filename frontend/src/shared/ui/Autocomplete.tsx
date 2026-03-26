import { Show, createMemo, createContext, useContext, createUniqueId, JSX, createSignal, createEffect, onCleanup } from 'solid-js';
import { Combobox as KCombobox } from '@kobalte/core/combobox';
import { SearchIcon, XIcon } from './icons';
import type { FieldLike } from './form/form.types';
import { hasFieldError, getFieldError, FormSubmissionContext } from './form/form.types';

// ============================================================================
// CONTEXT
// ============================================================================
type ValidationState = 'valid' | 'invalid';

interface AutocompleteContextValue {
    id: string;
    validationState: () => ValidationState;
    errorMessage: () => string;
}

const AutocompleteContext = createContext<AutocompleteContextValue>();

const useAutocompleteContext = () => {
    const context = useContext(AutocompleteContext);
    if (!context) {
        throw new Error('Autocomplete components must be used within Autocomplete.Root');
    }
    return context;
};

// ============================================================================
// ROOT, LABEL, ERROR MESSAGE, DESCRIPTION
// ============================================================================
interface AutocompleteRootProps {
    field?: FieldLike<any>;
    validationState?: ValidationState;
    class?: string;
    children: JSX.Element;
}

const Root = (props: AutocompleteRootProps) => {
    const id = createUniqueId();
    const isFormSubmitted = useContext(FormSubmissionContext);
    
    const validationState = createMemo(() => {
        if (props.field && hasFieldError(props.field, isFormSubmitted())) return 'invalid';
        return props.validationState ?? 'valid';
    });
    const errorMessage = createMemo(() => {
        if (props.field) return getFieldError(props.field);
        return '';
    });

    return (
        <AutocompleteContext.Provider value={{ id, validationState, errorMessage }}>
            <div
                class={`relative flex flex-col gap-1 ${props.class ?? ''}`}
                data-valid={validationState() !== 'invalid'}
                data-invalid={validationState() === 'invalid'}
            >
                {props.children}
            </div>
        </AutocompleteContext.Provider>
    );
};

const Label = (props: { class?: string; children: JSX.Element }) => {
    const context = useAutocompleteContext();
    return (
        <label
            for={context.id}
            class={`text-sm font-medium text-muted ml-1 ${props.class ?? ''}`}
        >
            {props.children}
        </label>
    );
};

const ErrorMessage = (props: { class?: string; children?: JSX.Element }) => {
    const context = useAutocompleteContext();
    const message = () => context.errorMessage() || props.children;
    return (
        <Show when={context.validationState() === 'invalid' && message()}>
            <small class={`absolute -bottom-3.5 left-1 text-xs leading-none text-danger font-medium animate-in fade-in slide-in-from-top-1 ${props.class ?? ''}`} role="alert">
                {message()}
            </small>
        </Show>
    );
};

const Description = (props: { class?: string; children: JSX.Element }) => (
    <span class={`text-xs text-muted mt-0.5 ${props.class ?? ''}`}>{props.children}</span>
);

// ============================================================================
// INPUT COMPONENT (KOBALTE COMBOBOX WRAPPER)
// ============================================================================
export interface AutocompleteInputProps<T> {
    value: string;
    onInputChange: (value: string) => void;
    options: T[];
    optionValue: (option: T) => string;
    optionLabel: (option: T) => string;
    optionDescription?: (option: T) => string;
    itemRenderer?: (option: T) => JSX.Element;
    inputPrefix?: JSX.Element;
    onSelect?: (option: T) => void;
    placeholder?: string;
    disabled?: boolean;
    isLoading?: boolean;
    hideEmptyState?: boolean;
    class?: string;
    onSearchAction?: () => void;
    minLength?: number;
    inputId?: string;
}

const Input = <T,>(props: AutocompleteInputProps<T>) => {
    const context = useAutocompleteContext();
    let _lastSelectionTime = 0;
    
    let triggerRef: HTMLButtonElement | undefined;
    const [triggerWidth, setTriggerWidth] = createSignal<number>(0);
    const [isSelectedState, setIsSelectedState] = createSignal<boolean>(!!props.value);
    
    createEffect(() => {
        if (!triggerRef) return;
        setTriggerWidth(triggerRef.offsetWidth);
        const ro = new ResizeObserver(() => {
            if (triggerRef) setTriggerWidth(triggerRef.offsetWidth);
        });
        ro.observe(triggerRef);
        onCleanup(() => ro.disconnect());
    });

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
                if (Date.now() - _lastSelectionTime < 150) return;
                if (props.value !== v) {
                    setIsSelectedState(false);
                }
                props.onInputChange(v);
            }}
            value={selectedItem()}
            onChange={(selected) => {
                if (!selected) return;
                if (typeof selected === 'string') {
                    props.onInputChange(selected);
                } else {
                    setIsSelectedState(true);
                    _lastSelectionTime = Date.now();
                    if (props.onSelect) {
                        props.onSelect(selected);
                    }
                }
            }}
            optionValue={(opt) => {
                const text = typeof opt === 'string' ? opt : props.optionValue(opt);
                return text.replace(/"/g, "&quot;");
            }}
            optionTextValue={(opt) => {
                const text = typeof opt === 'string' ? opt : props.optionLabel(opt);
                return text.replace(/"/g, "&quot;");
            }}
            optionLabel={(opt) => typeof opt === 'string' ? opt : props.optionLabel(opt)}
            defaultFilter={() => true}
            disabled={props.disabled}
            placeholder={props.placeholder}
            itemComponent={(itemProps) => {
                const opt = itemProps.item.rawValue;
                if (typeof opt === 'string') {
                    return (
                        <KCombobox.Item item={itemProps.item} class="hidden">
                             <KCombobox.ItemLabel>{opt}</KCombobox.ItemLabel>
                        </KCombobox.Item>
                    );
                }
                return (
                    <KCombobox.Item 
                        item={itemProps.item}
                        class="relative flex w-full min-w-0 overflow-hidden cursor-pointer select-none items-center justify-between rounded-lg px-3 py-2 text-sm outline-none transition-colors duration-150 text-text-secondary data-[highlighted]:bg-primary-soft data-[highlighted]:text-primary-strong data-[selected]:text-primary data-[selected]:font-medium"
                    >
                        <Show when={props.itemRenderer} fallback={
                            <div class="flex flex-col min-w-0 w-full">
                                <span class="font-medium text-text truncate w-full" title={typeof opt === 'string' ? opt : props.optionLabel(opt)}>{props.optionLabel(opt)}</span>
                                <Show when={props.optionDescription}>
                                    <span class="text-xs text-muted truncate w-full" title={props.optionDescription!(opt)}>{props.optionDescription!(opt)}</span>
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
                <KCombobox.Trigger 
                    ref={triggerRef}
                    data-invalid={context.validationState() === 'invalid'}
                    class="group flex w-full items-center justify-between cursor-pointer px-4 rounded-xl border transition-all duration-200 bg-card-alt border-border text-text hover:bg-card hover:border-border-strong has-[:focus-visible]:border-primary/65 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/25 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[invalid=true]:border-red-500/50 data-[invalid=true]:has-[:focus-visible]:ring-red-500/25"
                >
                    <Show when={props.inputPrefix}>
                        <div class="mr-2 flex-shrink-0">{props.inputPrefix}</div>
                    </Show>
                    <KCombobox.Input 
                        id={props.inputId || context.id}
                        placeholder={props.placeholder}
                        class="flex-1 bg-transparent py-1.5 outline-none placeholder:text-muted text-text font-medium min-w-0"
                        onPointerDown={(e) => e.stopPropagation()}
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
                                        setIsSelectedState(false);
                                        props.onInputChange('');
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
                    classList={{ 'hidden': isSelectedState() || (props.options.length === 0 && !props.isLoading && (props.hideEmptyState || (props.value?.length ?? 0) < (props.minLength ?? 3))) }}
                    style={{
                        "width": triggerWidth() > 0 ? `${triggerWidth()}px` : "100%",
                        "max-width": triggerWidth() > 0 ? `${triggerWidth()}px` : "calc(100vw - 2rem)",
                    }}
                >
                    <Show 
                        when={props.options.length > 0} 
                        fallback={
                            <div class="p-4 text-center text-sm text-muted">
                                {props.isLoading ? (
                                    <div class="flex items-center justify-center gap-2">
                                        <svg class="animate-spin size-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Buscando...</span>
                                    </div>
                                ) : (
                                    'No se encontraron resultados.'
                                )}
                            </div>
                        }
                    >
                        <KCombobox.Listbox class={`max-h-[256px] overflow-y-auto outline-none p-1 bg-card text-text transition-opacity duration-200 ${props.isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100 pointer-events-auto'}`} />
                    </Show>
                </KCombobox.Content>
            </KCombobox.Portal>
        </KCombobox>
    );
};

export const Autocomplete = {
    Root,
    Label,
    Input,
    ErrorMessage,
    Description,
};
