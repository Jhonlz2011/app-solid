import { Component, For, Show, createMemo } from 'solid-js';
import { TextField, Select, Checkbox, NumberField } from '@kobalte/core';
import type { CategoryAttribute } from '../models/products.type';

interface DynamicAttributesSectionProps {
    attributes: CategoryAttribute[];
    specs: Record<string, any>;
    onSpecChange: (key: string, value: any) => void;
    errors?: Record<string, string>;
}

const DynamicAttributesSection: Component<DynamicAttributesSectionProps> = (props) => {
    // Sort by order
    const sortedAttrs = createMemo(() =>
        [...props.attributes].sort((a, b) => (a.order || 0) - (b.order || 0))
    );

    const getOptions = (attr: CategoryAttribute) => {
        return attr.specific_options || attr.definition?.default_options || [];
    };

    const renderField = (attr: CategoryAttribute) => {
        const def = attr.definition;
        if (!def) return null;

        const value = props.specs[def.key];
        const options = getOptions(attr);
        const error = props.errors?.[def.key];

        switch (def.type) {
            case 'text':
                return (
                    <TextField.Root
                        value={value || ''}
                        onChange={(val) => props.onSpecChange(def.key, val)}
                        validationState={error ? 'invalid' : 'valid'}
                        class="text-field-root"
                    >
                        <TextField.Label class="text-field-label">
                            {def.label}
                            {attr.required && <span class="text-red-400 ml-1">*</span>}
                        </TextField.Label>
                        <TextField.Input
                            class="text-field-input"
                            placeholder={`Ingrese ${def.label.toLowerCase()}`}
                            required={attr.required}
                        />
                        <TextField.ErrorMessage class="text-xs text-red-400 mt-1">{error}</TextField.ErrorMessage>
                    </TextField.Root>
                );

            case 'number':
                return (
                    <NumberField.Root
                        value={value ? Number(value) : NaN}
                        onChange={(val) => props.onSpecChange(def.key, Number.isNaN(Number(val)) ? null : Number(val))}
                        validationState={error ? 'invalid' : 'valid'}
                        class="number-field-root"
                    >
                        <NumberField.Label class="number-field-label">
                            {def.label}
                            {attr.required && <span class="text-red-400 ml-1">*</span>}
                        </NumberField.Label>
                        <NumberField.Input class="number-field-input" required={attr.required} />
                        <NumberField.ErrorMessage class="text-xs text-red-400 mt-1">{error}</NumberField.ErrorMessage>
                    </NumberField.Root>
                );

            case 'select':
                return (
                    <Select.Root
                        value={value}
                        onChange={(val) => props.onSpecChange(def.key, val)}
                        options={options}
                        validationState={error ? 'invalid' : 'valid'}
                        placeholder={`Seleccione ${def.label.toLowerCase()}`}
                        itemComponent={(itemProps) => (
                            <Select.Item item={itemProps.item} class="select-item">
                                <Select.ItemLabel>{itemProps.item.rawValue}</Select.ItemLabel>
                                <Select.ItemIndicator>
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                                </Select.ItemIndicator>
                            </Select.Item>
                        )}
                    >
                        <div class="flex flex-col gap-1.5">
                            <Select.Label class="text-sm font-medium text-muted ml-1">
                                {def.label}
                                {attr.required && <span class="text-red-400 ml-1">*</span>}
                            </Select.Label>
                            <Select.Trigger class="select-trigger">
                                <Select.Value<string>>{(state) => state.selectedOption()}</Select.Value>
                                <Select.Icon class="text-muted">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </Select.Icon>
                            </Select.Trigger>
                            <Select.ErrorMessage class="text-xs text-red-400 mt-1">{error}</Select.ErrorMessage>
                            <Select.Portal>
                                <Select.Content class="select-content">
                                    <Select.Listbox class="select-listbox" />
                                </Select.Content>
                            </Select.Portal>
                        </div>
                    </Select.Root>
                );

            case 'boolean':
                return (
                    <div class="flex flex-col gap-1">
                        <Checkbox.Root
                            checked={value || false}
                            onChange={(checked) => props.onSpecChange(def.key, checked)}
                            validationState={error ? 'invalid' : 'valid'}
                            class="group flex items-center gap-3 cursor-pointer py-2 outline-none"
                        >
                            <Checkbox.Input class="sr-only" />
                            <Checkbox.Control class="size-5 rounded-md border-2 border-border bg-card-alt 
      flex items-center justify-center
      group-hover:border-border-strong
      data-[checked]:bg-primary data-[checked]:border-primary data-[checked]:text-on-primary
      data-[invalid]:border-red-500
      group-focus-visible:ring-2 group-focus-visible:ring-primary/40">
                                <Checkbox.Indicator>
                                    <svg class="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                                    </svg>
                                </Checkbox.Indicator>
                            </Checkbox.Control>
                            <Checkbox.Label class="text-sm font-medium text-muted transition-colors group-hover:text-text select-none">
                                {def.label}
                                {attr.required && <span class="text-red-400 ml-1">*</span>}
                            </Checkbox.Label>
                        </Checkbox.Root>
                        {error && <span class="text-xs text-red-400 ml-1">{error}</span>}
                    </div>
                );

            case 'date':
                return (
                    <TextField.Root
                        value={value || ''}
                        onChange={(val) => props.onSpecChange(def.key, val)}
                        validationState={error ? 'invalid' : 'valid'}
                        class="text-field-root"
                    >
                        <TextField.Label class="text-field-label">
                            {def.label}
                            {attr.required && <span class="text-red-400 ml-1">*</span>}
                        </TextField.Label>
                        <TextField.Input
                            type="date"
                            class="text-field-input"
                            required={attr.required}
                        />
                        <TextField.ErrorMessage class="text-xs text-red-400 mt-1">{error}</TextField.ErrorMessage>
                    </TextField.Root>
                );

            default:
                return null;
        }
    };

    return (
        <Show when={sortedAttrs().length > 0}>
            <div class="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <h3 class="text-sm font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Atributos de Categoría
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-surface/50 rounded-xl border border-border/50">
                    <For each={sortedAttrs()}>
                        {(attr) => renderField(attr)}
                    </For>
                </div>
            </div>
        </Show>
    );
};

export default DynamicAttributesSection;
