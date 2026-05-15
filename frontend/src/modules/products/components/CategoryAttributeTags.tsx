/**
 * CategoryAttributeTags — Shows category's attribute definitions as chips.
 * Uses Ark UI TagsInput for the defined attributes (read-only chips) +
 * an input to add custom attributes that override/extend the category schema.
 *
 * Design: Chips are color-coded by fill state (green=filled, neutral=empty).
 * Custom attributes appear as editable tags at the bottom.
 */
import { Component, Show, For, createMemo, createSignal } from 'solid-js';
import { TagsInput } from '@ark-ui/solid/tags-input';
import { useCategoryFormSchema } from '@/modules/categories/data/categories.queries';
import { XIcon, PlusIcon } from '@shared/ui/icons';

interface CategoryAttributeTagsProps {
    categoryId: () => number | null;
    /** Current values from shared_attributes to show filled/empty state */
    values?: Record<string, unknown>;
    /** Callback when user adds a custom attribute key:value */
    onAddCustom?: (key: string, value: string) => void;
}

const CategoryAttributeTags: Component<CategoryAttributeTagsProps> = (props) => {
    const schemaQuery = useCategoryFormSchema(props.categoryId);
    const [customInput, setCustomInput] = createSignal('');

    const attributes = createMemo(() => {
        if (!schemaQuery.data) return [];
        return ((schemaQuery.data as any).attributes ?? []) as Array<{
            key: string;
            label: string;
            type: string;
            required: boolean;
            options?: string[];
        }>;
    });

    const categoryName = createMemo(() => (schemaQuery.data as any)?.category?.name ?? '');

    // Custom attributes = keys in values that are NOT in the schema
    const customAttributes = createMemo(() => {
        if (!props.values) return [];
        const schemaKeys = new Set(attributes().map(a => a.key));
        return Object.entries(props.values)
            .filter(([key]) => !schemaKeys.has(key))
            .map(([key, value]) => ({ key, value: String(value ?? '') }));
    });

    const isFilled = (attrKey: string): boolean => {
        if (!props.values) return false;
        const val = props.values[attrKey];
        return val !== null && val !== undefined && String(val).trim() !== '';
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'SELECT': return '☰';
            case 'NUMBER': return '#';
            case 'BOOLEAN': return '◉';
            default: return 'T';
        }
    };

    const handleAddCustom = () => {
        const raw = customInput().trim();
        if (!raw || !props.onAddCustom) return;

        // Parse key:value or just key
        const colonIdx = raw.indexOf(':');
        if (colonIdx > 0) {
            const key = raw.slice(0, colonIdx).trim().toLowerCase().replace(/\s+/g, '_');
            const value = raw.slice(colonIdx + 1).trim();
            if (key) {
                props.onAddCustom(key, value);
                setCustomInput('');
            }
        } else {
            // Just a key with empty value
            const key = raw.toLowerCase().replace(/\s+/g, '_');
            props.onAddCustom(key, '');
            setCustomInput('');
        }
    };

    return (
        <div class="bg-surface/30 rounded-2xl border border-border/40 p-4 flex flex-col gap-3 h-full">
            {/* Header */}
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <div class="w-1 h-4 rounded-full bg-accent" />
                    <span class="text-xs font-semibold uppercase tracking-wider text-muted">
                        Atributos
                    </span>
                    <Show when={categoryName()}>
                        <span class="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                            {categoryName()}
                        </span>
                    </Show>
                </div>
                <span class="text-[10px] text-muted tabular-nums">
                    {attributes().length + customAttributes().length} total
                </span>
            </div>

            {/* Category-defined attributes (read-only chips) */}
            <Show when={attributes().length > 0}>
                <div class="flex flex-wrap gap-1.5">
                    <For each={attributes()}>
                        {(attr) => {
                            const filled = () => isFilled(attr.key);
                            const filledValue = () => {
                                if (!props.values) return '';
                                const val = props.values[attr.key];
                                return val !== null && val !== undefined ? String(val) : '';
                            };

                            return (
                                <div
                                    class="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-all duration-200 select-none"
                                    classList={{
                                        'bg-success/10 border-success/30 text-success': filled(),
                                        'bg-card-alt border-border/60 text-muted': !filled(),
                                    }}
                                    title={`${attr.key}: ${filledValue() || '(vacío)'}`}
                                >
                                    <span class="text-[9px] opacity-60 font-mono shrink-0">
                                        {getTypeIcon(attr.type)}
                                    </span>
                                    <span class="truncate max-w-[100px]">{attr.label}</span>
                                    <Show when={filled() && filledValue()}>
                                        <span class="text-[9px] font-mono opacity-70 truncate max-w-[60px]">
                                            = {filledValue()}
                                        </span>
                                    </Show>
                                    <Show when={attr.required}>
                                        <span class="text-danger text-[9px] font-bold">*</span>
                                    </Show>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </Show>

            {/* Custom attributes (editable tags via Ark UI TagsInput) */}
            <Show when={customAttributes().length > 0}>
                <div class="border-t border-border/30 pt-2">
                    <span class="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1.5 block">
                        Personalizados
                    </span>
                    <TagsInput.Root
                        value={customAttributes().map(a => `${a.key}:${a.value}`)}
                        readOnly
                        class="w-full"
                    >
                        <TagsInput.Context>
                            {(_context) => (
                                <TagsInput.Control class="flex flex-wrap gap-1.5 p-0 border-0 bg-transparent">
                                    <For each={customAttributes()}>
                                        {(attr, index) => (
                                            <TagsInput.Item
                                                index={index()}
                                                value={`${attr.key}:${attr.value}`}
                                                class="inline-flex items-center gap-1 rounded-lg bg-primary/8 border border-primary/20 px-2 py-1 text-[11px] font-medium text-primary select-none"
                                            >
                                                <TagsInput.ItemText class="truncate max-w-[120px]">
                                                    <span class="font-mono text-[10px] opacity-70">{attr.key}</span>
                                                    <Show when={attr.value}>
                                                        <span class="opacity-50 mx-0.5">:</span>
                                                        <span>{attr.value}</span>
                                                    </Show>
                                                </TagsInput.ItemText>
                                                <TagsInput.ItemDeleteTrigger class="hidden">
                                                    <XIcon class="size-3" />
                                                </TagsInput.ItemDeleteTrigger>
                                                <TagsInput.ItemInput class="hidden" />
                                            </TagsInput.Item>
                                        )}
                                    </For>
                                    <TagsInput.Input class="hidden" />
                                </TagsInput.Control>
                            )}
                        </TagsInput.Context>
                    </TagsInput.Root>
                </div>
            </Show>

            {/* Add custom attribute input */}
            <Show when={props.onAddCustom}>
                <div class="flex items-center gap-2 mt-auto pt-2 border-t border-border/30">
                    <input
                        type="text"
                        value={customInput()}
                        onInput={(e) => setCustomInput(e.currentTarget.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustom();
                            }
                        }}
                        placeholder="clave:valor  (ej: color:rojo)"
                        class="flex-1 bg-card-alt border border-border rounded-lg px-2.5 py-1.5 text-xs text-text placeholder:text-muted/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all font-mono min-w-0"
                    />
                    <button
                        type="button"
                        onClick={handleAddCustom}
                        disabled={!customInput().trim()}
                        class="shrink-0 p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                        title="Agregar atributo"
                    >
                        <PlusIcon class="size-3.5" />
                    </button>
                </div>
            </Show>
        </div>
    );
};

export default CategoryAttributeTags;
