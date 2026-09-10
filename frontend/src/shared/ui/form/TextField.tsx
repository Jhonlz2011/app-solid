import { splitProps, Show, JSX, createUniqueId, createMemo, createSignal, createEffect, createContext, useContext, children, type Accessor } from 'solid-js';
import { cn } from '@shared/lib/utils';
import type { FieldLike } from '@form/form.types';
import { hasFieldError, getFieldError, FormSubmissionContext } from '@form/form.types';
import { EyeIcon } from '@icons/EyeIcon';
import { EyeOffIcon } from '@icons/EyeOffIcon';
import { InfoIcon } from '@icons/InfoIcon';
import { SpinnerIcon } from '@icons/SpinnerIcon';
import Tooltip from '@overlay/Tooltip';
import { Badge } from '@shared/ui/display/Badge';

// ============================================================================
// TYPES
// ============================================================================
type ValidationState = 'valid' | 'invalid';

export interface TextFieldRootProps<TValue extends string | number | undefined | null = string | number | undefined | null> {
    /** TanStack Form field - 100% type-safe generic binding (accepts field object or accessor) */
    field?: FieldLike<TValue> | Accessor<FieldLike<TValue> | undefined>;
    /** Current value (controlled) - ignored if field is provided */
    value?: string | number | null;
    /** Default value (uncontrolled) */
    defaultValue?: string | number | null;
    /** Change handler - ignored if field is provided */
    onChange?: (value: string) => void;
    /** Validation state for styling - auto-detected from field if provided */
    validationState?: ValidationState;
    /** Disable the field */
    disabled?: boolean;
    /** Read-only mode */
    readOnly?: boolean;
    /** Loading state */
    loading?: boolean;
    /** Additional classes */
    class?: string;
    /** Children (Label, Input, ErrorMessage) */
    children: JSX.Element;
}

export interface TextFieldLabelProps {
    class?: string;
    labelClass?: string;
    children: JSX.Element;
    tooltip?: string | JSX.Element;
    tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right';
    optional?: boolean;
    badge?: JSX.Element | (() => JSX.Element);
    /** If true, aligns badge to the right via justify-between. Default: true when badge is present. */
    alignBadgeRight?: boolean;
}

export interface FieldLabelProps {
    class?: string;
    labelClass?: string;
    children: JSX.Element;
    tooltip?: string | JSX.Element;
    tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right';
    optional?: boolean;
    badge?: JSX.Element | (() => JSX.Element);
    /** If true, aligns badge to the right via justify-between. Default: true when badge is present. */
    alignBadgeRight?: boolean;
}

export interface TextFieldInputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    class?: string;
    loading?: boolean;
    rightIcon?: JSX.Element;
    leftIcon?: JSX.Element;
    onInput?: JSX.EventHandlerUnion<HTMLInputElement, InputEvent>;
}

interface TextFieldTextAreaProps extends Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
    class?: string;
}

interface TextFieldPasswordInputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
    class?: string;
    loading?: boolean;
    leftIcon?: JSX.Element;
}

