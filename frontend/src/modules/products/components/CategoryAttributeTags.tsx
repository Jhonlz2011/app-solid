/**
 * CategoryAttributeTags — Shows category's attribute definitions as chips.
 * Uses Ark UI TagsInput for the defined attributes (read-only chips) +
 * an input to add custom attributes that override/extend the category schema.
 *
 * Design: Chips are color-coded by fill state (green=filled, neutral=empty).
 * Custom attributes appear as editable tags at the bottom.
 * Name template preview is shown at the bottom-right (sidebar).
 */
import { Component, Show, For, createMemo, createSignal } from 'solid-js';
import { TagsInput } from '@ark-ui/solid/tags-input';
import { XIcon, PlusIcon, SlidersIcon, HashIcon, CheckIcon, TagIcon } from '@shared/ui/icons';

interface CategoryAttributeTagsProps {
    /** Category attributes from parent query */
    attributes: () => Array<{ key: string; label: string; type: string; required: boolean; options?: string[] }>;
    /** Category name for display */
    categoryName: () => string;
    /** Current values from shared_attributes to show filled/empty state */
    values?: () => Record<string, unknown>;
    /** Callback when user adds a custom attribute key:value */
    onAddCustom?: (key: string, value: string) => void;
    /** Name template from category (e.g. "Platina {material} {medida}") */
    nameTemplate?: () => string | null;
}

const CategoryAttributeTags: Component<CategoryAttributeTagsProps> = (props) => {
    const [customInput, setCustomInput] = createSignal('');

    const attributes = () => props.attributes();
    const categoryName = () => props.categoryName();

    // Custom attributes = keys in values that are NOT in the schema
    const customAttributes = createMemo(() => {
        const vals = props.values?.();
        if (!vals) return [];
        const schemaKeys = new Set(attributes().map(a => a.key));
        return Object.entries(vals)
            .filter(([key]) => !schemaKeys.has(key))
            .map(([key, value]) => ({ key, value: String(value ?? '') }));
    });

    const isFilled = (attrKey: string): boolean => {
        const vals = props.values?.();
        if (!vals) return false;
        const val = vals[attrKey];
        return val !== null && val !== undefined && String(val).trim() !== '';
    };

    const renderTypeIcon = (type: string) => {
        switch (type) {
            case 'SELECT': return <SlidersIcon class="size-3 shrink-0" />;
            case 'NUMBER': return <HashIcon class="size-3 shrink-0" />;
            case 'BOOLEAN': return <CheckIcon class="size-3 shrink-0" />;
            default: return <TagIcon class="size-3 shrink-0" />;
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

    // Memoized template parts parsing for name preview
    // ▶ CYCLE-SAFE: use JSON key to avoid reacting to unrelated store changes
    const valuesKey = createMemo(() => JSON.stringify(props.values?.() ?? {}));
    const templateParts = createMemo(() => {
        const template = props.nameTemplate?.();
        if (!template) return [];
        const _key = valuesKey(); // track serialized values only
        const currentValues = props.values?.() ?? {};
        const regex = /\{(\w+)\}/g;
        const parts: Array<{ type: 'text' | 'filled' | 'empty'; content: string }> = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(template as string)) !== null) {
            if (match.index > lastIndex) {
                parts.push({ type: 'text', content: (template as string).slice(lastIndex, match.index) });
            }
            const key = match[1];
            const val = currentValues[key];
            if (val != null && String(val).trim()) {
                parts.push({ type: 'filled', content: String(val) });
            } else {
                const attrDef = attributes().find((a) => a.key === key);
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
                                const vals = props.values?.();
                                if (!vals) return '';
                                const val = vals[attr.key];
                                return val !== null && val !== undefined ? String(val) : '';
                            };

                            return (
                                <div
                                    class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all duration-200 select-none"
                                    classList={{
                                        'bg-emerald-500/10 border-emerald-500/30 text-emerald-500': filled(),
                                        'bg-card-alt border-border/60 text-muted': !filled(),
                                    }}
                                    title={`${attr.key}: ${filledValue() || '(vacío)'}`}
                                >
                                    <span class="opacity-70">
                                        {renderTypeIcon(attr.type)}
                                    </span>
                                    <span class="truncate max-w-25">{attr.label}</span>
                                    <Show when={filled() && filledValue()}>
                                        <span class="text-[9px] font-mono opacity-70 truncate max-w-15">
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
                                                <TagsInput.ItemText class="truncate max-w-30">
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

            {/* ── Name Template Preview (moved from DynamicAttributeFields) ── */}
            <Show when={props.nameTemplate?.()}>
                <div class="border-t border-border/30 pt-3 space-y-1.5">
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Nombre Generado</span>
                    </div>
                    <div class="text-sm font-medium text-text/80 font-mono leading-relaxed p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
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
                    <span class="text-[10px] text-muted font-mono block">{props.nameTemplate?.()}</span>
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
