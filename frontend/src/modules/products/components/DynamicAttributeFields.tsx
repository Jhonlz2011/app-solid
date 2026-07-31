/**
 * DynamicAttributeFields — Renders category attribute inputs dynamically
 * based on the selected category's attribute schema.
 *
 * Contract: works with Record<string, unknown> directly (the JSONB shape
 * stored in products.shared_attributes). Each key is the attribute_definition.key,
 * each value is the user-entered value.
 *
 * Uses shared UI components (TextField, Select) for consistent design.
 */
import { Component, For, Show, createEffect, createMemo } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import { Badge } from '@shared/ui/Badge';
import TextField, { FieldLabel } from '@shared/ui/TextField';
import Checkbox from '@shared/ui/Checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/Select';
import SectionHeader from './ui/SectionHeader';
import { PlusIcon, SlidersIcon, HashIcon, CheckIcon, TagIcon } from '@shared/ui/icons';

interface DynamicAttributeFieldsProps {
    /** Category attributes from parent query */
    attributes: () => Array<{ key: string; label: string; type: string; required?: boolean; options?: string[] }>;
    /** Name template from category */
    nameTemplate: () => string | null;
    /** JSONB object: { material: "Acero", norma: "ASTM A36" } */
    values: () => Record<string, unknown>;
    /** Called with updated JSONB object */
    onChange: (values: Record<string, unknown>) => void;
    /** Called when name_template + values produce a generated name */
    onNameGenerated?: (name: string) => void;
}

type SelectOption = { value: string; label: string };

