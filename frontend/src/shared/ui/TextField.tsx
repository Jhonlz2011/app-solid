import { splitProps, Show, JSX, createUniqueId, createMemo, createSignal } from 'solid-js';
import type { FieldLike } from './form/form.types';
import { hasFieldError, getFieldError, FormSubmissionContext } from './form/form.types';
import { EyeIcon, EyeOffIcon } from './icons';

// ============================================================================
// TYPES
// ============================================================================
type ValidationState = 'valid' | 'invalid';

interface TextFieldRootProps {
    /** TanStack Form field - accepts any field type (string, number, undefined variants) */
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
    onChange: (value: string) => void;
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
    transition-all duration-200
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

/** Text input */
const Input = (props: TextFieldInputProps) => {
    const context = useTextFieldContext();
    const [local, others] = splitProps(props, ['class']);

    return (
        <input
            id={context.id}
            value={context.value()}
            onInput={(e) => context.onChange(e.currentTarget.value)}
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

/** Textarea for multi-line input */
const TextArea = (props: TextFieldTextAreaProps) => {
    const context = useTextFieldContext();
    const [local, others] = splitProps(props, ['class']);

    const textAreaStyles = `
        w-full bg-card-alt border border-border text-text 
        rounded-xl px-4 py-3 outline-none resize-y
        transition-all duration-200
        hover:border-border-strong hover:bg-card
        focus:border-primary/65 focus:ring-2 focus:ring-primary/25
        disabled:cursor-not-allowed disabled:opacity-50
        data-[invalid=true]:border-red-500/50 data-[invalid=true]:focus:ring-red-500/25
    `;

    return (
        <textarea
            id={context.id}
            value={context.value()}
            onInput={(e) => context.onChange(e.currentTarget.value)}
            onBlur={() => context.onBlur()}
            disabled={context.disabled()}
            readOnly={context.readOnly()}
            data-invalid={context.validationState() === 'invalid'}
            class={`${textAreaStyles} ${local.class ?? ''}`}
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
    PasswordInput,
    TextArea,
    ErrorMessage,
    Description,
};

export default TextField;
