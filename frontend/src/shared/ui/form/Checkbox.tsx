import { JSX, splitProps, Show, createMemo } from 'solid-js';
import { Checkbox as KCheckbox } from "@kobalte/core/checkbox";
import type { FieldLike } from '@form/form.types';
import { hasFieldError, getFieldError } from '@form/form.types';

export interface CheckboxProps<TValue extends boolean | undefined | null = boolean | undefined>
    extends Omit<Parameters<typeof KCheckbox>[0], 'checked' | 'onChange'> {
    class?: string;
    children?: JSX.Element;
    /** TanStack Form field - 100% type-safe generic binding */
    field?: FieldLike<TValue>;
    /** Controlled checked state - ignored if field is provided */
    checked?: boolean;
    /** Change handler - ignored if field is provided */
    onChange?: (checked: boolean) => void;
}

export function Checkbox<TValue extends boolean | undefined | null = boolean | undefined>(
    props: CheckboxProps<TValue>
) {
    const [local, others] = splitProps(props, [
        'class',
        'children',
        'indeterminate',
        'field',
        'checked',
        'onChange',
    ]);

    // Determine if controlled by TanStack Form field
    const hasField = () => !!local.field;

    // Reactive checked state: from field or props
    const isChecked = createMemo(() => {
        if (hasField()) return Boolean(local.field!.state.value);
        return local.checked ?? false;
    });

    // Handle change: route to field or prop handler
    const handleChange = (checked: boolean) => {
        if (hasField()) {
            local.field!.handleChange(checked as unknown as TValue);
        } else {
            local.onChange?.(checked);
        }
    };

    // Handle blur for field
    const handleBlur = () => {
        if (hasField()) {
            local.field!.handleBlur();
        }
    };

    return (
        <div class="inline-flex flex-col">
            <KCheckbox
                {...others}
                checked={isChecked()}
                onChange={handleChange}
                indeterminate={local.indeterminate}
                class={`
                    group inline-flex items-center gap-2 align-top cursor-pointer select-none 
                    data-disabled:cursor-not-allowed data-disabled:opacity-60
                    ${local.class ?? ''}
                `}
            >
                <KCheckbox.Input class="peer sr-only" onBlur={handleBlur} />

                <KCheckbox.Control
                    class="
                        size-5 shrink-0 rounded-md border-2 bg-surface
                        flex items-center justify-center
                        /* Borde base (Unchecked) */
                        border-border-strong
                        /* Hover */
                        hover:border-primary 
                        hover:bg-primary-soft
                        group-data-disabled:hover:border-border-strong
                        group-data-disabled:hover:bg-surface
                        /* Focus */
                        peer-focus-visible:outline-none 
                        peer-focus-visible:ring-2 peer-focus-visible:ring-primary-soft
                        peer-focus-visible:border-primary

                        data-checked:bg-primary 
                        data-checked:border-primary 
                        
                        data-indeterminate:bg-primary 
                        data-indeterminate:border-primary
                        text-white
                    "
                >
                    <KCheckbox.Indicator>
                        <Show
                            when={!local.indeterminate}
                            fallback={
                                /* Icono Indeterminado (-) */
                                <svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
                                    <path d="M5 12h14" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                            }
                        >
                            {/* Icono Check (✓) */}
                            <svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5">
                                <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </Show>
                    </KCheckbox.Indicator>
                </KCheckbox.Control>

                <Show when={local.children}>
                    <KCheckbox.Label class="text-sm font-medium text-text transition-colors group-data-disabled:cursor-not-allowed group-hover:text-heading cursor-pointer">
                        {local.children}
                    </KCheckbox.Label>
                </Show>
            </KCheckbox>

            <Show when={hasField() && hasFieldError(local.field!)}>
                <span class="text-xs font-medium text-danger mt-1 block">
                    {getFieldError(local.field!)}
                </span>
            </Show>
        </div>
    );
}

export default Checkbox;