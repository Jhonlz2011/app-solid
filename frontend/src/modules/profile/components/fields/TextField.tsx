// TextField - Atomic field component for TanStack Form
// Consumes field.state.value locally for optimal SolidJS reactivity
import { Component, Show } from 'solid-js';
import type { FieldLike } from './field.types';
import { extractErrorMessage } from './field.types';

interface TextFieldProps {
    field: FieldLike;
    label: string;
    id: string;
    type?: 'text' | 'email';
    placeholder?: string;
    prefix?: string;
}

export const TextField: Component<TextFieldProps> = (props) => {
    const hasError = () => props.field.state.meta.errors.length > 0 && props.field.state.meta.isTouched;
    const errorMessage = () => extractErrorMessage(props.field.state.meta.errors[0]);

    return (
        <div>
            <label for={props.id} class="block text-sm font-medium text-muted mb-1.5">
                {props.label}
            </label>
            <div class="relative">
                <Show when={props.prefix}>
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                        {props.prefix}
                    </span>
                </Show>
                <input
                    id={props.id}
                    name={props.field.name}
                    type={props.type ?? 'text'}
                    value={props.field.state.value}
                    onInput={(e) => props.field.handleChange(e.currentTarget.value)}
                    onBlur={() => props.field.handleBlur()}
                    class="w-full px-4 py-3 bg-card-alt border rounded-xl text-text placeholder:text-muted/60
                           focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    classList={{
                        'pl-9': !!props.prefix,
                        'border-border': !hasError(),
                        'border-danger': hasError(),
                    }}
                    placeholder={props.placeholder}
                />
            </div>
            {/* Fixed height container for error message - prevents layout shift */}
            <div class="h-5 mt-1">
                <Show when={hasError()}>
                    <p class="text-xs text-danger">{errorMessage()}</p>
                </Show>
            </div>
        </div>
    );
};
