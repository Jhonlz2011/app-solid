// ============================================================================
// FORMFIELD - Generic wrapper for TanStack Form fields
// Provides consistent layout, label, error handling for any input type
// ============================================================================

import { Show, JSX, splitProps } from 'solid-js';
import type { FieldLike } from './form.types';
import { hasFieldError, getFieldError } from './form.types';

export interface FormFieldProps<TValue = string> {
    /** TanStack Form field object */
    field: FieldLike<TValue>;
    /** Label text (empty string to hide) */
    label?: string;
    /** Helper text shown below input when no error */
    hint?: string;
    /** Reserve space for error message (prevents layout shift) */
    reserveErrorSpace?: boolean;
    /** Additional class for the container */
    class?: string;
    /** The input component(s) */
    children: JSX.Element;
}

/**
 * Generic form field wrapper that handles:
 * - Label rendering
 * - Error message display  
 * - Consistent layout
 * - Works with any input component
 * 
 * @example
 * ```tsx
 * <FormField field={field()} label="Email">
 *   <input {...useTextField(field())} />
 * </FormField>
 * ```
 */
export function FormField<TValue = string>(props: FormFieldProps<TValue>) {
    const [local, others] = splitProps(props, [
        'field',
        'label',
        'hint',
        'reserveErrorSpace',
        'class',
        'children',
    ]);

    const showError = () => hasFieldError(local.field);
    const errorMessage = () => getFieldError(local.field);

    return (
        <div class={local.class ?? ''} {...others}>
            {/* Label */}
            <Show when={local.label}>
                <label
                    for={local.field.name}
                    class="block text-sm font-medium text-muted mb-1.5"
                >
                    {local.label}
                </label>
            </Show>

            {/* Input slot */}
            {local.children}

            {/* Error / Hint area */}
            <div
                class={local.reserveErrorSpace !== false ? 'min-h-5 mt-1' : 'mt-1'}
            >
                <Show
                    when={showError()}
                    fallback={
                        <Show when={local.hint}>
                            <p class="text-xs text-muted">{local.hint}</p>
                        </Show>
                    }
                >
                    <p class="text-xs text-danger" role="alert">
                        {errorMessage()}
                    </p>
                </Show>
            </div>
        </div>
    );
}

export default FormField;