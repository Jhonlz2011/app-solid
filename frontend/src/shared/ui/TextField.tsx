import { splitProps, Show, JSX, createUniqueId, createMemo, createSignal, createEffect } from 'solid-js';
import type { FieldLike } from './form/form.types';
import { hasFieldError, getFieldError, FormSubmissionContext } from './form/form.types';
import { EyeIcon, EyeOffIcon } from './icons';

// ============================================================================
// TYPES
// ============================================================================
type ValidationState = 'valid' | 'invalid';

interface TextFieldRootProps {
    /** TanStack Form field - accepts any field type (string, number, undefined presentations) */
    field?: FieldLike<any>;
    /** Current value (controlled) - ignored if field is provided */
    value?: string;
    /** Default value (uncontrolled) */
    defaultValue?: string;
    /** Change handler - ignored if field is provided */
    onChange?: (value: string) => void;
    /** Validation state for styling - auto-detected from field if provided */
    validationState?: ValidationState;
    /** Disable the field */
    disabled?: boolean;
    /** Read-only mode */
    readOnly?: boolean;
    /** Additional classes */
    class?: string;
    /** Children (Label, Input, ErrorMessage) */
    children: JSX.Element;
}

interface TextFieldLabelProps {
    class?: string;
    children: JSX.Element;
}

interface TextFieldInputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    class?: string;
    
}

interface TextFieldTextAreaProps extends Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
    class?: string;
}

interface TextFieldPasswordInputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
    class?: string;
}

interface TextFieldNumericInputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'inputMode'> {
    class?: string;
    /** Whether to allow negative numbers. Default: false */
    allowNegative?: boolean;
    /** Whether to allow decimals. Default: true */
    allowDecimal?: boolean;
}

interface TextFieldErrorMessageProps {
    class?: string;
    children?: JSX.Element;
}

interface TextFieldDescriptionProps {
    class?: string;
    children: JSX.Element;
}

// ============================================================================
// CONTEXT
// ============================================================================
import { createContext, useContext } from 'solid-js';

interface TextFieldContextValue {
    id: string;
    value: () => string;
    /** Receives raw string from input; for TanStack Form fields, numeric coercion happens in Input */
    onChange: (value: any) => void;
    onBlur: () => void;
    validationState: () => ValidationState;
    disabled: () => boolean;
    readOnly: () => boolean;
    errorMessage: () => string;
}

const TextFieldContext = createContext<TextFieldContextValue>();

const useTextFieldContext = () => {
    const context = useContext(TextFieldContext);
    if (!context) {
        throw new Error('TextField components must be used within TextField.Root');
    }
    return context;
};

// ============================================================================
// INPUT STYLES (shared)
// ============================================================================
const inputBaseStyles = `
    w-full bg-card-alt border border-border text-text 
    rounded-xl px-4 py-1.5 outline-none 
    hover:border-border-strong hover:bg-card
    focus:border-primary/65 focus:ring-2 focus:ring-primary/25
    disabled:cursor-not-allowed disabled:opacity-50
    data-[invalid=true]:border-red-500/50 data-[invalid=true]:focus:ring-red-500/25
`;

// ============================================================================
// COMPONENTS
// ============================================================================

/** Root container - provides context to children */
const Root = (props: TextFieldRootProps) => {
    const [local, others] = splitProps(props, [
        'field',
        'value',
        'defaultValue',
        'onChange',
        'validationState',
        'disabled',
        'readOnly',
        'class',
        'children',
    ]);

    const id = createUniqueId();
    let internalValue = local.defaultValue ?? '';
    
    // Track form submission state explicitly
    const isFormSubmitted = useContext(FormSubmissionContext);

    // Determine if controlled by TanStack Form field
    const hasField = () => !!local.field;

    // Reactive value: from field or props — coerce to string for display
    const value = createMemo(() => {
        if (hasField()) {
            const v = local.field!.state.value;
            return v == null ? '' : String(v);
        }
        return local.value ?? internalValue;
    });

    // Validation state: from field or props
    const validationState = createMemo((): ValidationState => {
        if (hasField() && hasFieldError(local.field!, isFormSubmitted())) return 'invalid';
        return local.validationState ?? 'valid';
    });

    // Error message (only from field)
    const errorMessage = createMemo(() => {
        if (hasField()) return getFieldError(local.field!);
        return '';
    });

    const contextValue: TextFieldContextValue = {
        id,
        value,
        onChange: (newValue: string) => {
            if (hasField()) {
                local.field!.handleChange(newValue as any);
            } else {
                internalValue = newValue;
                local.onChange?.(newValue);
            }
        },
        onBlur: () => {
            if (hasField()) {
                local.field!.handleBlur();
            }
        },
        validationState,
        disabled: () => local.disabled ?? false,
        readOnly: () => local.readOnly ?? false,
        errorMessage,
    };

    return (
        <TextFieldContext.Provider value={contextValue}>
            <div
                class={`relative flex flex-col gap-1 ${local.class ?? ''}`}
                data-valid={validationState() !== 'invalid'}
                data-invalid={validationState() === 'invalid'}
            >
                {local.children}
            </div>
        </TextFieldContext.Provider>
    );
};

