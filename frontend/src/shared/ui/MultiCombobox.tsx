/**
 * MultiCombobox — Reusable multi-select combobox with tags.
 *
 * Compound component API mirroring Autocomplete.tsx but for multiple selection.
 * Uses Kobalte Combobox with `multiple` prop internally.
 *
 * Features:
 * - Selected items rendered as removable tags inside the control
 * - Search/filter input integrated alongside tags
 * - Clear-all button when items are selected
 * - Custom item rendering via `itemRenderer`
 * - "Create new" footer action via `onCreateNew`
 * - Responsive dropdown width matching trigger
 * - Full WAI-ARIA combobox pattern
 *
 * @example
 * <MultiCombobox.Root>
 *     <MultiCombobox.Label>Fruits</MultiCombobox.Label>
 *     <MultiCombobox.Input
 *         value={selectedFruits()}
 *         onChange={setSelectedFruits}
 *         options={allFruits()}
 *         optionValue={(f) => String(f.id)}
 *         optionLabel={(f) => f.name}
 *         placeholder="Search fruits..."
 *     />
 *     <MultiCombobox.ErrorMessage />
 * </MultiCombobox.Root>
 */
import { Show, For, createMemo, createContext, useContext, createUniqueId, JSX, createSignal, createEffect, onCleanup } from 'solid-js';
import { Combobox as KCombobox } from '@kobalte/core/combobox';
import { SearchIcon, XIcon, PlusIcon, CheckIcon } from './icons';
import type { FieldLike } from './form/form.types';
import { hasFieldError, getFieldError, FormSubmissionContext } from './form/form.types';
import Button from './Button';

// ============================================================================
// CONTEXT
// ============================================================================
type ValidationState = 'valid' | 'invalid';

interface MultiComboboxContextValue {
    id: string;
    validationState: () => ValidationState;
    errorMessage: () => string;
}

const MultiComboboxContext = createContext<MultiComboboxContextValue>();

const useMultiComboboxContext = () => {
    const context = useContext(MultiComboboxContext);
    if (!context) {
        throw new Error('MultiCombobox components must be used within MultiCombobox.Root');
    }
    return context;
};

// ============================================================================
// ROOT, LABEL, ERROR MESSAGE, DESCRIPTION
// ============================================================================
interface MultiComboboxRootProps {
    field?: FieldLike<any>;
    validationState?: ValidationState;
    class?: string;
    children: JSX.Element;
}

const Root = (props: MultiComboboxRootProps) => {
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
        <MultiComboboxContext.Provider value={{ id, validationState, errorMessage }}>
            <div
                class={`relative flex flex-col gap-1 ${props.class ?? ''}`}
                data-valid={validationState() !== 'invalid'}
                data-invalid={validationState() === 'invalid'}
            >
                {props.children}
            </div>
        </MultiComboboxContext.Provider>
    );
};

const Label = (props: { class?: string; children: JSX.Element }) => {
    const context = useMultiComboboxContext();
    return (
        <label
            for={context.id}
            class={`text-sm font-medium text-muted ml-1 w-fit ${props.class ?? ''}`}
        >
            {props.children}
        </label>
    );
};

