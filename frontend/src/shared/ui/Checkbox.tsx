import { Component, splitProps, Show, createMemo } from 'solid-js';
import { Checkbox as KCheckbox } from "@kobalte/core/checkbox";
import type { FieldLike } from './form/form.types';

type CheckboxProps = Omit<Parameters<typeof KCheckbox>[0], 'checked' | 'onChange'> & {
    class?: string;
    children?: any;
    /** TanStack Form field - when provided, controls checked/onChange automatically */
    field?: FieldLike<boolean>;
    /** Controlled checked state - ignored if field is provided */
    checked?: boolean;
    /** Change handler - ignored if field is provided */
    onChange?: (checked: boolean) => void;
};

const Checkbox: Component<CheckboxProps> = (props) => {
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
        if (hasField()) return local.field!.state.value;
        return local.checked;
    });

    // Handle change: route to field or prop handler
    const handleChange = (checked: boolean) => {
        if (hasField()) {
            local.field!.handleChange(checked);
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
        <KCheckbox
            {...others}
            checked={isChecked()}
            onChange={handleChange}
            indeterminate={local.indeterminate}
            class={`
                group inline-flex items-center gap-2 align-top cursor-pointer select-none 
                disabled:cursor-not-allowed disabled:opacity-50
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
                    /* Focus */
                    peer-focus-visible:outline-none 
                    peer-focus-visible:ring-2 peer-focus-visible:ring-primary-soft
                    peer-focus-visible:border-primary

                    data-[checked]:bg-primary 
                    data-[checked]:border-primary 
                    
                    data-[indeterminate]:bg-primary 
                    data-[indeterminate]:border-primary
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
                <KCheckbox.Label class="text-sm font-medium text-text transition-colors group-hover:text-heading">
                    {local.children}
                </KCheckbox.Label>
            </Show>
        </KCheckbox>
    );
};

export default Checkbox;