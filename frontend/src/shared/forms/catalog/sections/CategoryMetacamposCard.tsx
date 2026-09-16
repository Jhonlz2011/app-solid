/**
 * CategoryMetacamposCard — Shopify-inspired Category Metacampos Card (Screenshots 1 & 4).
 * Displays:
 * 1. Header with active category badge: e.g. [ Computadoras de sobremesa en Computadoras ]
 * 2. Active attribute fields (with inline selectable pills for options, hex swatches for color, compact inputs)
 * 3. Clickable pill cloud of recommended taxonomy attributes (+ Fuente de alimentación, + Tecnología de memoria...)
 */
import { Component, For, Show, createSignal, createMemo, type Accessor } from 'solid-js';
import type { CatalogFormApi } from '../catalog-form.types';
import { useTaxonomyCategoryAttributes } from '@modules/references/data/taxonomy.queries';
import { DatabaseIcon } from '@icons/DatabaseIcon';
import { PlusIcon } from '@icons/PlusIcon';
import { CloseIcon } from '@icons/CloseIcon';

interface CategoryMetacamposCardProps {
    form: CatalogFormApi;
    categoryId: Accessor<number>;
    categoryName?: Accessor<string | null | undefined>;
}

export const CategoryMetacamposCard: Component<CategoryMetacamposCardProps> = (props) => {
    const rawAttrs = props.form.useStore((s) => s.values.attributes);
    const attributesMap = createMemo(() => (rawAttrs() ?? {}) as Record<string, unknown>);

    // Fetch recommended attributes from referenceDb taxonomy
    const taxonomyAttrsQuery = useTaxonomyCategoryAttributes(props.categoryId);

    // List of active attribute keys
    const activeKeys = createMemo(() => Object.keys(attributesMap()));

    // Recommended attributes from taxonomy that are NOT active yet
    const unaddedAttributes = createMemo(() => {
        const list = taxonomyAttrsQuery.data ?? [];
        const currentKeys = new Set(activeKeys());
        return list.filter((attr) => !currentKeys.has(attr.handle) && !currentKeys.has(attr.name));
    });

    const activateAttribute = (attrHandle: string, initialValue: unknown = '') => {
        const current = { ...attributesMap() };
        current[attrHandle] = initialValue;
        props.form.setFieldValue('attributes', current);
    };

    const removeAttribute = (attrHandle: string) => {
        const current = { ...attributesMap() };
        delete current[attrHandle];
        props.form.setFieldValue('attributes', current);
    };

    const updateAttributeValue = (attrHandle: string, value: unknown) => {
        const current = { ...attributesMap() };
        current[attrHandle] = value;
        props.form.setFieldValue('attributes', current);
    };

    return (
        <Show when={props.categoryId() > 0}>
            <div class="bg-card border border-border/90 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col gap-4">
                {/* ── Header ── */}
                <div class="flex items-center justify-between gap-3 flex-wrap">
                    <div class="flex items-center gap-2">
                        <div class="p-1 rounded-md bg-primary-soft text-primary">
                            <DatabaseIcon class="size-4" />
                        </div>
                        <h3 class="text-sm font-semibold text-text">Metacampos de Categoría</h3>
                    </div>

                    <Show when={props.categoryName?.()}>
                        {(catName) => (
                            <span class="inline-flex items-center px-2.5 py-1 rounded-md bg-surface border border-border text-xs text-muted font-medium max-w-xs truncate">
                                {catName()}
                            </span>
                        )}
                    </Show>
                </div>

                {/* ── Active Attributes List ── */}
                <div class="flex flex-col gap-3">
                    <Show
                        when={activeKeys().length > 0}
                        fallback={
                            <p class="text-xs text-muted py-1">
                                No hay metacampos activos para este producto. Selecciona uno de los atributos sugeridos a continuación.
                            </p>
                        }
                    >
                        <For each={activeKeys()}>
                            {(key) => {
                                const taxAttr = () => (taxonomyAttrsQuery.data ?? []).find((a) => a.handle === key || a.name === key);
                                const currentValue = () => attributesMap()[key];

                                return (
                                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-surface/50 border border-border/60 hover:border-border transition-colors">
                                        <div class="flex items-center gap-2 min-w-[140px] shrink-0">
                                            <span class="text-xs font-medium text-text capitalize">
                                                {taxAttr()?.name ?? key}
                                            </span>
                                        </div>

                                        <div class="flex-1 flex items-center gap-2 flex-wrap justify-end">
                                            {/* If options available (Enum / Select / Canonical values) */}
                                            <Show
                                                when={taxAttr()?.values && taxAttr()!.values.length > 0}
                                                fallback={
                                                    <input
                                                        type="text"
                                                        value={(currentValue() as string) ?? ''}
                                                        onInput={(e) => updateAttributeValue(key, e.currentTarget.value)}
                                                        placeholder={`Valor para ${taxAttr()?.name ?? key}...`}
                                                        class="w-full sm:max-w-xs h-8 px-2.5 bg-surface border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-md text-xs text-text outline-none"
                                                    />
                                                }
                                            >
                                                {/* Selectable inline pills (Shopify Screenshot 3 & 4) */}
                                                <div class="flex items-center gap-1.5 flex-wrap">
                                                    <For each={taxAttr()!.values.slice(0, 8)}>
                                                        {(val) => {
                                                            const isSelected = () => currentValue() === val.name;
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateAttributeValue(key, isSelected() ? '' : val.name)}
                                                                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer"
                                                                    classList={{
                                                                        'bg-primary/10 text-primary border border-primary/30 shadow-2xs': isSelected(),
                                                                        'bg-surface border border-border text-muted hover:text-text hover:bg-surface-hover/80': !isSelected(),
                                                                    }}
                                                                >
                                                                    {/* Color swatch if metadata.hex */}
                                                                    <Show when={val.metadata?.hex}>
                                                                        <span
                                                                            class="size-2.5 rounded-full border border-black/10 shrink-0"
                                                                            style={{ 'background-color': val.metadata!.hex }}
                                                                        />
                                                                    </Show>
                                                                    <span>{val.name}</span>
                                                                </button>
                                                            );
                                                        }}
                                                    </For>
                                                </div>
                                            </Show>

                                            <button
                                                type="button"
                                                onClick={() => removeAttribute(key)}
                                                class="p-1 rounded-md text-muted/60 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
                                                title="Eliminar metacampo"
                                            >
                                                <CloseIcon class="size-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            }}
                        </For>
                    </Show>
                </div>

                {/* ── Suggested Attributes Cloud (Shopify Screenshot 1) ── */}
                <Show when={unaddedAttributes().length > 0}>
                    <div class="pt-3 border-t border-border/60 flex flex-col gap-2">
                        <span class="text-[11px] font-medium text-muted uppercase tracking-wider">
                            Atributos sugeridos de la categoría
                        </span>

                        <div class="flex items-center gap-1.5 flex-wrap">
                            <For each={unaddedAttributes()}>
                                {(attr) => (
                                    <button
                                        type="button"
                                        onClick={() => activateAttribute(attr.handle)}
                                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-border/80 hover:border-primary/50 hover:bg-primary-soft/30 text-xs text-text transition-all cursor-pointer group shadow-2xs"
                                    >
                                        <PlusIcon class="size-3 text-muted group-hover:text-primary transition-colors" />
                                        <span>{attr.name}</span>
                                    </button>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>
            </div>
        </Show>
    );
};

export default CategoryMetacamposCard;
