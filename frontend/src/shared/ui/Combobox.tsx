import { splitProps } from "solid-js";
import { Combobox as KCombobox } from "@kobalte/core/combobox";
import { CheckIcon, ChevronsUpDownIcon } from "./icons";

// ROOT
export const Combobox = <T,>(
    props: Parameters<typeof KCombobox<T>>[0] & { class?: string }
) => {
    const [local, others] = splitProps(props, ['class']);
    return (
        <KCombobox<T>
            {...others}
            class={`flex flex-col gap-1.5 ${local.class ?? ''}`}
        />
    );
};

// ITEM
export const ComboboxItem = (props: Parameters<typeof KCombobox.Item>[0] & { class?: string }) => {
    const [local, others] = splitProps(props, ['class', 'children']);
    return (
        <KCombobox.Item
            {...others}
            class={`
                relative flex w-full cursor-pointer select-none items-center justify-between 
                rounded-lg px-3 py-2 text-sm outline-none transition-colors duration-150
                text-text-secondary
                data-[highlighted]:bg-primary-soft data-[highlighted]:text-primary-strong
                data-[selected]:text-primary data-[selected]:font-medium
                data-[disabled]:pointer-events-none data-[disabled]:opacity-50
                ${local.class ?? ''}
            `}
        >
            <KCombobox.ItemLabel class="flex-1 truncate">{local.children}</KCombobox.ItemLabel>
            <KCombobox.ItemIndicator class="ml-2 flex items-center justify-center animate-in fade-in">
                <CheckIcon class="size-4 text-primary" stroke-width={2.5} />
            </KCombobox.ItemIndicator>
        </KCombobox.Item>
    );
};

// CONTROL + INPUT
// Usa Trigger como wrapper del Control para que todo el área sea clickeable
export const ComboboxInput = <T,>(
    props: Parameters<typeof KCombobox.Control<T>>[0] & {
        class?: string;
        placeholder?: string;
    }
) => {
    const [local, others] = splitProps(props, ['class', 'placeholder']);

    return (
        <KCombobox.Control
            {...others}
        >
            {/* Trigger envuelve todo para que cualquier click abra el dropdown */}
            <KCombobox.Trigger
                class={`
                    group flex w-full items-center justify-between cursor-pointer
                    px-4 rounded-xl border transition-all duration-200
                    bg-card-alt border-border text-text
                    hover:bg-card hover:border-border-strong
                    has-[:focus-visible]:border-primary/65 
                    has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/25
                    data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50
                    ${local.class ?? ''}
                `}
            >
                <KCombobox.Input
                    placeholder={local.placeholder}
                    class="flex-1 bg-transparent py-2 outline-none placeholder:text-muted text-text font-medium min-w-0"
                />
                <ChevronsUpDownIcon class="ml-2 size-4 text-muted group-hover:text-text-secondary transition-colors" />
            </KCombobox.Trigger>
        </KCombobox.Control>
    );
};

// CONTENT
export const ComboboxContent = (props: Parameters<typeof KCombobox.Content>[0] & { class?: string }) => {
    const [local, others] = splitProps(props, ['class']);
    return (
        <KCombobox.Portal>
            <KCombobox.Content
                {...others}
                onPointerDownOutside={(e: any) => {
                    // Si el click fue en un control de formulario, no cerrar automáticamente
                    const target = e.target as HTMLElement;
                    if (target.closest('button, input, [role="listbox"], [data-kb-select-trigger]')) {
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
                <KCombobox.Listbox class="max-h-[256px] overflow-y-auto outline-none p-1" />
            </KCombobox.Content>
        </KCombobox.Portal>
    );
};