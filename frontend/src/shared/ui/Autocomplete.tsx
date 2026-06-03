import { Show, createMemo, createContext, useContext, createUniqueId, JSX, createSignal, createEffect, onCleanup } from 'solid-js';
import { Combobox as KCombobox } from '@kobalte/core/combobox';
import { SearchIcon, XIcon, PlusIcon } from './icons';
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
            class={`text-sm font-medium text-muted w-fit ml-1 ${props.class ?? ''}`}
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
    onCreateNew?: () => void;
    createNewLabel?: string;
    onBlur?: () => void;
}

const Input = <T,>(props: AutocompleteInputProps<T>) => {
    const context = useAutocompleteContext();
    let _lastSelectionTime = 0;
    let isClickingDropdown = false;
    
    let triggerRef: HTMLElement | undefined;
    const [triggerWidth, setTriggerWidth] = createSignal<number>(0);
    const [isSelectedState, setIsSelectedState] = createSignal<boolean>(!!props.value);
    const [isFocused, setIsFocused] = createSignal<boolean>(false);
    const [isOpen, setIsOpen] = createSignal<boolean>(false);
    
    createEffect(() => {
        if (!isFocused()) {
            setIsSelectedState(!!props.value);
        }
    });
    
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
        const opts: Array<T | string> = [...(props.options || [])];
        if (val) {
            const exists = (props.options || []).some(
                opt => props.optionValue(opt) === val || props.optionLabel(opt) === val
            );
            if (!exists) {
                opts.push(val);
            }
        }
        return opts;
    });

    const selectedItem = createMemo<T | string | null>(() => {
        const val = props.value;
        if (!val) return null;
        const found = (props.options || []).find(
            opt => props.optionValue(opt) === val || props.optionLabel(opt) === val
        );
        return found ?? val;
    });

    return (
        <KCombobox<T | string>
            class={`flex flex-col gap-1.5 ${props.class ?? ''}`}
            options={dynamicOptions()}
            validationState={context.validationState()}
            open={isOpen()}
            onOpenChange={(open) => {
                if (!open) {
                    setIsOpen(false);
                    isClickingDropdown = false;
                    setIsFocused(false);
                } else {
                    if (isFocused() || isClickingDropdown) {
                        setIsOpen(true);
                    }
                }
            }}
            onInputChange={(v) => {
                if (Date.now() - _lastSelectionTime < 150) return;
                if (props.value !== v) {
                    setIsSelectedState(false);
                }
                props.onInputChange(v);
            }}
            value={selectedItem()}
            onChange={(selected) => {
                isClickingDropdown = false;
                if (!selected) {
                    setIsSelectedState(false);
                    props.onInputChange('');
                    if (props.onSelect) {
                        props.onSelect(null as any);
                    }
                    return;
                }
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
                        class="relative flex w-full min-w-0 overflow-hidden cursor-pointer select-none items-center justify-between rounded-lg p-2 text-sm outline-none transition-colors duration-150 text-text-secondary data-highlighted:bg-primary-soft data-highlighted:text-primary-strong data-selected:text-primary data-selected:font-medium"
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
            <KCombobox.Control
                ref={triggerRef as any}
                class="group flex w-full items-center justify-between cursor-text px-3 rounded-xl border transition-all duration-200 bg-card-alt border-border text-text hover:bg-card hover:border-border-strong focus-within:border-primary/65 focus-within:ring-2 focus-within:ring-primary/25 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-invalid:border-red-500/50 data-invalid:focus-within:ring-red-500/25"
            >
                <Show when={props.inputPrefix}>
                    <div class="mr-2 shrink-0">{props.inputPrefix}</div>
                </Show>
                <KCombobox.Input 
                    id={props.inputId || context.id}
                    placeholder={props.placeholder}
                    class={`flex-1 focus-visible:shadow-none bg-transparent py-1.5 outline-none placeholder:text-muted text-text font-medium min-w-0 ${isSelectedState() ? 'cursor-default' : ''}`}
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        setIsSelectedState(false);
                    }}
                    onFocus={(e) => {
                        isClickingDropdown = false;
                        setIsFocused(true);
                        e.currentTarget.select();
                        setIsSelectedState(false);
                    }}
                    onBlur={() => {
                        setTimeout(() => {
                            if (isClickingDropdown) return;
                            setIsFocused(false);
                            if (props.onBlur) {
                                props.onBlur();
                            }
                            setIsSelectedState(!!props.value);
                        }, 150);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && props.onSearchAction) {
                            props.onSearchAction();
                        }
                    }}
                />
                <div class="ml-2 flex shrink-0 items-center justify-center gap-1.5 text-muted group-hover:text-text-secondary transition-colors h-full">
                    <Show when={props.isLoading}>
                        <svg class="animate-spin size-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </Show>
                    <Show when={!props.isLoading}>
                        <Show when={props.value}>
                            <button 
                                type="button"
                                class="cursor-pointer hover:text-danger rounded-md p-0.5 transition-colors flex items-center justify-center border-0 bg-transparent outline-none focus:text-danger focus:ring-0"
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    isClickingDropdown = false;
                                    setIsSelectedState(false);
                                    setIsOpen(false);
                                    props.onInputChange('');
                                    if (props.onSelect) {
                                        props.onSelect(null as any); 
                                    }
                                }}
                                title="Limpiar"
                            >
                                <XIcon class="size-3.5" strokeWidth={3} />
                            </button>
                        </Show>
                        <KCombobox.Trigger 
                            class="cursor-pointer hover:text-primary transition-colors flex items-center justify-center p-0.5 rounded-md border-0 bg-transparent"
                            onPointerDown={() => {
                                isClickingDropdown = true;
                            }}
                            onClick={(e) => {
                                if (!props.value && props.onSearchAction) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    props.onSearchAction();
                                }
                            }}
                        >
                            <Show when={props.value} fallback={<SearchIcon class="size-4" />}>
                                <KCombobox.Icon class="size-4 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="size-4 text-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </KCombobox.Icon>
                            </Show>
                        </KCombobox.Trigger>
                    </Show>
                </div>
            </KCombobox.Control>

            <KCombobox.Portal>
                <KCombobox.Content 
                    ref={(el) => {
                        if (el) {
                            el.addEventListener('pointerdown', () => {
                                isClickingDropdown = true;
                            });
                        }
                    }}
                    class="relative z-100 min-w-32 overflow-hidden bg-card border border-border shadow-md rounded-xl p-1 transform-origin-var data-expanded:animate-in data-expanded:fade-in-0 data-expanded:zoom-in-95 data-expanded:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:slide-out-to-top-2"
                    classList={{ 'hidden': ((props.options || []).length === 0 && !props.onCreateNew && !props.isLoading && (props.hideEmptyState || (props.value?.length ?? 0) < (props.minLength ?? 3))) }}
                    style={{
                        "width": triggerWidth() > 0 ? `${triggerWidth()}px` : "100%",
                        "max-width": triggerWidth() > 0 ? `${triggerWidth()}px` : "calc(100vw - 2rem)",
                    }}
                >
                    <Show 
                        when={(props.options || []).length > 0} 
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
                    {/* Footer: Create New button */}
                    <Show when={props.onCreateNew}>
                        <div class="border-t border-border/50 p-1">
                            <button
                                type="button"
                                class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-primary-soft transition-colors cursor-pointer"
                                onPointerDown={(e) => e.preventDefault()}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    props.onCreateNew!();
                                }}
                            >
                                <PlusIcon class="size-4" />
                                {props.createNewLabel ?? 'Crear nuevo'}
                            </button>
                        </div>
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