const ErrorMessage = (props: { class?: string; children?: JSX.Element }) => {
    const context = useMultiComboboxContext();
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
// INPUT COMPONENT (KOBALTE COMBOBOX MULTI-SELECT WRAPPER)
// ============================================================================
export interface MultiComboboxInputProps<T> {
    value: T[];
    onChange: (items: T[]) => void;
    options: T[];
    optionValue: (option: T) => string;
    optionLabel: (option: T) => string;
    optionDescription?: (option: T) => string;
    itemRenderer?: (option: T, isSelected: boolean) => JSX.Element;
    tagRenderer?: (option: T, onRemove: () => void) => JSX.Element;
    onInputChange?: (value: string) => void;
    placeholder?: string;
    placeholderWhenSelected?: string;
    disabled?: boolean;
    isLoading?: boolean;
    class?: string;
    onCreateNew?: () => void;
    createNewLabel?: string;
}

const Input = <T,>(props: MultiComboboxInputProps<T>) => {
    const context = useMultiComboboxContext();

    let triggerRef: HTMLElement | undefined;
    const [triggerWidth, setTriggerWidth] = createSignal(0);

    createEffect(() => {
        if (!triggerRef) return;
        setTriggerWidth(triggerRef.offsetWidth);
        const ro = new ResizeObserver(() => {
            if (triggerRef) setTriggerWidth(triggerRef.offsetWidth);
        });
        ro.observe(triggerRef);
        onCleanup(() => ro.disconnect());
    });

    // Build a set of selected option values for quick lookup
    const selectedValueSet = createMemo(() =>
        new Set(props.value.map(v => props.optionValue(v)))
    );

    const originalOptionsSet = createMemo(() =>
        new Set((props.options || []).map(opt => props.optionValue(opt)))
    );

    const dynamicOptions = createMemo(() => {
        const selected = props.value || [];
        const opts = [...(props.options || [])];
        
        for (const item of selected) {
            const val = props.optionValue(item);
            if (!originalOptionsSet().has(val)) {
                opts.push(item);
            }
        }
        return opts;
    });

    return (
        <KCombobox<T>
            multiple
            class={`flex flex-col gap-1.5 ${props.class ?? ''}`}
            options={dynamicOptions()}
            validationState={context.validationState()}
            value={props.value}
            onChange={(items) => props.onChange(items)}
            onInputChange={(v) => props.onInputChange?.(v)}
            optionValue={(opt) => props.optionValue(opt)}
            optionTextValue={(opt) => props.optionLabel(opt)}
            optionLabel={(opt) => props.optionLabel(opt)}
            defaultFilter={() => true}
            disabled={props.disabled}
            placeholder={props.placeholder}
            itemComponent={(itemProps) => {
                const opt = itemProps.item.rawValue;
                const isSelected = () => selectedValueSet().has(props.optionValue(opt));
                const isHidden = () => isSelected() && !originalOptionsSet().has(props.optionValue(opt));

                if (props.itemRenderer) {
                    return (
                        <KCombobox.Item
                            item={itemProps.item}
                            class="relative flex w-full min-w-0 overflow-hidden cursor-pointer select-none items-center rounded-lg p-2 text-sm outline-none transition-colors duration-150 text-text-secondary data-highlighted:bg-primary-soft data-highlighted:text-primary-strong"
                            classList={{ 'hidden': isHidden() }}
                        >
                            {props.itemRenderer(opt, isSelected())}
                        </KCombobox.Item>
                    );
                }

                return (
                    <KCombobox.Item
                        item={itemProps.item}
                        class="relative flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors duration-150 cursor-pointer select-none text-text-secondary data-highlighted:bg-primary-soft data-highlighted:text-primary-strong"
                        classList={{ 'hidden': isHidden() }}
                    >
                        <KCombobox.ItemIndicator class="shrink-0">
                            <CheckIcon class="size-4 text-primary" />
                        </KCombobox.ItemIndicator>
                        <div class="flex flex-col min-w-0 flex-1" classList={{ 'ml-6': !isSelected() }}>
                            <span class="font-medium text-text truncate w-full">{props.optionLabel(opt)}</span>
                            <Show when={props.optionDescription}>
                                <span class="text-xs text-muted truncate w-full">{props.optionDescription!(opt)}</span>
                            </Show>
                        </div>
                    </KCombobox.Item>
                );
            }}
        >
            <KCombobox.Control<T>
                ref={triggerRef as any}
                class="group flex w-full flex-wrap items-center gap-1.5 cursor-text px-2.5 py-1.5 rounded-xl border transition-all duration-200 bg-card-alt border-border text-text hover:bg-card hover:border-border-strong focus-within:border-primary/65 focus-within:ring-2 focus-within:ring-primary/25 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-invalid:border-red-500/50 data-invalid:focus-within:ring-red-500/25 min-h-10"
            >
                {(state) => (
                    <>
                        {/* Selected tags */}
                        <For each={state.selectedOptions()}>
                            {(item) => {
                                const onRemove = () => state.remove(item);
                                if (props.tagRenderer) {
                                    return props.tagRenderer(item, onRemove);
                                }
                                return (
                                    <span
                                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-xs font-medium text-primary animate-in fade-in zoom-in-95 duration-150"
                                        onPointerDown={(e) => e.stopPropagation()}
                                    >
                                        {props.optionLabel(item)}
                                        <button
                                            type="button"
                                            class="size-3.5 flex items-center justify-center rounded-sm hover:bg-primary/20 transition-colors cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemove();
                                            }}
                                        >
                                            <XIcon class="size-2.5" strokeWidth={3} />
                                        </button>
                                    </span>
                                );
                            }}
                        </For>

                        {/* Search input */}
                        <KCombobox.Input
                            id={context.id}
                            class="flex-1 min-w-30 bg-transparent py-0.5 outline-none placeholder:text-muted text-text font-medium text-sm focus-visible:shadow-none"
                            placeholder={
                                state.selectedOptions().length > 0
                                    ? (props.placeholderWhenSelected ?? 'Agregar más...')
                                    : (props.placeholder ?? 'Buscar...')
                            }
                        />

                        {/* Right actions */}
                        <div class="ml-auto flex shrink-0 items-center gap-1 text-muted group-hover:text-text-secondary transition-colors">
                            <Show when={props.isLoading}>
                                <svg class="animate-spin size-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </Show>
                            <Show when={!props.isLoading}>
                                <Show when={state.selectedOptions().length > 0}>
                                    <button
                                        type="button"
                                        class="cursor-pointer hover:text-danger rounded-md p-0.5 transition-colors flex items-center justify-center border-0 bg-transparent outline-none focus:text-danger focus:ring-0"
                                        onPointerDown={(e) => e.preventDefault()}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            state.clear();
                                        }}
                                        title="Limpiar todo"
                                    >
                                        <XIcon class="size-3.5" strokeWidth={3} />
                                    </button>
                                </Show>
                                <KCombobox.Trigger class="cursor-pointer hover:text-primary transition-colors flex items-center justify-center p-0.5 rounded-md border-0 bg-transparent">
                                    <KCombobox.Icon>
                                        <SearchIcon class="size-4" />
                                    </KCombobox.Icon>
                                </KCombobox.Trigger>
                            </Show>
                        </div>
                    </>
                )}
            </KCombobox.Control>

            <KCombobox.Portal>
                <KCombobox.Content
                    class="relative z-100 min-w-32 overflow-hidden bg-card border border-border shadow-md rounded-xl p-1 transform-origin-var data-expanded:animate-in data-expanded:fade-in-0 data-expanded:zoom-in-95 data-expanded:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:slide-out-to-top-2"
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
                        <KCombobox.Listbox
                            class={`max-h-55 overflow-y-auto outline-none p-0.5 bg-card text-text transition-opacity duration-200 ${props.isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}
                        />
                    </Show>

                    {/* Footer: Create New */}
                    <Show when={props.onCreateNew}>
                        <div class="border-t border-border/50 p-1">
                            <Button
                                type="button"
                                variant="ghost"
                                class="flex w-full items-center justify-start gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:text-primary-strong hover:bg-primary-soft  cursor-pointer"
                                onPointerDown={(e) => e.preventDefault()}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    props.onCreateNew!();
                                }}
                                icon={<PlusIcon class="size-4" />}
                            >
                                {props.createNewLabel ?? 'Crear nuevo'}
                            </Button>
                        </div>
                    </Show>
                </KCombobox.Content>
            </KCombobox.Portal>
        </KCombobox>
    );
};

export const MultiCombobox = {
    Root,
    Label,
    Input,
    ErrorMessage,
    Description,
};
