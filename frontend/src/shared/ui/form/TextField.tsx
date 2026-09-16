import { splitProps, Show, JSX, createUniqueId, createMemo, createSignal, createEffect, createRenderEffect, createContext, useContext, untrack, type Accessor } from 'solid-js';
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
    disabled?: boolean | Accessor<boolean>;
    /** Read-only mode */
    readOnly?: boolean | Accessor<boolean>;
    /** Loading state */
    loading?: boolean | Accessor<boolean>;
    /** Additional classes */
    class?: string;
    /** Children (Label, Input, ErrorMessage) */
    children: JSX.Element;
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

export type TextFieldLabelProps = FieldLabelProps;

export interface TextFieldInputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    class?: string;
    loading?: boolean | Accessor<boolean>;
    rightIcon?: JSX.Element;
    leftIcon?: JSX.Element;
    onInput?: JSX.EventHandlerUnion<HTMLInputElement, InputEvent>;
}

interface TextFieldTextAreaProps extends Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
    class?: string;
}

interface TextFieldPasswordInputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
    class?: string;
    loading?: boolean | Accessor<boolean>;
    leftIcon?: JSX.Element;
}

export interface TextFieldNumericInputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'inputMode' | 'prefix'> {
    class?: string;
    /** Whether to allow negative numbers. Default: false */
    allowNegative?: boolean;
    /** Whether to allow decimals. Default: true */
    allowDecimal?: boolean;
    /** Whether to auto-select input text on focus. Default: true */
    autoSelect?: boolean;
    /** Step increment/decrement amount. Default: 1 (or 0.01 if allowDecimal) */
    step?: number | string;
    /** Minimum allowed value */
    min?: number | string;
    /** Maximum allowed value */
    max?: number | string;
    /** Prefix adornment (e.g. '$' or JSX.Element) */
    prefix?: string | JSX.Element;
    /** Suffix adornment (e.g. 'USD' or JSX.Element) */
    suffix?: string | JSX.Element;
    loading?: boolean | Accessor<boolean>;
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
    field: () => FieldLike<any> | undefined;
    isValidating: () => boolean;
}

export const TextFieldContext = createContext<TextFieldContextValue>();

