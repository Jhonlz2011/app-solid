import { Component, splitProps } from "solid-js";
import { Select as KSelect } from "@kobalte/core/select";
import { CheckIcon, ChevronsUpDownIcon } from "./icons";

/**
 * Enhanced Select component with optional TanStack Form field integration.
 * 
 * Usage with field prop (auto-binds to form):
 * ```tsx
 * <form.Field name="taxIdType">
 *   {(field) => (
 *     <SelectField
 *       field={field()}
 *       options={options}
 *       optionValue="value"
 *       optionTextValue="label"
 *       // ...
 *     />
 *   )}
 * </form.Field>
 * ```
 * 
 * Usage without field (standalone):
 * ```tsx
 * <Select value={value()} onChange={setValue} options={options} />
 * ```
 */

// 1. ROOT - Standard Kobalte wrapper (maintains original behavior)
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
        px-4 py-2 rounded-xl border transition-all duration-200
        
        /* ESTADO NORMAL: */
        bg-card-alt border-border text-text
        
        /* HOVER:*/
        hover:bg-card hover:border-border-strong
        
        /* FOCUS: Replica tu color-mix usando opacidad de Tailwind */
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

// 4. CONTENT (El Menú Flotante)
export const SelectContent: Component<Parameters<typeof KSelect.Content>[0] & { class?: string }> = (props) => {
    const [local, others] = splitProps(props, ['class', 'children']);
    return (
        <KSelect.Portal>
            <KSelect.Content
                {...others}
                onPointerDownOutside={(e: any) => {
                    // Si el click fue en un control de formulario, no cerrar automáticamente
                    const target = e.target as HTMLElement;
                    if (target.closest('button, input, [role="combobox"], [data-kb-combobox-trigger]')) {
                        e.preventDefault();
                    }
                }}
                class={`
          relative z-[100] min-w-[8rem] overflow-hidden 
          
          bg-card border border-border rounded-xl shadow-card-soft p-1
          
          transform-origin-var
          data-[expanded]:animate-in data-[expanded]:fade-in-0 data-[expanded]:zoom-in-95 data-[expanded]:slide-in-from-top-2
          data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[closed]:slide-out-to-top-2
          
          ${local.class ?? ''}
        `}
            >
                <KSelect.Listbox class="max-h-[256px] overflow-y-auto outline-none p-1" />
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
        data-[highlighted]:bg-primary-soft data-[highlighted]:text-primary-strong
        data-[selected]:text-primary data-[selected]:font-medium
        /* DISABLED */
        data-[disabled]:pointer-events-none data-[disabled]:opacity-50
        
        ${local.class ?? ''}
      `}
        >
            {/* TEXTO DE LA OPCIÓN */}
            <KSelect.ItemLabel class="flex-1 truncate">{local.children}</KSelect.ItemLabel>

            {/* INDICADOR (Check a la derecha) */}
            <KSelect.ItemIndicator class="ml-2 flex items-center justify-center animate-in fade-in duration-200">
                <CheckIcon class="size-4 text-primary" stroke-width={2.5} />
            </KSelect.ItemIndicator>
        </KSelect.Item>
    );
};

// 6. LABEL (Opcional, para títulos)
export const SelectLabel = (props: { class?: string; children?: any }) => {
    return <KSelect.Label class={`text-sm font-medium text-muted mb-1 ml-1 ${props.class ?? ''}`}>{props.children}</KSelect.Label>;
};