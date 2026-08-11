import { Show, createMemo, createContext, useContext, createUniqueId, JSX, createSignal, createEffect, onCleanup } from 'solid-js';
import { Combobox as KCombobox } from '@kobalte/core/combobox';
import { SearchIcon, XIcon, PlusIcon } from './icons';
import type { FieldLike } from './form/form.types';
import { hasFieldError, getFieldError, FormSubmissionContext } from './form/form.types';

// ============================================================================
// CONSTANTES
// ============================================================================
// Ventana para ignorar el onInputChange "eco" que Kobalte dispara justo
// después de confirmar una selección (evita pisar el valor recién elegido).
const SELECTION_ECHO_GUARD_MS = 150;
// Tiempo para distinguir un blur real de un blur causado por hacer click
// dentro del dropdown (item, botón "Crear nuevo", etc).
const BLUR_CLOSE_DELAY_MS = 150;
// Margen extra sobre BLUR_CLOSE_DELAY_MS para liberar `isClickingDropdown`
// después de "Crear nuevo", garantizando que el blur pendiente ya bail-eó.
const CREATE_NEW_UNLOCK_DELAY_MS = BLUR_CLOSE_DELAY_MS + 50;

// Este SVG estaba duplicado exacto en dos lugares (el ícono del Control y el
// fallback de "Buscando..." del Content). Si ya tenés un ícono de spinner en
// `./icons`, reemplazá esto por ese import en vez de mantener esta copia local.
const Spinner = (props: { class?: string }) => (
    <svg class={props.class} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

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
    /**
     * Si el usuario escribe texto libre y pierde el foco sin seleccionar
     * ninguna opción de la lista, controla qué pasa con ese texto:
     * - `true` (default): se limpia el input (onInputChange('') + onSelect(null)).
     * - `false`: se conserva tal cual lo dejó el usuario, sin disparar
     *   onInputChange ni onSelect.
     */
    clearOnBlur?: boolean;
}

