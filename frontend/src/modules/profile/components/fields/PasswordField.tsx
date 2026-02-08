// PasswordField - Atomic password field component with visibility toggle
// Consumes field.state.value locally for optimal SolidJS reactivity
import { Component, Show, createSignal } from 'solid-js';
import type { FieldLike } from './field.types';
import { extractErrorMessage } from './field.types';
import { EyeIcon, EyeOffIcon } from '@shared/ui/icons';

interface PasswordFieldProps {
    field: FieldLike;
    label: string;
    id: string;
    placeholder?: string;
    hint?: string;
}

export const PasswordField: Component<PasswordFieldProps> = (props) => {
    const [showPassword, setShowPassword] = createSignal(false);

    const hasError = () => props.field.state.meta.errors.length > 0 && props.field.state.meta.isTouched;
    const errorMessage = () => extractErrorMessage(props.field.state.meta.errors[0]);

    return (
        <div>
            <label for={props.id} class="block text-sm font-medium text-muted mb-1.5">
                {props.label}
            </label>
            <div class="relative">
                <input
                    id={props.id}
                    name={props.field.name}
                    type={showPassword() ? 'text' : 'password'}
                    value={props.field.state.value}
                    onInput={(e) => props.field.handleChange(e.currentTarget.value)}
                    onBlur={() => props.field.handleBlur()}
                    class="w-full px-4 py-3 pr-12 bg-card-alt border rounded-xl text-text
                           focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    classList={{
                        'border-border': !hasError(),
                        'border-danger': hasError(),
                    }}
                    placeholder={props.placeholder}
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword())}
                    class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-heading transition-colors"
                >
                    <Show when={showPassword()} fallback={<EyeIcon class="size-5" />}>
                        <EyeOffIcon class="size-5" />
                    </Show>
                </button>
            </div>
            {/* Fixed height container for hint/error - prevents layout shift */}
            <div class="h-5 mt-1">
                <Show when={hasError()} fallback={
                    <Show when={props.hint}>
                        <p class="text-xs text-muted">{props.hint}</p>
                    </Show>
                }>
                    <p class="text-xs text-danger">{errorMessage()}</p>
                </Show>
            </div>
        </div>
    );
};
