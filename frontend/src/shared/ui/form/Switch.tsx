import { JSX, splitProps, Show, createMemo } from 'solid-js';
import { Switch as KSwitch } from "@kobalte/core/switch";
import type { FieldLike } from '@form/form.types';

export interface SwitchProps<TValue extends boolean | undefined | null = boolean | undefined>
    extends Omit<Parameters<typeof KSwitch>[0], 'checked' | 'onChange'> {
    class?: string;
    children?: JSX.Element;
    /** TanStack Form field - 100% type-safe generic binding */
    field?: FieldLike<TValue>;
    /** Controlled checked state - ignored if field is provided */
    checked?: boolean;
    /** Change handler - ignored if field is provided */
    onChange?: (checked: boolean) => void;
}

export function Switch<TValue extends boolean | undefined | null = boolean | undefined>(
    props: SwitchProps<TValue>
) {
    const [local, others] = splitProps(props, [
        'class',
        'children',
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
        <KSwitch
            {...others}
            checked={isChecked()}
            onChange={handleChange}
            class={`
                group inline-flex items-center gap-2.5 align-middle select-none cursor-pointer
                disabled:cursor-not-allowed disabled:opacity-50
                ${local.class ?? ''}
            `}
        >
            <KSwitch.Input class="peer sr-only" onBlur={handleBlur} />

            {/* TRACK (El Fondo) */}
            <KSwitch.Control
                class="
                    w-9 h-5 rounded-full 
                    inline-flex items-center       
                    px-0.5                  
                    bg-border-strong transition-colors duration-200 ease-in-out                    
                    data-[checked]:bg-primary
                    peer-focus-visible:outline-none 
                    peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50 peer-focus-visible:ring-offset-2
                "
            >
                {/* THUMB (La Bolita) */}
                <KSwitch.Thumb
                    class="
                        size-4 rounded-full bg-white shadow-sm
                        pointer-events-none
                        
                        transition-transform duration-200 ease-in-out
                        
                        translate-x-0
                        
                        data-[checked]:translate-x-4
                    "
                />
            </KSwitch.Control>

            {/* LABEL */}
            <Show when={local.children}>
                <KSwitch.Label class="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                    {local.children}
                </KSwitch.Label>
            </Show>
        </KSwitch>
    );
};

export default Switch;