const DynamicAttributeFields: Component<DynamicAttributeFieldsProps> = (props) => {
    const attributes = () => props.attributes();
    const nameTemplate = () => props.nameTemplate();

    // Auto-generate name from template whenever values change
    createEffect(() => {
        const template = nameTemplate();
        if (!template || !props.onNameGenerated) return;
        const attrs = attributes();
        if (attrs.length === 0) return;

        let generated = template as string;
        attrs.forEach((attr: any) => {
            const val = props.values()[attr.key];
            generated = generated.replace(`{${attr.key}}`, val != null ? String(val) : '');
        });

        // Clean up extra spaces
        generated = generated.replace(/\s+/g, ' ').trim();
        if (generated && !generated.includes('{')) {
            props.onNameGenerated(generated);
        }
    });

    // Get the value for an attribute by its key
    const getValue = (attrKey: string): string => {
        const val = props.values()[attrKey];
        return val != null ? String(val) : '';
    };

    // Update a single attribute key in the JSONB object
    const updateValue = (attrKey: string, textVal: string, isNumeric: boolean) => {
        const updated = { ...props.values() };
        if (textVal === '' || textVal == null) {
            delete updated[attrKey]; // Remove empty keys
        } else if (isNumeric) {
            const num = parseFloat(textVal);
            updated[attrKey] = isNaN(num) ? textVal : num;
        } else {
            updated[attrKey] = textVal;
        }
        props.onChange(updated);
    };

    // Memoize template parts parsing — avoids regex re-creation on each render
    const templateParts = createMemo(() => {
        const template = nameTemplate();
        if (!template) return [];
        const regex = /\{(\w+)\}/g;
        const parts: Array<{ type: 'text' | 'filled' | 'empty'; content: string }> = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(template as string)) !== null) {
            if (match.index > lastIndex) {
                parts.push({ type: 'text', content: (template as string).slice(lastIndex, match.index) });
            }
            const key = match[1];
            const val = props.values()[key];
            if (val != null && String(val).trim()) {
                parts.push({ type: 'filled', content: String(val) });
            } else {
                const attrDef = attributes().find((a: any) => a.key === key);
                parts.push({ type: 'empty', content: attrDef?.label ?? key });
            }
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < (template as string).length) {
            parts.push({ type: 'text', content: (template as string).slice(lastIndex) });
        }
        return parts;
    });

    return (
        <Show when={attributes().length > 0}>
            <fieldset class="space-y-4 bg-surface/30 p-5 rounded-2xl border border-border/40">
                <div class="flex items-center justify-between">
                    <SectionHeader color="accent" title="Atributos de Categoría" />
                    <Link
                        to="/settings"
                        class="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                        target="_blank"
                    >
                        <PlusIcon class="size-3" />
                        Gestionar atributos
                    </Link>
                </div>

                <Show when={nameTemplate()}>
                    <div class="p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-1.5">
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Plantilla</span>
                            <span class="text-[10px] text-muted font-mono">{nameTemplate()}</span>
                        </div>
                        <div class="text-sm font-medium text-text/80 font-mono leading-relaxed">
                        <For each={templateParts()}>
                            {(part) => (
                                <>
                                    {part.type === 'text' && <span>{part.content}</span>}
                                    {part.type === 'filled' && (
                                        <span class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                                            {part.content}
                                        </span>
                                    )}
                                    {part.type === 'empty' && (
                                        <span class="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500/70 font-medium text-xs italic">
                                            {part.content}
                                        </span>
                                    )}
                                </>
                            )}
                        </For>
                        </div>
                    </div>
                </Show>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <For each={attributes()}>
                        {(attr: any) => {
                            const isSelect = () => attr.type === 'SELECT';
                            const isNumber = () => attr.type === 'NUMBER';
                            const isBoolean = () => attr.type === 'BOOLEAN';
                            const options = createMemo((): SelectOption[] =>
                                ((attr.options ?? []) as string[]).map(o => ({ value: o, label: o }))
                            );

                            return (
                                <div classList={{ 'col-span-2': isSelect() && options().length > 6 }}>
                                    {/* Select type */}
                                    <Show when={isSelect()}>
                                        <div class="space-y-1.5">
                                            <FieldLabel>
                                                <span class="flex items-center gap-1.5">
                                                    {attr.label}
                                                    <Show when={attr.required}>
                                                        <span class="text-danger">*</span>
                                                    </Show>
                                                    <Badge variant="secondary" class="text-[9px] px-1 py-0 ml-auto">
                                                        {attr.key}
                                                    </Badge>
                                                </span>
                                            </FieldLabel>
                                            <Select
                                                value={options().find(o => o.value === getValue(attr.key))}
                                                onChange={(opt: SelectOption | null) => updateValue(attr.key, opt?.value ?? '', false)}
                                                options={options()}
                                                optionValue="value"
                                                optionTextValue="label"
                                                placeholder="Seleccionar..."
                                                itemComponent={(itemProps: any) => (
                                                    <SelectItem item={itemProps.item}>{itemProps.item.rawValue?.label}</SelectItem>
                                                )}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue<SelectOption>>
                                                        {(state) => state.selectedOption()?.label ?? 'Seleccionar...'}
                                                    </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent />
                                            </Select>
                                        </div>
                                    </Show>

                                    {/* Number type */}
                                    <Show when={isNumber()}>
                                        <TextField.Root
                                            value={getValue(attr.key)}
                                            onChange={(val) => updateValue(attr.key, val, true)}
                                        >
                                            <TextField.Label>
                                                <span class="flex items-center gap-1.5">
                                                    {attr.label}
                                                    <Show when={attr.required}>
                                                        <span class="text-danger">*</span>
                                                    </Show>
                                                    <Badge variant="secondary" class="text-[9px] px-1 py-0 ml-auto">
                                                        {attr.key}
                                                    </Badge>
                                                </span>
                                            </TextField.Label>
                                            <TextField.Input
                                                type="text"
                                                class="font-mono"
                                                placeholder={`Ej: 3/8, 2.5, 10`}
                                            />
                                        </TextField.Root>
                                    </Show>

                                    {/* Boolean type */}
                                    <Show when={isBoolean()}>
                                        <div class="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/40 h-full">
                                            <Checkbox
                                                checked={props.values()[attr.key] === true || props.values()[attr.key] === 'true'}
                                                onChange={(checked: boolean) => {
                                                    const updated = { ...props.values() };
                                                    updated[attr.key] = checked;
                                                    props.onChange(updated);
                                                }}
                                            >
                                                <div>
                                                    <p class="text-sm font-medium text-text">
                                                        {attr.label}
                                                        <Show when={attr.required}>
                                                            <span class="text-danger ml-1">*</span>
                                                        </Show>
                                                    </p>
                                                    <p class="text-[11px] text-muted font-mono">{attr.key}</p>
                                                </div>
                                            </Checkbox>
                                        </div>
                                    </Show>

                                    {/* Text type (default) */}
                                    <Show when={!isSelect() && !isNumber() && !isBoolean()}>
                                        <TextField.Root
                                            value={getValue(attr.key)}
                                            onChange={(val) => updateValue(attr.key, val, false)}
                                        >
                                            <TextField.Label>
                                                <span class="flex items-center gap-1.5">
                                                    {attr.label}
                                                    <Show when={attr.required}>
                                                        <span class="text-danger">*</span>
                                                    </Show>
                                                    <Badge variant="secondary" class="text-[9px] px-1 py-0 ml-auto">
                                                        {attr.key}
                                                    </Badge>
                                                </span>
                                            </TextField.Label>
                                            <TextField.Input type="text" placeholder={attr.label} />
                                        </TextField.Root>
                                    </Show>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </fieldset>
        </Show>
    );
};

export default DynamicAttributeFields;