interface TextFieldNumericInputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'inputMode'> {
    class?: string;
    /** Whether to allow negative numbers. Default: false */
    allowNegative?: boolean;
    /** Whether to allow decimals. Default: true */
    allowDecimal?: boolean;
    loading?: boolean;
    rightIcon?: JSX.Element;
    leftIcon?: JSX.Element;
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
interface TextFieldContextValue {
    id: string;
    value: () => string;
    /** Receives raw string from input; for TanStack Form fields, numeric coercion happens in Input */
    onChange: (value: any) => void;
    onBlur: () => void;
    validationState: () => ValidationState;
    isInvalid: () => boolean;
    disabled: () => boolean;
    readOnly: () => boolean;
    loading: () => boolean;
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
const Root = <TValue extends string | number | undefined | null = string | number | undefined | null>(
    props: TextFieldRootProps<TValue>
) => {
    const [local, others] = splitProps(props, [
        'field',
        'value',
        'defaultValue',
        'onChange',
        'validationState',
        'disabled',
        'readOnly',
        'loading',
        'class',
        'children',
    ]);

    const id = createUniqueId();
    const [uncontrolledValue, setUncontrolledValue] = createSignal(
        local.defaultValue != null ? String(local.defaultValue) : ''
    );
    
    // Track form submission state explicitly
    const isFormSubmitted = useContext(FormSubmissionContext);

    // Resolves field whether provided as raw FieldLike object or Accessor<FieldLike>
    const getField = (): FieldLike<TValue> | undefined => {
        if (!local.field) return undefined;
        return typeof local.field === 'function'
            ? (local.field as Accessor<FieldLike<TValue> | undefined>)()
            : local.field;
    };

    const hasField = () => !!getField();

    // Reactive value: from field, controlled prop, or internal uncontrolled signal
    const value = createMemo(() => {
        const f = getField();
        if (f) {
            const v = f.state.value;
            return v == null ? '' : String(v);
        }
        return local.value !== undefined 
            ? (local.value == null ? '' : String(local.value)) 
            : uncontrolledValue();
    });

    // Validation state: from field or props
    const validationState = createMemo((): ValidationState => {
        const f = getField();
        if (f && hasFieldError(f, isFormSubmitted())) return 'invalid';
        return local.validationState ?? 'valid';
    });

    // Error message (only from field)
    const errorMessage = createMemo(() => {
        const f = getField();
        if (f) return getFieldError(f);
        return '';
    });

    const contextValue: TextFieldContextValue = {
        id,
        value,
        onChange: (newValue: any) => {
            const f = getField();
            if (f) {
                f.handleChange(newValue as any);
            } else {
                setUncontrolledValue(newValue == null ? '' : String(newValue));
                local.onChange?.(newValue);
            }
        },
        onBlur: () => {
            const f = getField();
            if (f) {
                f.handleBlur();
            }
        },
        validationState,
        isInvalid: () => validationState() === 'invalid',
        disabled: () => local.disabled ?? false,
        readOnly: () => local.readOnly ?? false,
        loading: () => local.loading ?? false,
        errorMessage,
    };

    // Memoize children to guarantee 100% stable DOM node identity (preserves input focus during real-time checks)
    const resolvedChildren = children(() => local.children);

    return (
        <TextFieldContext.Provider value={contextValue}>
            <div
                class={cn("relative flex flex-col gap-1", local.class)}
                data-valid={!contextValue.isInvalid()}
                data-invalid={contextValue.isInvalid()}
                {...others}
            >
                {resolvedChildren()}
            </div>
        </TextFieldContext.Provider>
    );
};

/** Label for the field */
const Label = (props: TextFieldLabelProps) => {
    const context = useTextFieldContext();
    const [local, others] = splitProps(props, [
        'class', 'labelClass', 'children', 'tooltip',
        'tooltipPlacement', 'optional', 'badge', 'alignBadgeRight'
    ]);
    const shouldAlignRight = () => local.alignBadgeRight ?? Boolean(local.badge);

    return (
        <div class={cn(
            "flex items-center gap-1.5 ml-1",
            shouldAlignRight() ? "justify-between w-full" : "w-fit",
            local.class
        )}>
            <div class="flex items-center gap-1.5 min-w-0">
                <label
                    for={context.id}
                    class={cn("text-sm font-medium text-muted block select-none", local.labelClass)}
                    {...others}
                >
                    {local.children}
                </label>
                <Show when={local.optional}>
                    <Badge variant="default" class="text-[10px] px-1.5 py-0 font-normal">
                        Opcional
                    </Badge>
                </Show>
                <Show when={local.tooltip}>
                    <Tooltip
                        content={local.tooltip!}
                        placement={local.tooltipPlacement ?? 'right'}
                        delay={0}
                    >
                        <InfoIcon class="size-3.5 text-primary-strong hover:text-primary-strong/80 cursor-help transition-colors shrink-0" />
                    </Tooltip>
                </Show>
            </div>
            <Show when={local.badge}>
                <div class="shrink-0 flex items-center min-h-[20px]">
                    {typeof local.badge === 'function' ? (local.badge as any)() : local.badge}
                </div>
            </Show>
        </div>
    );
};

/** Standalone label for non-TextField contexts (Select, SegmentedControl, etc.) */
export const FieldLabel = (props: FieldLabelProps) => {
    const [local, others] = splitProps(props, [
        'class', 'labelClass', 'children', 'tooltip',
        'tooltipPlacement', 'optional', 'badge', 'alignBadgeRight'
    ]);
    const shouldAlignRight = () => local.alignBadgeRight ?? Boolean(local.badge);

    return (
        <div class={cn(
            "flex items-center gap-1.5 ml-1",
            shouldAlignRight() ? "justify-between w-full" : "w-fit",
            local.class
        )}>
            <div class="flex items-center gap-1.5 min-w-0">
                <label
                    class={cn("text-sm font-medium text-muted block select-none", local.labelClass)}
                    {...others}
                >
                    {local.children}
                </label>
                <Show when={local.optional}>
                    <Badge variant="default" class="text-[10px] px-1.5 py-0 font-normal">
                        Opcional
                    </Badge>
                </Show>
                <Show when={local.tooltip}>
                    <Tooltip
                        content={local.tooltip!}
                        placement={local.tooltipPlacement ?? 'right'}
                        delay={0}
                    >
                        <InfoIcon class="size-3.5 text-primary-strong hover:text-primary-strong/80 cursor-help transition-colors shrink-0" />
                    </Tooltip>
                </Show>
            </div>
            <Show when={local.badge}>
                <div class="shrink-0 flex items-center min-h-[20px]">
                    {typeof local.badge === 'function' ? (local.badge as any)() : local.badge}
                </div>
            </Show>
        </div>
    );
};

/** Text input — coerces to number when type="number" for TanStack Form compatibility */
const Input = (props: TextFieldInputProps) => {
    const context = useTextFieldContext();
    const [local, others] = splitProps(props, ['class', 'type', 'loading', 'rightIcon', 'leftIcon', 'onInput']);

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

        // Safely invoke chained onInput if provided
        if (typeof local.onInput === 'function') {
            (local.onInput as any)(e);
        }
    };

