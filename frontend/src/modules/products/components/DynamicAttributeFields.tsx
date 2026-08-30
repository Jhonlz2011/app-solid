import { Component, For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import { Badge } from '@display/Badge';
import TextField, { FieldLabel } from '@form/TextField';
import Checkbox from '@form/Checkbox';
import { Autocomplete } from '@form/Autocomplete';
import { useResolvedSelectorPath } from '@shared/ui/selectors';
import FormSectionHeader from '@form/FormSectionHeader';
import { PlusIcon } from '@icons/PlusIcon';
import { EditIcon } from '@icons/EditIcon';
import type { CategoryFormSchemaAttribute } from '@app/schema/dto';

interface DynamicAttributeFieldsProps {
    /** Category attributes from parent query */
    attributes: () => CategoryFormSchemaAttribute[];
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
    // ▶ CYCLE-SAFE: serialize values to JSON string so the memo only changes
    //   when actual attribute content changes, NOT when unrelated form fields
    //   (like 'name') trigger the store to emit a new object reference.
    const valuesKey = createMemo(() => JSON.stringify(props.values() ?? {}));

    createEffect(() => {
        const template = nameTemplate();
        if (!template || !props.onNameGenerated) return;
        const attrs = attributes();
        if (attrs.length === 0) return;

        // Track serialized values — prevents infinite loop
        const _key = valuesKey();
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
                    <FormSectionHeader color="accent" title="Atributos de Categoría" />
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
                        {(attr) => {
                            const isSelect = () => attr.type === 'SELECT';
                            const isNumber = () => attr.type === 'NUMBER';
                            const isBoolean = () => attr.type === 'BOOLEAN';
                            const options = createMemo((): SelectOption[] =>
                                (attr.options ?? []).map(o => ({ value: o, label: o }))
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
                                        {(() => {
                                            const [filterText, setFilterText] = createSignal('');
                                            const filteredOptions = createMemo(() => {
                                                const q = filterText().toLowerCase();
                                                if (!q) return options();
                                                return options().filter(o => o.label.toLowerCase().includes(q));
                                            });
                                            return (
                                                <Autocomplete.Root>
                                                    <AttributeLabel />
                                                    <Autocomplete.Input<SelectOption>
                                                        value={getValue(attr.key)}
                                                        onInputChange={(v) => setFilterText(v)}
                                                        options={filteredOptions()}
                                                        optionValue={(o) => o.value}
                                                        optionLabel={(o) => o.label}
                                                        onSelect={(opt) => updateValue(attr.key, opt?.value ?? '', false)}
                                                        placeholder="Seleccionar..."
                                                        minLength={0}
                                                    />
                                                </Autocomplete.Root>
                                            );
                                        })()}
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
                                        {(() => {
                                            const textOptions = createMemo(() =>
                                                ((attr.options ?? []) as string[]).filter(o =>
                                                    !getValue(attr.key) || o.toLowerCase().includes(getValue(attr.key).toLowerCase())
                                                )
                                            );
                                            return (
                                                <Autocomplete.Root>
                                                    <AttributeLabel />
                                                    <Autocomplete.Input<string>
                                                        value={getValue(attr.key)}
                                                        onInputChange={(v) => updateValue(attr.key, v, false)}
                                                        options={textOptions()}
                                                        optionValue={(o) => o}
                                                        optionLabel={(o) => o}
                                                        onSelect={(opt) => updateValue(attr.key, opt ?? '', false)}
                                                        placeholder={attr.label}
                                                        minLength={0}
                                                        clearOnBlur={false}
                                                    />
                                                </Autocomplete.Root>
                                            );
                                        })()}
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
