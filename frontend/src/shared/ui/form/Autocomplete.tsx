import { Show, createMemo, createContext, useContext, createUniqueId, JSX, createEffect, on } from 'solid-js';
import { Combobox as KCombobox } from '@kobalte/core/combobox';
import { ChevronsUpDownIcon } from '@icons/ChevronsUpDownIcon';
import { CloseIcon } from '@icons/CloseIcon';
import { PlusIcon } from '@icons/PlusIcon';

import type { FieldLike } from '@form/form.types';
import { hasFieldError, getFieldError, FormSubmissionContext } from '@form/form.types';
import { cn } from '@shared/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
/**
 * After a selection, Kobalte fires onInputChange with the selected label
 * (echo effect). This guard window prevents consumers from overwriting
 * the just-confirmed value.
 */
const SELECTION_ECHO_GUARD_MS = 150;

const Spinner = (props: { class?: string }) => (
    <svg class={props.class} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Context (validation bridge with TanStack Form)
// ─────────────────────────────────────────────────────────────────────────────
type ValidationState = 'valid' | 'invalid';

interface AutocompleteContextValue {
    id: string;
    validationState: () => ValidationState;
    errorMessage: () => string;
}

const AutocompleteContext = createContext<AutocompleteContextValue>();

const useAutocompleteContext = () => {
    const ctx = useContext(AutocompleteContext);
    if (!ctx) throw new Error('Autocomplete components must be used within Autocomplete.Root');
    return ctx;
};

// ─────────────────────────────────────────────────────────────────────────────
// Root / Label / ErrorMessage / Description
// ─────────────────────────────────────────────────────────────────────────────
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
                class={cn('relative flex flex-col gap-1', props.class)}
                data-valid={validationState() !== 'invalid'}
                data-invalid={validationState() === 'invalid'}
            >
                {props.children}
            </div>
        </AutocompleteContext.Provider>
    );
};

const Label = (props: { class?: string; children: JSX.Element }) => {
    const ctx = useAutocompleteContext();
    return (
        <label
            for={ctx.id}
            class={cn('text-sm font-medium text-muted w-fit ml-1', props.class)}
        >
            {props.children}
        </label>
    );
};

const ErrorMessage = (props: { class?: string; children?: JSX.Element }) => {
    const ctx = useAutocompleteContext();
    const message = () => ctx.errorMessage() || props.children;
    return (
        <Show when={ctx.validationState() === 'invalid' && message()}>
            <small class={cn('absolute -bottom-3.5 left-1 text-xs leading-none text-danger font-medium animate-in fade-in slide-in-from-top-1', props.class)} role="alert">
                {message()}
            </small>
        </Show>
    );
};

const Description = (props: { class?: string; children: JSX.Element }) => (
    <span class={cn('text-xs text-muted mt-0.5', props.class)}>{props.children}</span>
);

// ─────────────────────────────────────────────────────────────────────────────
// Input (Kobalte Combobox wrapper)
// ─────────────────────────────────────────────────────────────────────────────
export interface AutocompleteInputProps<T> {
    /** Current text shown in the input (controlled). */
    value: string;
    /** Fires on every keystroke. */
    onInputChange: (value: string) => void;
    /** Array of options to display. Filtering is the consumer's responsibility. */
    options: T[];
    /** Unique key for each option (used internally by Kobalte). */
    optionValue: (option: T) => string;
    /** Display label for each option. */
    optionLabel: (option: T) => string;
    optionDescription?: (option: T) => string;
    itemRenderer?: (option: T) => JSX.Element;
    inputPrefix?: JSX.Element;
    /** Fires when user selects an option or clears. Receives null on clear. */
    onSelect?: (option: T | null) => void;
    placeholder?: string;
    disabled?: boolean;
    isLoading?: boolean;
    hideEmptyState?: boolean;
    class?: string;
    triggerClass?: string;
    inputClass?: string;
    contentClass?: string;
    itemClass?: string;
    onSearchAction?: (value: string) => void;
    minLength?: number;
    inputId?: string;
    onCreateNew?: () => void;
    createNewLabel?: string;
    onBlur?: () => void;
    /**
     * When the user blurs WITHOUT a valid selection:
     * - `true` (default): clears input and fires onSelect(null).
     * - `false`: keeps text as-is (free-text mode, e.g. SRI search).
     *
     * Internally delegates to Kobalte's `noResetInputOnBlur` prop.
     */
    clearOnBlur?: boolean;
    /**
     * Interaction mode to open the combobox menu.
     * Defaults to 'input' so menu opens on typing/interaction rather than focus re-entry.
     */
    triggerMode?: 'input' | 'focus' | 'manual';
}

