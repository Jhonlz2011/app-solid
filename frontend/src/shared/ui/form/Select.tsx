import { Component, JSX, splitProps, createMemo, Show } from "solid-js";
import { Select as KSelect } from "@kobalte/core/select";
import { CheckIcon } from "@icons/CheckIcon";
import { ChevronsUpDownIcon } from "@icons/ChevronsUpDownIcon";
import type { FieldLike } from '@form/form.types';

// ============================================================================
// PRIMITIVE KOBALTE COMPOUND COMPONENTS
// ============================================================================

// 1. ROOT - Standard Kobalte wrapper
export const Select = <T,>(props: Parameters<typeof KSelect<T>>[0] & { class?: string }) => {
    const [local, others] = splitProps(props, ['class']);
    return (
        <KSelect<T>
            gutter={4}
            {...others}
            class={`flex flex-col gap-1.5 ${local.class ?? ''}`}
        />
    );
};

// 2. TRIGGER (El botón)
export const SelectTrigger: Component<Parameters<typeof KSelect.Trigger>[0] & { class?: string }> = (props) => {
    const [local, others] = splitProps(props, ['class', 'children']);
    return (
        <KSelect.Trigger
            {...others}
            class={`
        group flex w-full items-center justify-between 
        /* Dimensiones y Bordes */
        px-4 py-1.5 rounded-xl border
        
        /* ESTADO NORMAL: */
        bg-card-alt border-border text-text
        
        /* HOVER:*/
        hover:bg-card hover:border-border-strong
        
        /* FOCUS: */
        focus:outline-none 
        focus-visible:border-primary/65 
        focus-visible:ring-2 focus-visible:ring-primary/25
        
        /* DISABLED */
        disabled:cursor-not-allowed disabled:opacity-50
        
        
        ${local.class ?? ''}
      `}
        >
            {local.children}
            <KSelect.Icon class="ml-2 text-muted">
                <ChevronsUpDownIcon class="size-4" />
            </KSelect.Icon>
        </KSelect.Trigger>
    );
};

// 3. VALUE
export const SelectValue = <T,>(props: Parameters<typeof KSelect.Value<T>>[0] & { class?: string }) => {
    const [local, others] = splitProps(props, ['class']);
    return (
        <KSelect.Value
            {...others}
            class={`block truncate font-medium text-text ${local.class ?? ''}`}
        />
    );
};

// 4. CONTENT (El Menú Flotante sin bloqueos de puntero)
export const SelectContent: Component<Parameters<typeof KSelect.Content>[0] & { class?: string }> = (props) => {
    const [local, others] = splitProps(props, ['class', 'children']);
    return (
        <KSelect.Portal>
            <KSelect.Content
                {...others}
                class={`
          relative z-100 min-w-32 overflow-hidden 
          
          bg-card border border-border rounded-xl shadow-card-soft p-1
          
          transform-origin-var
          data-expanded:animate-in data-expanded:fade-in-0 data-expanded:zoom-in-95 data-expanded:slide-in-from-top-2
          data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:slide-out-to-top-2
          
          ${local.class ?? ''}
        `}
            >
                <KSelect.Listbox class="max-h-64 overflow-y-auto outline-none p-1" />
            </KSelect.Content>
        </KSelect.Portal>
    );
};

// 5. ITEM (La opción individual)
export const SelectItem: Component<Parameters<typeof KSelect.Item>[0] & { class?: string }> = (props) => {
    const [local, others] = splitProps(props, ['class', 'children']);
    return (
        <KSelect.Item
            {...others}
            class={`
        relative flex w-full cursor-pointer select-none items-center justify-between 
        rounded-lg px-3 py-2 text-sm outline-none transition-colors duration-150
        text-text-secondary
        data-highlighted:bg-primary-soft data-highlighted:text-primary-strong
        data-selected:text-primary data-selected:font-medium
        /* DISABLED */
        data-disabled:pointer-events-none data-disabled:opacity-50
        
        ${local.class ?? ''}
      `}
        >
            <KSelect.ItemLabel class="flex-1 truncate">{local.children}</KSelect.ItemLabel>
            <KSelect.ItemIndicator class="ml-2 flex items-center justify-center animate-in fade-in duration-200">
                <CheckIcon class="size-4 text-primary" stroke-width={2.5} />
            </KSelect.ItemIndicator>
        </KSelect.Item>
    );
};

// 6. LABEL
export const SelectLabel = (props: { class?: string; children?: JSX.Element }) => {
    return <KSelect.Label class={`text-sm font-medium text-muted mb-1 ml-1 ${props.class ?? ''}`}>{props.children}</KSelect.Label>;
};

// ============================================================================
// HIGH-LEVEL FORM-CONNECTED COMPONENT: SelectField
// ============================================================================

export interface SelectOption<T = string | number> {
    value: T;
    label: string;
    disabled?: boolean;
}

export interface SelectFieldProps<
    TOption = string | number,
    TValue extends TOption | null | undefined = TOption | null | undefined
> {
    field?: FieldLike<TValue>;
    value?: TValue;
    onChange?: (value: TValue) => void;
    options: SelectOption<TOption>[];
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    class?: string;
    required?: boolean;
}

import { FormSubmissionContext, hasFieldError, getFieldError } from '@form/form.types';
import { useContext } from 'solid-js';

export function SelectField<
    TOption = string | number,
    TValue extends TOption | null | undefined = TOption | null | undefined
>(
    props: SelectFieldProps<TOption, TValue>
) {
    const isFormSubmitted = useContext(FormSubmissionContext);
    const activeValue = () => (props.field ? (props.field.state.value as TValue) : props.value);

    const isInvalid = () => (props.field ? hasFieldError(props.field, isFormSubmitted()) : false);
    const errorMessage = () => (props.field ? getFieldError(props.field) : '');

    const selectedOption = createMemo(() => {
        const val = activeValue();
        if (val === undefined || val === null) return undefined;
        return props.options.find((opt) => (opt.value as unknown) === (val as unknown));
    });

    const handleChange = (opt: SelectOption<TOption> | null) => {
        const val = (opt ? opt.value : null) as unknown as TValue;
        if (props.field) {
            props.field.handleChange(val);
        }
        props.onChange?.(val);
    };

    const handleBlur = () => {
        props.field?.handleBlur();
    };

    return (
        <div class={`space-y-1.5 w-full ${props.class ?? ''}`}>
            <Show when={props.label}>
                <label class="text-sm font-medium text-muted ml-1 w-fit block">
                    {props.label}
                    <Show when={props.required}>
                        <span class="text-danger ml-1">*</span>
                    </Show>
                </label>
            </Show>

            <KSelect<SelectOption<TOption>>
                value={selectedOption()}
                onChange={handleChange}
                onBlur={handleBlur}
                options={props.options}
                optionValue="value"
                optionTextValue="label"
                optionDisabled="disabled"
                disabled={props.disabled}
                placeholder={props.placeholder ?? "Seleccionar..."}
                gutter={4}
                itemComponent={(itemProps) => (
                    <SelectItem item={itemProps.item}>
                        {itemProps.item.rawValue.label}
                    </SelectItem>
                )}
            >
                <SelectTrigger data-invalid={isInvalid()}>
                    <SelectValue<SelectOption<TOption>>>
                        {(state) => state.selectedOption()?.label ?? props.placeholder ?? "Seleccionar..."}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent />
            </KSelect>

            <Show when={isInvalid()}>
                <span class="text-xs font-medium text-danger ml-1 block animate-fade-in">
                    {errorMessage()}
                </span>
            </Show>
        </div>
    );
}

export default SelectField;