const Input = <T,>(props: AutocompleteInputProps<T>) => {
    const context = useAutocompleteContext();
    let _lastSelectionTime = 0;
    let isClickingDropdown = false;

    let triggerRef: HTMLDivElement | undefined;
    const [triggerWidth, setTriggerWidth] = createSignal<number>(0);
    const [isFocused, setIsFocused] = createSignal<boolean>(false);
    const [isOpen, setIsOpen] = createSignal<boolean>(false);

    // FIX 1 (bug crítico): antes esta señal ("isSelectedState") se resolvía como
    // `!!props.value`, es decir "hay algo escrito" — no "lo que hay escrito
    // corresponde a una opción real". Eso hacía imposible distinguir texto libre
    // sin seleccionar de una selección confirmada, que es justo lo que necesitamos
    // para poder limpiar el input al perder el foco sin selección válida.
    const [hasValidSelection, setHasValidSelection] = createSignal<boolean>(!!props.value);

    // Sincroniza cuando el valor llega desde afuera (ej. formulario precargado
    // en modo edición) y el usuario no está escribiendo activamente.
    createEffect(() => {
        const val = props.value;
        if (!isFocused()) {
            setHasValidSelection(!!val);
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

    const safeOptions = createMemo(() => props.options || []);

    // Fuente única de "¿el valor actual matchea una opción real?" — antes
    // dynamicOptions (con .some) y selectedItem (con .find) repetían el mismo
    // predicado y recorrían props.options cada uno por su lado.
    const matchedOption = createMemo<T | undefined>(() => {
        const val = props.value;
        if (!val) return undefined;
        // NOTA: se matchea por optionValue O optionLabel a propósito. Algunos
        // consumidores (ej. el selector de Marca) pasan como `value` el texto
        // visible, no el id, y dependen del match por label. Si tus opciones
        // pueden repetir label, esto puede matchear la opción equivocada —
        // preferí IDs únicos en optionValue/value cuando puedas.
        return safeOptions().find(
            opt => props.optionValue(opt) === val || props.optionLabel(opt) === val
        );
    });

    const dynamicOptions = createMemo<Array<T | string>>(() => {
        const val = props.value;
        const opts: Array<T | string> = [...safeOptions()];
        if (val && !matchedOption()) {
            opts.push(val);
        }
        return opts;
    });

    const selectedItem = createMemo<T | string | null>(() => {
        const val = props.value;
        if (!val) return null;
        return matchedOption() ?? val;
    });

    // FIX 4 (accesibilidad): antes el Content se ocultaba solo con una clase
    // CSS (`classList hidden`) mientras `open` seguía en `true`, así que
    // Kobalte reportaba `aria-expanded="true"` con contenido invisible para
    // lectores de pantalla. Ahora esta misma condición controla el `open`
    // real del combobox, no solo su apariencia.
    const shouldShowContent = createMemo(() => {
        if (props.isLoading) return true;
        if (props.onCreateNew) return true;
        if (safeOptions().length > 0) return true;
        if (props.hideEmptyState) return false;
        return (props.value?.length ?? 0) >= (props.minLength ?? 3);
    });

    // Si mientras está abierto deja de haber algo que mostrar (ej. el usuario
    // borró letras y quedó por debajo de minLength), lo cerramos de verdad.
    createEffect(() => {
        if (isOpen() && !shouldShowContent()) {
            setIsOpen(false);
        }
    });

    // Único punto que define "qué significa limpiar la selección". Antes este
    // mismo par de llamadas (onInputChange('') + onSelect(null)) estaba
    // repetido en 3 lugares: el onChange de Kobalte cuando selected es null,
    // el botón "X" de limpiar, y el blur sin selección válida.
    const clearSelection = () => {
        props.onInputChange('');
        if (props.onSelect) {
            props.onSelect(null as any);
        }
    };

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
                } else if ((isFocused() || isClickingDropdown) && shouldShowContent()) {
                    setIsOpen(true);
                }
            }}
            onInputChange={(v) => {
                if (Date.now() - _lastSelectionTime < SELECTION_ECHO_GUARD_MS) return;
                if (props.value !== v) {
                    setHasValidSelection(false);
                }
                props.onInputChange(v);
            }}
            value={selectedItem()}
            onChange={(selected) => {
                isClickingDropdown = false;
                if (!selected) {
                    setHasValidSelection(false);
                    clearSelection();
                    return;
                }
                if (typeof selected === 'string') {
                    props.onInputChange(selected);
                } else {
                    setHasValidSelection(true);
                    _lastSelectionTime = Date.now();
                    if (props.onSelect) {
                        props.onSelect(selected);
                    }
                }
            }}
            optionValue={(opt) => (typeof opt === 'string' ? opt : props.optionValue(opt))}
            optionTextValue={(opt) => (typeof opt === 'string' ? opt : props.optionLabel(opt))}
            optionLabel={(opt) => (typeof opt === 'string' ? opt : props.optionLabel(opt))}
            // FIX 2 (bug crítico de datos): se eliminó el escapado manual de
            // comillas (`.replace(/"/g, "&quot;")`). JSX ya escapa texto al
            // renderizar, así que ese reemplazo no protegía nada — en cambio
            // corrompía el valor real para cualquier opción con `"` (ej. `Perno
            // 1/2"` en tu catálogo de fasteners), guardando literalmente
          //  "Perno 1/2&quot;" como value/label. Si en algún momento agregaste
            // eso por un bug puntual de Kobalte con comillas en el value,
            // resolvelo generando una key sintética estable en vez de tocar
            // el string de negocio.
            optionDisabled={(opt) => typeof opt === 'string'}
            defaultFilter={() => true}
            disabled={props.disabled}
            placeholder={props.placeholder}
            itemComponent={(itemProps) => {
                const opt = itemProps.item.rawValue;
                if (typeof opt === 'string') {
                    // FIX 3 (accesibilidad/teclado): además del `class="hidden"`,
                    // ahora se marca `optionDisabled` arriba para que Kobalte lo
                    // excluya de la navegación con flechas. Antes este item
                    // "fantasma" (el texto libre que no matchea ninguna opción
                    // real) seguía siendo foco-navegable con el teclado aunque
                    // fuera invisible.
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
                ref={triggerRef}
                class="group flex w-full items-center justify-between cursor-text px-3 rounded-xl border transition-all duration-200 bg-card-alt border-border text-text hover:bg-card hover:border-border-strong focus-within:border-primary/65 focus-within:ring-2 focus-within:ring-primary/25 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-invalid:border-red-500/50 data-invalid:focus-within:ring-red-500/25"
            >
                <Show when={props.inputPrefix}>
                    <div class="mr-2 shrink-0">{props.inputPrefix}</div>
                </Show>
                <KCombobox.Input
                    id={props.inputId || context.id}
                    placeholder={props.placeholder}
                    class={`flex-1 focus-visible:shadow-none bg-transparent py-1.5 outline-none placeholder:text-muted text-text font-medium min-w-0 ${hasValidSelection() ? 'cursor-default' : ''}`}
                    onPointerDown={(e) => {
                        e.stopPropagation();
                    }}
                    onFocus={(e) => {
                        isClickingDropdown = false;
                        setIsFocused(true);
                        e.currentTarget.select();
                    }}
                    onBlur={() => {
                        setTimeout(() => {
                            if (isClickingDropdown) return;

                            // Si al perder el foco el texto actual no corresponde
                            // a una selección real, limpiamos el campo — salvo que
                            // el consumidor haya pedido explícitamente conservarlo
                            // con `clearOnBlur={false}`. Se chequea
                            // `hasValidSelection()` en vez de la membresía en
                            // `props.options`, porque en combos con búsqueda async
                            // (ej. SRI) la lista de opciones puede vaciarse/cambiar
                            // después de seleccionar, y comparar contra
                            // `props.options` en ese momento daría falsos negativos.
                            const shouldClear = props.clearOnBlur ?? true;
                            if (shouldClear && props.value && !hasValidSelection()) {
                                clearSelection();
                            }

                            setIsFocused(false);
                            if (props.onBlur) {
                                props.onBlur();
                            }
                        }, BLUR_CLOSE_DELAY_MS);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && props.onSearchAction) {
                            props.onSearchAction();
                        }
                    }}
                />
                <div class="ml-2 flex shrink-0 items-center justify-center gap-1.5 text-muted group-hover:text-text-secondary transition-colors h-full">
                    <Show when={props.isLoading}>
                        <Spinner class="animate-spin size-4 text-current" />
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
                                    setHasValidSelection(false);
                                    setIsOpen(false);
                                    clearSelection();
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
                    style={{
                        "width": triggerWidth() > 0 ? `${triggerWidth()}px` : "100%",
                        "max-width": triggerWidth() > 0 ? `${triggerWidth()}px` : "calc(100vw - 2rem)",
                    }}
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
                                    setTimeout(() => {
                                        isClickingDropdown = false;
                                    }, CREATE_NEW_UNLOCK_DELAY_MS);
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