const Input = <T,>(props: AutocompleteInputProps<T>) => {
    const ctx = useAutocompleteContext();
    let _lastSelectionTime = 0;
    let inputRef: HTMLInputElement | undefined;

    createEffect(on(() => props.value, (val) => {
        const nextVal = val ?? '';
        if (inputRef && inputRef.value !== nextVal) {
            inputRef.value = nextVal;
        }
    }, { defer: false }));

    // ── Derived state ────────────────────────────────────────────────────
    const safeOptions = createMemo(() => props.options || []);

    const matchedOption = createMemo<T | undefined>(() => {
        const val = props.value;
        if (!val) return undefined;
        return safeOptions().find(opt => props.optionLabel(opt) === val);
    });

    /**
     * Determines if the dropdown should be open based on content availability.
     * Kobalte's `allowsEmptyCollection` handles the base case, but we need
     * additional logic for loading states and minimum input length.
     */
    const shouldShowContent = createMemo(() => {
        if (props.isLoading) return true;
        if (props.onCreateNew) return true;
        if (safeOptions().length > 0) return true;
        if (props.hideEmptyState) return false;
        return (props.value?.length ?? 0) >= (props.minLength ?? 3);
    });

    const clearSelection = () => {
        props.onInputChange('');
        props.onSelect?.(null);
        if (inputRef) {
            inputRef.value = '';
        }
    };

    return (
        <KCombobox<T>
            class={cn('flex flex-col gap-1.5', props.class)}
            options={safeOptions()}
            validationState={ctx.validationState()}
            triggerMode={props.triggerMode ?? 'input'}
            sameWidth={true}
            closeOnSelection={true}
            allowsEmptyCollection={shouldShowContent()}
            noResetInputOnBlur={!(props.clearOnBlur ?? true)}
            value={matchedOption() ?? null}
            onInputChange={(v) => {
                // Guard against the echo: after selection, Kobalte fires
                // onInputChange with the selected label. Skip it.
                if (Date.now() - _lastSelectionTime < SELECTION_ECHO_GUARD_MS) return;
                props.onInputChange(v);
            }}
            // ── Selection ──
            onChange={(selected) => {
                if (!selected) {
                    clearSelection();
                    return;
                }
                _lastSelectionTime = Date.now();
                props.onSelect?.(selected);
            }}
            // ── Option accessors ──
            optionValue={props.optionValue}
            optionTextValue={props.optionLabel}
            optionLabel={props.optionLabel}
            // Consumer handles filtering — tell Kobalte to show all options
            defaultFilter={() => true}
            disabled={props.disabled}
            placeholder={props.placeholder}
            itemComponent={(itemProps) => {
                const opt = itemProps.item.rawValue;
                return (
                    <KCombobox.Item
                        item={itemProps.item}
                        class={cn("relative flex w-full min-w-0 overflow-hidden cursor-pointer select-none items-center justify-between rounded-lg p-2 text-sm outline-none transition-colors duration-150 text-text-secondary data-highlighted:bg-primary-soft data-highlighted:text-primary-strong data-selected:text-primary data-selected:font-medium", props.itemClass)}
                    >
                        <Show when={props.itemRenderer} fallback={
                            <div class="flex flex-col min-w-0 w-full">
                                <span class="font-medium text-text truncate w-full" title={props.optionLabel(opt)}>{props.optionLabel(opt)}</span>
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
                class={cn("group flex w-full items-center justify-between cursor-text px-3 rounded-xl border transition-all duration-200 bg-card-alt border-border text-text hover:bg-card hover:border-border-strong focus-within:border-primary/65 focus-within:ring-2 focus-within:ring-primary/25 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-invalid:border-red-500/50 data-invalid:focus-within:ring-red-500/25", props.triggerClass)}
            >
                <Show when={props.inputPrefix}>
                    <div class="mr-2 shrink-0">{props.inputPrefix}</div>
                </Show>
                <KCombobox.Input
                    ref={inputRef}
                    id={props.inputId || ctx.id}
                    placeholder={props.placeholder}
                    class={cn("flex-1 focus-visible:shadow-none bg-transparent py-1.5 outline-none placeholder:text-muted text-text font-medium min-w-0", matchedOption() ? 'cursor-default' : '', props.inputClass)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onFocus={(e) => e.currentTarget.select()}
                    onInput={(e) => {
                        if (e.isTrusted && props.onSearchAction) {
                            props.onSearchAction(e.currentTarget.value);
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && props.onSearchAction) {
                            props.onSearchAction(e.currentTarget.value);
                        }
                    }}
                    onBlur={() => {
                        props.onBlur?.();
                    }}
                />
                <div class="ml-2 flex shrink-0 items-center justify-center text-muted group-hover:text-text-secondary transition-colors h-full">
                    <Show when={props.isLoading}>
                        <Spinner class="animate-spin size-4 text-current" />
                    </Show>
                    <Show when={!props.isLoading}>
                        <Show
                            when={props.value}
                            fallback={
                                <KCombobox.Trigger
                                    class="cursor-pointer transition-colors flex items-center justify-center p-0.5 rounded-md border-0 bg-transparent"
                                    onClick={(e) => {
                                        if (props.onSearchAction) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            props.onSearchAction('');
                                        }
                                    }}
                                >
                                    <KCombobox.Icon class="size-4 flex items-center justify-center">
                                        <ChevronsUpDownIcon class="size-4" />
                                    </KCombobox.Icon>
                                </KCombobox.Trigger>
                            }
                        >
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
                                    clearSelection();
                                }}
                                title="Limpiar"
                            >
                                <CloseIcon class="size-3.5" strokeWidth={3} />
                            </button>
                        </Show>
                    </Show>
                </div>
            </KCombobox.Control>

            <KCombobox.Portal>
                <KCombobox.Content
                    class={cn("relative z-100 min-w-32 max-w-[calc(100vw-2rem)] overflow-hidden bg-card border border-border shadow-md rounded-xl p-1 transform-origin-var data-expanded:animate-in data-expanded:fade-in-0 data-expanded:zoom-in-95 data-expanded:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:slide-out-to-top-2", props.contentClass)}
                >
                    <Show
                        when={safeOptions().length > 0}
                        fallback={
                            <div class="p-4 text-center text-sm text-muted">
                                {props.isLoading ? (
                                    <div class="flex items-center justify-center gap-2">
                                        <Spinner class="animate-spin size-4 text-primary" />
                                        <span>Buscando...</span>
                                    </div>
                                ) : (
                                    'No se encontraron resultados.'
                                )}
                            </div>
                        }
                    >
                        <KCombobox.Listbox class={`max-h-64 overflow-y-auto outline-none p-1 bg-card text-text transition-opacity duration-200 ${props.isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100 pointer-events-auto'}`} />
                    </Show>
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