export const useTextFieldContext = () => {
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

interface RootContainerProps {
    class?: string;
    isInvalid: () => boolean;
    others: Record<string, any>;
    children: JSX.Element;
}

const RootContainer = (cProps: RootContainerProps) => {
    return untrack(() => {
        return (
            <div
                ref={(el) => {
                    createRenderEffect(() => {
                        const invalid = cProps.isInvalid();
                        el.setAttribute('data-invalid', String(invalid));
                        el.setAttribute('data-valid', String(!invalid));
                    });
                }}
                class={cn("relative flex flex-col gap-1", cProps.class)}
                {...cProps.others}
            >
                {cProps.children}
            </div>
        );
    });
};

/** Root container - provides context to children */
const Root = <TValue extends string | number | undefined | null = string | number | undefined | null>(
    props: TextFieldRootProps<TValue>
) => {
    return untrack(() => {
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

        const isValidating = createMemo(() => {
            const f = getField();
            return f?.state.meta.isValidating ?? false;
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
            disabled: () => typeof local.disabled === 'function' ? (local.disabled as any)() : (local.disabled ?? false),
            readOnly: () => typeof local.readOnly === 'function' ? (local.readOnly as any)() : (local.readOnly ?? false),
            loading: () => {
                if (local.loading !== undefined) {
                    return typeof local.loading === 'function' ? (local.loading as Accessor<boolean>)() : local.loading;
                }
                return isValidating();
            },
            errorMessage,
            field: getField,
            isValidating,
        };

        return (
            <TextFieldContext.Provider value={contextValue}>
                <RootContainer
                    class={local.class}
                    isInvalid={contextValue.isInvalid}
                    others={others}
                >
                    {local.children}
                </RootContainer>
            </TextFieldContext.Provider>
        );
    });
};

interface BaseLabelProps extends FieldLabelProps {
    forId?: string;
}

const BaseLabel = (props: BaseLabelProps) => {
    const [local, others] = splitProps(props, [
        'class', 'labelClass', 'children', 'tooltip',
        'tooltipPlacement', 'optional', 'badge', 'alignBadgeRight', 'forId'
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
                    for={local.forId}
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
                <div class="shrink-0 flex items-center min-h-5">
                    {typeof local.badge === 'function' ? (local.badge as any)() : local.badge}
                </div>
            </Show>
        </div>
    );
};

/** Label for the field */
const Label = (props: TextFieldLabelProps) => {
    return untrack(() => {
        const context = useTextFieldContext();
        return <BaseLabel forId={context.id} {...props} />;
    });
};

/** Standalone label for non-TextField contexts (Select, SegmentedControl, etc.) */
export const FieldLabel = (props: FieldLabelProps) => {
    return untrack(() => <BaseLabel {...props} />);
};

/** Text input — coerces to number when type="number" for TanStack Form compatibility */
const Input = (props: TextFieldInputProps) => {
    return untrack(() => {
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

        const isLoading = () => {
            if (local.loading !== undefined) {
                return typeof local.loading === 'function' ? (local.loading as Accessor<boolean>)() : local.loading;
            }
            return context.loading();
        };
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
    });
};

/** Text password input with toggle */
const PasswordInput = (props: TextFieldPasswordInputProps) => {
    return untrack(() => {
        const context = useTextFieldContext();
        const [local, others] = splitProps(props, ['class', 'loading', 'leftIcon']);
        const [showPassword, setShowPassword] = createSignal(false);
        const isLoading = () => {
            if (local.loading !== undefined) {
                return typeof local.loading === 'function' ? (local.loading as Accessor<boolean>)() : local.loading;
            }
            return context.loading();
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
    });
};

/** 
 * Numeric input - uses type="text" with inputMode="decimal" to allow native dot/comma typing.
 * Robustly prevents typing letters and normalizes output to numbers.
 */
const NumericInput = (props: TextFieldNumericInputProps) => {
    return untrack(() => {
        const context = useTextFieldContext();
        const [local, others] = splitProps(props, [
            'class',
            'allowNegative',
            'allowDecimal',
            'autoSelect',
            'step',
            'min',
            'max',
            'prefix',
            'suffix',
            'loading',
            'rightIcon',
            'leftIcon',
            'onFocus',
            'onBlur',
            'onKeyDown',
            'onInput',
        ]);
        const [inputValue, setInputValue] = createSignal("");
        const [isTyping, setIsTyping] = createSignal(false);
        const isLoading = () => {
            if (local.loading !== undefined) {
                return typeof local.loading === 'function' ? (local.loading as Accessor<boolean>)() : local.loading;
            }
            return context.loading();
        };
        const hasRightAdornment = () => Boolean(isLoading() || local.rightIcon || local.suffix);
        const hasLeftAdornment = () => Boolean(local.leftIcon || local.prefix);

        // Sync from context to local input ONLY when not typing
        createEffect(() => {
            const val = context.value();
            if (!isTyping()) {
                setInputValue(val == null ? '' : String(val));
            }
        });

        const handleKeyDown = (e: KeyboardEvent) => {
            // ArrowUp / ArrowDown stepping
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const allowDecimal = local.allowDecimal !== false;
                const allowNegative = local.allowNegative === true;

                // Determine step
                let stepVal = 1;
                if (local.step !== undefined) {
                    const parsedStep = Number(local.step);
                    stepVal = !isNaN(parsedStep) && parsedStep > 0 ? parsedStep : (allowDecimal ? 0.01 : 1);
                } else {
                    stepVal = allowDecimal ? 0.01 : 1;
                }

                // Current numeric value
                const currentStr = inputValue().trim().replace(',', '.');
                let currentNum = 0;
                if (currentStr !== '' && currentStr !== '-' && currentStr !== '.') {
                    const parsed = parseFloat(currentStr);
                    if (!isNaN(parsed)) {
                        currentNum = parsed;
                    }
                } else if (local.min !== undefined) {
                    const minNum = Number(local.min);
                    if (!isNaN(minNum)) currentNum = minNum;
                }

                // Calculate decimal precision to prevent floating point drift (e.g. 0.1 + 0.2)
                const stepStr = stepVal.toString();
                const stepDecimals = stepStr.includes('.') ? stepStr.split('.')[1].length : 0;
                const valDecimals = currentStr.includes('.') ? currentStr.split('.')[1].length : 0;
                const precision = Math.max(stepDecimals, valDecimals);

                const nextNum = e.key === 'ArrowUp' ? currentNum + stepVal : currentNum - stepVal;
                let roundedNum = Number(nextNum.toFixed(precision));

                // Clamping
                if (!allowNegative && roundedNum < 0) {
                    roundedNum = 0;
                }
                if (local.min !== undefined) {
                    const minNum = Number(local.min);
                    if (!isNaN(minNum) && roundedNum < minNum) {
                        roundedNum = minNum;
                    }
                }
                if (local.max !== undefined) {
                    const maxNum = Number(local.max);
                    if (!isNaN(maxNum) && roundedNum > maxNum) {
                        roundedNum = maxNum;
                    }
                }

                setInputValue(String(roundedNum));
                context.onChange(roundedNum);

                if (typeof local.onKeyDown === 'function') {
                    (local.onKeyDown as any)(e);
                }
                return;
            }

            if (
                ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) ||
                e.ctrlKey || e.metaKey || e.altKey
            ) {
                if (typeof local.onKeyDown === 'function') {
                    (local.onKeyDown as any)(e);
                }
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
                        return;
                    }
                }
            }

            if (typeof local.onKeyDown === 'function') {
                (local.onKeyDown as any)(e);
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
                // Si el usuario pone "1.", parseFloat da "1". Devolvemos raw mientras escribe para no perder el punto.
                context.onChange(isNaN(num) || raw.endsWith('.') || raw.endsWith(',') ? normalized : num);
            }

            if (typeof local.onInput === 'function') {
                (local.onInput as any)(e);
            }
        };

        const handleFocus = (e: FocusEvent & { currentTarget: HTMLInputElement }) => {
            setIsTyping(true);
            if (local.autoSelect !== false) {
                e.currentTarget.select();
            }
            if (typeof local.onFocus === 'function') {
                (local.onFocus as any)(e);
            }
        };

        const handleBlur = (e: FocusEvent & { currentTarget: HTMLInputElement }) => {
            setIsTyping(false);

            // Strict sanitization: ensure trailing dots/commas or partial inputs are coerced to number | null
            const raw = inputValue().trim();
            if (raw === '' || raw === '-' || raw === '.' || raw === ',') {
                setInputValue('');
                context.onChange(null);
            } else {
                const normalized = raw.replace(',', '.');
                let num = parseFloat(normalized);
                if (isNaN(num)) {
                    setInputValue('');
                    context.onChange(null);
                } else {
                    // Apply min / max / allowNegative clamping
                    if (local.allowNegative !== true && num < 0) {
                        num = 0;
                    }
                    if (local.min !== undefined) {
                        const minVal = Number(local.min);
                        if (!isNaN(minVal) && num < minVal) num = minVal;
                    }
                    if (local.max !== undefined) {
                        const maxVal = Number(local.max);
                        if (!isNaN(maxVal) && num > maxVal) num = maxVal;
                    }

                    // Format cleanly without trailing dots (e.g. "10." -> 10 -> "10")
                    setInputValue(String(num));
                    context.onChange(num);
                }
            }

            if (typeof local.onBlur === 'function') {
                (local.onBlur as any)(e);
            }
            context.onBlur();
        };

        return (
            <div class="relative w-full">
                <Show when={local.leftIcon || local.prefix}>
                    <div class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1.5 text-muted select-none">
                        <Show when={local.leftIcon}>{local.leftIcon}</Show>
                        <Show when={local.prefix}>
                            <span class="text-xs font-semibold text-muted select-none">{local.prefix}</span>
                        </Show>
                    </div>
                </Show>

                <input
                    id={context.id}
                    type="text"
                    inputMode="decimal"
                    value={inputValue()}
                    onKeyDown={handleKeyDown}
                    onInput={handleInput}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    disabled={context.disabled()}
                    readOnly={context.readOnly()}
                    data-invalid={context.isInvalid()}
                    class={cn(
                        inputBaseStyles,
                        "font-mono",
                        hasLeftAdornment() && (
                            local.leftIcon && local.prefix ? 'pl-14' :
                            (typeof local.prefix === 'string' && local.prefix.length > 2) ? 'pl-12' : 'pl-9'
                        ),
                        hasRightAdornment() && (
                            (local.rightIcon || isLoading()) && local.suffix ? 'pr-14' :
                            (typeof local.suffix === 'string' && local.suffix.length > 2) ? 'pr-12' : 'pr-9'
                        ),
                        local.class
                    )}
                    {...others}
                />

                <div
                    class={cn(
                        "absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-muted",
                        (!local.rightIcon || isLoading()) && "pointer-events-none"
                    )}
                >
                    <Show when={local.suffix}>
                        <span class="text-xs font-semibold text-muted pointer-events-none select-none">{local.suffix}</span>
                    </Show>
                    <Show when={isLoading()} fallback={local.rightIcon}>
                        <SpinnerIcon class="size-4 animate-spin text-primary pointer-events-none" />
                    </Show>
                </div>
            </div>
        );
    });
};

/** Textarea for multi-line input */
const TextArea = (props: TextFieldTextAreaProps) => {
    return untrack(() => {
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
    });
};

/** Error message - shows from field or children */
const ErrorMessage = (props: TextFieldErrorMessageProps) => {
    return untrack(() => {
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
    });
};

/** Description/helper text */
const Description = (props: TextFieldDescriptionProps) => {
    return untrack(() => {
        const [local, others] = splitProps(props, ['class', 'children']);

        return (
            <span
                class={cn("text-xs text-muted mt-0.5", local.class)}
                {...others}
            >
                {local.children}
            </span>
        );
    });
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