/** Label for the field */
const Label = (props: TextFieldLabelProps) => {
    const context = useTextFieldContext();
    const [local, others] = splitProps(props, ['class', 'children']);

    return (
        <label
            for={context.id}
            class={`text-sm font-medium text-muted ml-1 ${local.class ?? ''}`}
            {...others}
        >
            {local.children}
        </label>
    );
};

/** Standalone label for non-TextField contexts (Select, SegmentedControl, etc.) */
export const FieldLabel = (props: { class?: string; children: JSX.Element }) => {
    const [local, others] = splitProps(props, ['class', 'children']);
    return (
        <label
            class={`text-sm font-medium text-muted ml-1 block ${local.class ?? ''}`}
            {...others}
        >
            {local.children}
        </label>
    );
};

/** Text input — coerces to number when type="number" for TanStack Form compatibility */
const Input = (props: TextFieldInputProps) => {
    const context = useTextFieldContext();
    const [local, others] = splitProps(props, ['class', 'type']);

    const handleInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
        const raw = e.currentTarget.value;
        if (local.type === 'number') {
            // For number inputs: pass actual number (or null for empty) to TanStack Form
            if (raw === '' || raw == null) {
                context.onChange(null as any);
            } else {
                const num = Number(raw);
                context.onChange(isNaN(num) ? raw : num);
            }
        } else {
            context.onChange(raw);
        }
    };

    return (
        <input
            id={context.id}
            type={local.type}
            value={context.value()}
            onInput={handleInput}
            onBlur={() => context.onBlur()}
            disabled={context.disabled()}
            readOnly={context.readOnly()}
            data-invalid={context.validationState() === 'invalid'}
            class={`${inputBaseStyles} ${local.class ?? ''}`}
            {...others}
        />
    );
};

/** Text password input with toggle */
const PasswordInput = (props: TextFieldPasswordInputProps) => {
    const context = useTextFieldContext();
    const [local, others] = splitProps(props, ['class']);
    const [showPassword, setShowPassword] = createSignal(false);

    return (
        <div class="relative w-full">
            <input
                id={context.id}
                type={showPassword() ? 'text' : 'password'}
                value={context.value()}
                onInput={(e) => context.onChange(e.currentTarget.value)}
                onBlur={() => context.onBlur()}
                disabled={context.disabled()}
                readOnly={context.readOnly()}
                data-invalid={context.validationState() === 'invalid'}
                class={`${inputBaseStyles} pr-12 ${local.class ?? ''}`}
                {...others}
            />
            <button
                type="button"
                onClick={() => setShowPassword(!showPassword())}
                disabled={context.disabled()}
                class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-heading transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                tabIndex={-1}
            >
                <Show when={showPassword()} fallback={<EyeIcon class="size-5" />}>
                    <EyeOffIcon class="size-5" />
                </Show>
            </button>
        </div>
    );
};

/** 
 * Numeric input - uses type="text" with inputMode="decimal" to allow native dot/comma typing.
 * Robustly prevents typing letters and normalizes output to numbers.
 */