    const isLoading = () => (local.loading !== undefined ? local.loading : context.loading());
    const hasRightAdornment = () => Boolean(isLoading() || local.rightIcon);
    const hasLeftAdornment = () => Boolean(local.leftIcon);

    return (
        <div class="relative w-full">
            <Show when={local.leftIcon}>
                <div class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center text-muted">
                    {local.leftIcon}
                </div>
            </Show>

            <input
                id={context.id}
                type={local.type}
                value={context.value()}
                onInput={handleInput}
                onBlur={() => context.onBlur()}
                disabled={context.disabled()}
                readOnly={context.readOnly()}
                data-invalid={context.isInvalid()}
                class={cn(
                    inputBaseStyles,
                    hasLeftAdornment() && 'pl-9',
                    hasRightAdornment() && 'pr-9',
                    local.class
                )}
                {...others}
            />

            <div
                class={cn(
                    "absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted",
                    (!local.rightIcon || isLoading()) && "pointer-events-none"
                )}
            >
                <Show when={isLoading()} fallback={local.rightIcon}>
                    <SpinnerIcon class="size-4 animate-spin text-primary" />
                </Show>
            </div>
        </div>
    );
};

/** Text password input with toggle */
const PasswordInput = (props: TextFieldPasswordInputProps) => {
    const context = useTextFieldContext();
    const [local, others] = splitProps(props, ['class', 'loading', 'leftIcon']);
    const [showPassword, setShowPassword] = createSignal(false);
    const isLoading = () => (local.loading !== undefined ? local.loading : context.loading());

    return (
        <div class="relative w-full">
            <Show when={local.leftIcon}>
                <div class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center text-muted">
                    {local.leftIcon}
                </div>
            </Show>
            <input
                id={context.id}
                type={showPassword() ? 'text' : 'password'}
                value={context.value()}
                onInput={(e) => context.onChange(e.currentTarget.value)}
                onBlur={() => context.onBlur()}
                disabled={context.disabled()}
                readOnly={context.readOnly()}
                data-invalid={context.isInvalid()}
                class={cn(inputBaseStyles, local.leftIcon && "pl-9", "pr-12", local.class)}
                {...others}
            />
            <div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
                <Show when={isLoading()} fallback={
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword())}
                        disabled={context.disabled()}
                        class="p-1 text-muted hover:text-heading transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        tabIndex={-1}
                    >
                        <Show when={showPassword()} fallback={<EyeIcon class="size-5" />}>
                            <EyeOffIcon class="size-5" />
                        </Show>
                    </button>
                }>
                    <div class="pointer-events-none flex items-center justify-center text-muted">
                        <SpinnerIcon class="size-4 animate-spin text-primary" />
                    </div>
                </Show>
            </div>
        </div>
    );
};

/** 
 * Numeric input - uses type="text" with inputMode="decimal" to allow native dot/comma typing.
 * Robustly prevents typing letters and normalizes output to numbers.
 */
const NumericInput = (props: TextFieldNumericInputProps) => {
    const context = useTextFieldContext();
    const [local, others] = splitProps(props, ['class', 'allowNegative', 'allowDecimal', 'loading', 'rightIcon', 'leftIcon']);
    const [inputValue, setInputValue] = createSignal("");
    const [isTyping, setIsTyping] = createSignal(false);
    const isLoading = () => (local.loading !== undefined ? local.loading : context.loading());
    const hasRightAdornment = () => Boolean(isLoading() || local.rightIcon);
    const hasLeftAdornment = () => Boolean(local.leftIcon);

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
        <div class="relative w-full">
            <Show when={local.leftIcon}>
                <div class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center text-muted">
                    {local.leftIcon}
                </div>
            </Show>

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
                data-invalid={context.isInvalid()}
                class={cn(
                    inputBaseStyles,
                    "font-mono",
                    hasLeftAdornment() && 'pl-9',
                    hasRightAdornment() && 'pr-9',
                    local.class
                )}
                {...others}
            />

            <div
                class={cn(
                    "absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted",
                    (!local.rightIcon || isLoading()) && "pointer-events-none"
                )}
            >
                <Show when={isLoading()} fallback={local.rightIcon}>
                    <SpinnerIcon class="size-4 animate-spin text-primary" />
                </Show>
            </div>
        </div>
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
            data-invalid={context.isInvalid()}
            class={cn(inputBaseStyles, "resize-y py-3", local.class)}
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
        <Show when={context.isInvalid() && message()}>
            <small
                class={cn(
                    "absolute -bottom-3.5 left-1 text-xs leading-none text-danger font-medium animate-in fade-in slide-in-from-top-1",
                    local.class
                )}
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
            class={cn("text-xs text-muted mt-0.5", local.class)}
            {...others}
        >
            {local.children}
        </span>
    );
};

// ============================================================================
// EXPORTS (compound component pattern)
// ============================================================================
export const TextField = Object.assign(Root, {
    Root,
    Label,
    Input,
    NumericInput,
    PasswordInput,
    TextArea,
    ErrorMessage,
    Description,
});

export default TextField;
