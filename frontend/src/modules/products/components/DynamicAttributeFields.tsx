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
import { useResolvedSelectorPath } from '@shared/ui/selectors';
import SectionHeader from './ui/SectionHeader';
import { PlusIcon, EditIcon } from '@shared/ui/icons';

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
    /** Category ID for deep-linking to attribute management */
    categoryId: () => number;
}

type SelectOption = { value: string; label: string };

const DynamicAttributeFields: Component<DynamicAttributeFieldsProps> = (props) => {
    const attributes = () => props.attributes();
    const nameTemplate = () => props.nameTemplate();

    // Resolve category path for deep-linking to attribute edit
    const resolvedCategoryPath = useResolvedSelectorPath('/categories');

    // Auto-generate name from template whenever values change
    // ▶ TRACKING FIX: read the whole values object BEFORE the forEach
    // so SolidJS can track the dependency on the accessor itself.
    createEffect(() => {
        const template = nameTemplate();
        if (!template || !props.onNameGenerated) return;
        const attrs = attributes();
        if (attrs.length === 0) return;

        // Track the entire values object as a reactive dependency
        const currentValues = props.values();

        let generated = template as string;
        attrs.forEach((attr) => {
            const val = currentValues[attr.key];
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

    return (
        <Show when={attributes().length > 0}>
            <fieldset class="space-y-4 bg-surface/30 p-5 rounded-2xl border border-border/40">
                <div class="flex items-center justify-between">
                    <SectionHeader color="accent" title="Atributos de Categoría" />
                    <Link
                        to={`${resolvedCategoryPath()}/${props.categoryId()}/edit/attributes/new`}
                        preload="intent"
                        class="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                    >
                        <PlusIcon class="size-3" />
                        Agregar atributo
                    </Link>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <For each={attributes()}>
                        {(attr: any) => {
                            const isSelect = () => attr.type === 'SELECT';
                            const isNumber = () => attr.type === 'NUMBER';
                            const isBoolean = () => attr.type === 'BOOLEAN';
                            const options = createMemo((): SelectOption[] =>
                                ((attr.options ?? []) as string[]).map(o => ({ value: o, label: o }))
                            );

                            // Label with pencil icon for editing this attribute definition
                            const AttributeLabel = () => (
                                <FieldLabel>
                                    <span class="flex items-center gap-1.5">
                                        {attr.label}
                                        <Show when={attr.required}>
                                            <span class="text-danger">*</span>
                                        </Show>
                                        <Link
                                            to={`${resolvedCategoryPath()}/${props.categoryId()}/edit/attributes/${attr.id ?? ''}/edit`}
                                            preload="intent"
                                            class="text-muted/40 hover:text-primary transition-colors"
                                            title={`Editar atributo "${attr.label}"`}
                                        >
                                            <EditIcon class="size-3" />
                                        </Link>
                                        <Badge variant="secondary" class="text-[9px] px-1 py-0 ml-auto">
                                            {attr.key}
                                        </Badge>
                                    </span>
                                </FieldLabel>
                            );

                            return (
                                <div classList={{ 'col-span-2': isSelect() && options().length > 6 }}>
                                    {/* Select type */}
                                    <Show when={isSelect()}>
                                        <div class="space-y-1.5">
                                            <AttributeLabel />
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
                                            <AttributeLabel />
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
                                                        <Link
                                                            to={`${resolvedCategoryPath()}/${props.categoryId()}/edit/attributes/${attr.id ?? ''}/edit`}
                                                            preload="intent"
                                                            class="inline-flex ml-1.5 text-muted/40 hover:text-primary transition-colors align-middle"
                                                            title={`Editar atributo "${attr.label}"`}
                                                        >
                                                            <EditIcon class="size-3" />
                                                        </Link>
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
                                            <AttributeLabel />
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