const NumericInput = (props: TextFieldNumericInputProps) => {
    const context = useTextFieldContext();
    const [local, others] = splitProps(props, ['class', 'allowNegative', 'allowDecimal']);
    const [inputValue, setInputValue] = createSignal("");
    const [isTyping, setIsTyping] = createSignal(false);

    // Sync from context to local input ONLY when not typing
    createEffect(() => {
        const val = context.value();
        if (!isTyping()) {
            setInputValue(val == null ? '' : String(val));
        }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
        if (
            ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) ||
            e.ctrlKey || e.metaKey || e.altKey
        ) {
            return;
        }

        const allowDecimal = local.allowDecimal !== false;
        const allowNegative = local.allowNegative === true;

        const isNumber = /^[0-9]$/.test(e.key);
        const isDecimal = allowDecimal && (e.key === '.' || e.key === ',');
        const isNegative = allowNegative && e.key === '-';

        if (!isNumber && !isDecimal && !isNegative) {
            e.preventDefault();
            return;
        }

        if (isDecimal) {
            const el = e.currentTarget as HTMLInputElement;
            const val = el.value;
            const hasDecimal = val.includes('.') || val.includes(',');
            if (hasDecimal) {
                // Permitir si se está sobreescribiendo el decimal existente
                const selected = val.substring(el.selectionStart || 0, el.selectionEnd || 0);
                if (!selected.includes('.') && !selected.includes(',')) {
                    e.preventDefault();
                }
            }
        }
    };

    const handleInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
        let raw = e.currentTarget.value;
        
        // Strip out invalid characters on paste
        const allowDecimal = local.allowDecimal !== false;
        const allowNegative = local.allowNegative === true;
        
        let pattern = '[^0-9';
        if (allowDecimal) pattern += '\\.,';
        if (allowNegative) pattern += '\\-';
        pattern += ']';
        
        const regex = new RegExp(pattern, 'g');
        raw = raw.replace(regex, '');

        if (allowDecimal) {
            // Unificar temporalmente y asegurar un solo separador
            const parts = raw.split(/[\.,]/);
            if (parts.length > 2) {
                // Si hay múltiples, conservar solo el primer separador que el usuario escribió
                const firstSep = raw.match(/[\.,]/)?.[0] || '.';
                raw = parts[0] + firstSep + parts.slice(1).join('');
            }
        }

        // Normalize comma to dot for parsing
        const normalized = raw.replace(',', '.');
        setInputValue(raw);
        
        if (normalized === '' || normalized === '-' || normalized === '.') {
            context.onChange(null as any);
        } else {
            const num = parseFloat(normalized);
            // Si el usuario pone "1.", parseFloat da "1". Devolvemos raw para no perder el punto.
            context.onChange(isNaN(num) || raw.endsWith('.') || raw.endsWith(',') ? normalized : num);
        }
    };

    return (
        <input
            id={context.id}
            type="text"
            inputMode="decimal"
            value={inputValue()}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onFocus={() => setIsTyping(true)}
            onBlur={() => {
                setIsTyping(false);
                context.onBlur();
            }}
            disabled={context.disabled()}
            readOnly={context.readOnly()}
            data-invalid={context.validationState() === 'invalid'}
            class={`${inputBaseStyles} font-mono ${local.class ?? ''}`}
            {...others}
        />
    );
};

/** Textarea for multi-line input */
const TextArea = (props: TextFieldTextAreaProps) => {
    const context = useTextFieldContext();
    const [local, others] = splitProps(props, ['class']);

    return (
        <textarea
            id={context.id}
            value={context.value()}
            onInput={(e) => context.onChange(e.currentTarget.value)}
            onBlur={() => context.onBlur()}
            disabled={context.disabled()}
            readOnly={context.readOnly()}
            data-invalid={context.validationState() === 'invalid'}
            class={`${inputBaseStyles} resize-y py-3 ${local.class ?? ''}`}
            {...others}
        />
    );
};

/** Error message - shows from field or children */
const ErrorMessage = (props: TextFieldErrorMessageProps) => {
    const context = useTextFieldContext();
    const [local, others] = splitProps(props, ['class', 'children']);

    // Use field error if available, otherwise use children
    const message = () => context.errorMessage() || local.children;

    return (
        <Show when={context.validationState() === 'invalid' && message()}>
            <small
                class={`absolute -bottom-3.5 left-1 text-xs leading-none text-danger font-medium animate-in fade-in slide-in-from-top-1 ${local.class ?? ''}`}
                role="alert"
                {...others}
            >
                {message()}
            </small>
        </Show>
    );
};

/** Description/helper text */
const Description = (props: TextFieldDescriptionProps) => {
    const [local, others] = splitProps(props, ['class', 'children']);

    return (
        <span
            class={`text-xs text-muted mt-0.5 ${local.class ?? ''}`}
            {...others}
        >
            {local.children}
        </span>
    );
};

// ============================================================================
// EXPORTS (compound component pattern)
// ============================================================================
export const TextField = {
    Root,
    Label,
    Input,
    NumericInput,
    PasswordInput,
    TextArea,
    ErrorMessage,
    Description,
};

export default TextField;
