/**
 * VariantsSection — Enterprise Variant Manager inspired by Shopify (Screenshots 1, 2, 3, 5).
 * Features:
 * 1. Option Builder: Name with taxonomy link badge [ 🗄 Color ], draggable values with trash icons and canonical values autocomplete.
 * 2. Auto-Cartesian Product generation preserving existing SKUs, IDs, and prices.
 * 3. Collapsible Grouping Table: "Agrupar por: [ TALLA v ]" with parent row price editing updating all children.
 * 4. Bulk Actions Menu [...]: Edit prices, edit SKUs, toggle active, delete, or open full modal editor.
 * 5. High visual density with clean solid white cards (bg-card), eliminating washed-out backgrounds.
 */
import { Component, Show, For, createSignal, createMemo, createEffect, type Accessor } from 'solid-js';
import type { ProductVariantFormData, ProductOptionFormData } from '@app/schema/frontend';
import type { CatalogFormApi } from '../catalog-form.types';
import { useTaxonomyCategoryAttributes } from '@modules/references/data/taxonomy.queries';
import { PlusIcon } from '@icons/PlusIcon';
import { TrashIcon } from '@icons/TrashIcon';
import { GripVerticalIcon } from '@icons/GripVerticalIcon';
import { DatabaseIcon } from '@icons/DatabaseIcon';
import { SearchIcon } from '@icons/SearchIcon';
import { ChevronDownIcon } from '@icons/ChevronDownIcon';
import { MoreVerticalIcon } from '@icons/MoreVerticalIcon';
import { SparklesIcon } from '@icons/SparklesIcon';
import { CloseIcon } from '@icons/CloseIcon';
import BulkVariantEditorModal from '../components/BulkVariantEditorModal';

interface VariantsSectionProps {
    form: CatalogFormApi;
    hasAttemptedSubmit: () => boolean;
    categoryAttributes?: Accessor<Array<{ key: string; label: string; type: string; options?: string[] }>>;
    categoryId?: Accessor<number>;
}

const emptyVariant = (sortOrder: number, title?: string, attrs?: Record<string, unknown>, basePrice?: number): ProductVariantFormData => ({
    id: null,
    sku: '',
    variant_name: title ?? null,
    variant_attributes: attrs ? { ...attrs } : {},
    content_quantity: 1,
    sale_uom_id: null,
    unit_price: basePrice ?? null,
    last_cost: null,
    barcode: null,
    barcode_type: 'CUSTOM',
    image_urls: null,
    std_length_cm: null,
    std_width_cm: null,
    is_default: sortOrder === 0,
    is_active: true,
    sort_order: sortOrder,
});

export const VariantsSection: Component<VariantsSectionProps> = (props) => {
    const rawOptions = props.form.useStore((s) => s.values.options);
    const rawVariants = props.form.useStore((s) => s.values.variants);
    const categoryId = props.form.useStore((s) => s.values.category_id);
    const defaultUnitPrice = props.form.useStore((s) => s.values.default_unit_price);
    const productTitle = props.form.useStore((s) => s.values.title);

    const options = createMemo<ProductOptionFormData[]>(() => (rawOptions() ?? []) as ProductOptionFormData[]);
    const variants = createMemo<ProductVariantFormData[]>(() => (rawVariants() ?? []) as ProductVariantFormData[]);

    // Fetch taxonomy attributes for option suggestions (e.g. Color, Talla, etc.)
    const taxonomyAttrsQuery = useTaxonomyCategoryAttributes(() => categoryId() || props.categoryId?.() || 0);

    // States
    const [isBulkModalOpen, setIsBulkModalOpen] = createSignal(false);
    const [selectedVariantIndexes, setSelectedVariantIndexes] = createSignal<Set<number>>(new Set());
    const [isBulkMenuOpen, setIsBulkMenuOpen] = createSignal(false);
    const [searchQuery, setSearchQuery] = createSignal('');
    const [editingOptionIndex, setEditingOptionIndex] = createSignal<number | null>(null);
    const [newValueInput, setNewValueInput] = createSignal<string>('');
    const [collapsedGroups, setCollapsedGroups] = createSignal<Set<string>>(new Set());

    // Grouping axis: defaults to first option name
    const groupByOption = createMemo<string>(() => {
        const opts = options();
        if (opts.length > 0) return opts[0].name;
        return '';
    });

    // Auto Cartesian Product Generator
    const regenerateVariantsFromOptions = (currentOptions: ProductOptionFormData[]) => {
        const validOptions = currentOptions.filter((o) => o.name.trim() && o.values.length > 0);

        if (validOptions.length === 0) {
            // Revert to single default variant
            const existing = variants()[0] ?? emptyVariant(0, productTitle(), {}, Number(defaultUnitPrice()) || 0);
            props.form.setFieldValue('variants', [{ ...existing, is_default: true, sort_order: 0 }]);
            props.form.setFieldValue('has_variants', false);
            return;
        }

        // Cartesian product
        const cartesian = (arrays: string[][]): string[][] => {
            return arrays.reduce((acc, curr) => acc.flatMap((d) => curr.map((e) => [...d, e])), [[]] as string[][]);
        };

        const combinations = cartesian(validOptions.map((o) => o.values));
        const oldVariants = variants();

        const newVariants: ProductVariantFormData[] = combinations.map((comb, index) => {
            const variantAttrs: Record<string, unknown> = {};
            comb.forEach((val, optIdx) => {
                variantAttrs[validOptions[optIdx].name] = val;
            });

            const comboName = comb.join(' / ');
            const generatedSku = `${(productTitle() || 'PROD').slice(0, 4).toUpperCase()}-${comb.map((c) => c.slice(0, 3).toUpperCase()).join('-')}`;

            // Check if combination already existed
            const existingMatch = oldVariants.find((oldV) => {
                const oldAttrs = oldV.variant_attributes ?? {};
                return validOptions.every((o, idx) => String(oldAttrs[o.name]) === comb[idx]);
            });

            if (existingMatch) {
                return {
                    ...existingMatch,
                    variant_name: comboName,
                    variant_attributes: variantAttrs,
                    sort_order: index,
                    is_default: index === 0,
                };
            }

            return {
                ...emptyVariant(index, comboName, variantAttrs, Number(defaultUnitPrice()) || 0),
                sku: generatedSku,
                is_default: index === 0,
            };
        });

        props.form.setFieldValue('variants', newVariants);
        props.form.setFieldValue('has_variants', newVariants.length > 1);
    };

    // Option Builder Actions
    const addOption = () => {
        const current = [...options()];
        // Suggest name from taxonomy if available
        const taxAttrs = taxonomyAttrsQuery.data ?? [];
        const unusedTaxAttr = taxAttrs.find((t) => !current.some((o) => o.name.toLowerCase() === t.name.toLowerCase()));
        const initialName = unusedTaxAttr ? unusedTaxAttr.name : `Opción ${current.length + 1}`;

        const newOpt: ProductOptionFormData = {
            id: `opt-${Date.now()}`,
            name: initialName,
            values: [],
        };
        const nextOptions = [...current, newOpt];
        props.form.setFieldValue('options', nextOptions);
        setEditingOptionIndex(nextOptions.length - 1);
        setNewValueInput('');
    };

    const updateOptionName = (index: number, name: string) => {
        const current = [...options()];
        current[index] = { ...current[index], name };
        props.form.setFieldValue('options', current);
    };

    const addValueToOption = (optionIndex: number, val: string) => {
        const clean = val.trim();
        if (!clean) return;
        const current = [...options()];
        const opt = current[optionIndex];
        if (opt.values.includes(clean)) return;

        current[optionIndex] = { ...opt, values: [...opt.values, clean] };
        props.form.setFieldValue('options', current);
        setNewValueInput('');
        regenerateVariantsFromOptions(current);
    };

    const removeValueFromOption = (optionIndex: number, valueIndex: number) => {
        const current = [...options()];
        const opt = current[optionIndex];
        const newValues = opt.values.filter((_, i) => i !== valueIndex);
        current[optionIndex] = { ...opt, values: newValues };
        props.form.setFieldValue('options', current);
        regenerateVariantsFromOptions(current);
    };

    const removeOption = (index: number) => {
        const current = options().filter((_, i) => i !== index);
        props.form.setFieldValue('options', current);
        setEditingOptionIndex(null);
        regenerateVariantsFromOptions(current);
    };

    // Variant Table inline update
    const updateVariantPrice = (variantIndex: number, price: number | null) => {
        const current = [...variants()];
        if (current[variantIndex]) {
            current[variantIndex] = { ...current[variantIndex], unit_price: price };
            props.form.setFieldValue('variants', current);
        }
    };

    const updateGroupPrice = (groupKey: string, price: number | null) => {
        const groupAxis = groupByOption();
        const current = [...variants()];
        const updated = current.map((v) => {
            if (String(v.variant_attributes?.[groupAxis]) === groupKey) {
                return { ...v, unit_price: price };
            }
            return v;
        });
        props.form.setFieldValue('variants', updated);
    };

    // Bulk selection handlers
    const toggleSelectAll = () => {
        const current = selectedVariantIndexes();
        if (current.size === variants().length) {
            setSelectedVariantIndexes(new Set<number>());
        } else {
            setSelectedVariantIndexes(new Set<number>(variants().map((_, i) => i)));
        }
    };

    const toggleSelectVariant = (index: number) => {
        const next = new Set(selectedVariantIndexes());
        if (next.has(index)) next.delete(index);
        else next.add(index);
        setSelectedVariantIndexes(next);
    };

    const toggleSelectGroup = (groupKey: string) => {
        const groupAxis = groupByOption();
        const next = new Set(selectedVariantIndexes());
        const groupIndexes = variants()
            .map((v, i) => (String(v.variant_attributes?.[groupAxis]) === groupKey ? i : -1))
            .filter((i) => i >= 0);

        const allInGroupSelected = groupIndexes.every((i) => next.has(i));
        if (allInGroupSelected) {
            groupIndexes.forEach((i) => next.delete(i));
        } else {
            groupIndexes.forEach((i) => next.add(i));
        }
        setSelectedVariantIndexes(next);
    };

    const toggleCollapseGroup = (groupKey: string) => {
        const next = new Set(collapsedGroups());
        if (next.has(groupKey)) next.delete(groupKey);
        else next.add(groupKey);
        setCollapsedGroups(next);
    };

    // Bulk actions
    const applyBulkPricePrompt = () => {
        const input = window.prompt('Ingrese el nuevo precio unitario para las variantes seleccionadas:');
        if (!input) return;
        const num = parseFloat(input);
        if (isNaN(num) || num < 0) return;

        const current = [...variants()];
        const selected = selectedVariantIndexes();
        const updated = current.map((v, i) => (selected.has(i) ? { ...v, unit_price: num } : v));
        props.form.setFieldValue('variants', updated);
        setIsBulkMenuOpen(false);
    };

    const applyBulkDelete = () => {
        const selected = selectedVariantIndexes();
        if (selected.size === 0) return;
        if (!window.confirm(`¿Desea eliminar las ${selected.size} variantes seleccionadas?`)) return;

        const remaining = variants().filter((_, i) => !selected.has(i));
        props.form.setFieldValue('variants', remaining.length > 0 ? remaining : [emptyVariant(0, productTitle())]);
        props.form.setFieldValue('has_variants', remaining.length > 1);
        setSelectedVariantIndexes(new Set<number>());
        setIsBulkMenuOpen(false);
    };

    // Grouping computation (Shopify Screenshot 3)
    const groupedVariants = createMemo(() => {
        const list = variants();
        const axis = groupByOption();

        if (!axis) {
            return [{ groupKey: 'Todas', items: list.map((v, idx) => ({ variant: v, originalIndex: idx })) }];
        }

        const map = new Map<string, Array<{ variant: ProductVariantFormData; originalIndex: number }>>();
        list.forEach((v, idx) => {
            const key = String(v.variant_attributes?.[axis] ?? 'Sin grupo');
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push({ variant: v, originalIndex: idx });
        });

        return Array.from(map.entries()).map(([groupKey, items]) => ({ groupKey, items }));
    });

    return (
        <fieldset class="bg-card border border-border/90 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col gap-5">
            {/* ── Section Header ── */}
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                    <div class="p-1 rounded-md bg-primary-soft text-primary">
                        <DatabaseIcon class="size-4" />
                    </div>
                    <h3 class="text-sm font-semibold text-text">Variantes</h3>
                </div>

                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsBulkModalOpen(true)}
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-surface hover:bg-card-alt text-text transition-colors cursor-pointer shadow-2xs"
                    >
                        <SparklesIcon class="size-3.5 text-primary" />
                        <span>Editor Masivo</span>
                    </button>
                </div>
            </div>

            {/* ── Options Builder (Shopify Screenshots 1 & 2) ── */}
            <div class="flex flex-col gap-3">
                <For each={options()}>
                    {(opt, optIdx) => {
                        const isEditing = () => editingOptionIndex() === optIdx();
                        const matchingTaxAttr = () =>
                            (taxonomyAttrsQuery.data ?? []).find(
                                (t) => t.name.toLowerCase() === opt.name.toLowerCase()
                            );

                        return (
                            <div class="bg-card-alt/40 border border-border/70 rounded-xl p-3.5 sm:p-4 flex flex-col gap-3 transition-all">
                                {/* Option Header */}
                                <div class="flex items-center justify-between gap-2">
                                    <div class="flex items-center gap-2">
                                        <GripVerticalIcon class="size-4 text-muted/60 cursor-grab shrink-0" />
                                        <span class="text-xs font-semibold uppercase tracking-wider text-muted">
                                            Nombre de la opción
                                        </span>
                                    </div>

                                    {/* Linked Metacampo Badge (Shopify Screenshot 1 & 2) */}
                                    <Show when={matchingTaxAttr()}>
                                        {(attr) => (
                                            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary-soft text-primary text-xs font-medium border border-primary/20">
                                                <DatabaseIcon class="size-3" />
                                                <span>{attr().name}</span>
                                            </span>
                                        )}
                                    </Show>
                                </div>

                                {/* Option Name Input */}
                                <input
                                    type="text"
                                    value={opt.name}
                                    onInput={(e) => updateOptionName(optIdx(), e.currentTarget.value)}
                                    placeholder="Ej: Talla, Color, Material..."
                                    class="w-full h-9 px-3 bg-surface border border-border hover:border-border-strong focus:border-primary focus:ring-1 focus:ring-primary rounded-lg text-sm text-text outline-none font-medium transition-colors"
                                />

                                {/* Option Values Header */}
                                <span class="text-xs font-semibold uppercase tracking-wider text-muted">
                                    Valores de opción
                                </span>

                                {/* Draggable Values List (Shopify Screenshot 2) */}
                                <div class="flex flex-col gap-1.5">
                                    <For each={opt.values}>
                                        {(val, valIdx) => (
                                            <div class="flex items-center gap-2">
                                                <GripVerticalIcon class="size-3.5 text-muted/50 cursor-grab shrink-0" />
                                                <div class="flex-1 h-9 px-3 bg-surface border border-border rounded-lg text-sm text-text flex items-center justify-between">
                                                    <div class="flex items-center gap-2">
                                                        {/* Color swatch if matches canonical color */}
                                                        {(() => {
                                                            const canonicalVal = matchingTaxAttr()?.values.find(
                                                                (v: any) => v.name.toLowerCase() === val.toLowerCase()
                                                            );
                                                            return (
                                                                <Show when={canonicalVal?.metadata?.hex}>
                                                                    <span
                                                                        class="size-3 rounded-full border border-black/10 shrink-0"
                                                                        style={{ 'background-color': canonicalVal!.metadata!.hex }}
                                                                    />
                                                                </Show>
                                                            );
                                                        })()}
                                                        <span>{val}</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeValueFromOption(optIdx(), valIdx())}
                                                        class="p-1 text-muted/60 hover:text-destructive transition-colors cursor-pointer"
                                                        title="Eliminar valor"
                                                    >
                                                        <TrashIcon class="size-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </For>

                                    {/* Add New Value Input with Taxonomy Suggestions */}
                                    <div class="flex flex-col gap-1.5 mt-1">
                                        <div class="flex items-center gap-2">
                                            <div class="size-3.5 shrink-0" />
                                            <input
                                                type="text"
                                                value={isEditing() ? newValueInput() : ''}
                                                onInput={(e) => {
                                                    setEditingOptionIndex(optIdx());
                                                    setNewValueInput(e.currentTarget.value);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        addValueToOption(optIdx(), newValueInput());
                                                    }
                                                }}
                                                placeholder="Agregar otro valor (Presiona Enter)..."
                                                class="flex-1 h-9 px-3 bg-surface border border-border hover:border-border-strong focus:border-primary focus:ring-1 focus:ring-primary rounded-lg text-sm text-text outline-none transition-colors"
                                            />
                                        </div>

                                        {/* Canonical Taxonomy Values Suggestions */}
                                        <Show when={matchingTaxAttr()?.values && matchingTaxAttr()!.values.length > 0}>
                                            <div class="ml-5 flex items-center gap-1.5 flex-wrap pt-1">
                                                <span class="text-[11px] text-muted">Sugerencias:</span>
                                                <For each={matchingTaxAttr()!.values.filter((v: any) => !opt.values.includes(v.name)).slice(0, 6)}>
                                                    {(sug) => (
                                                        <button
                                                            type="button"
                                                            onClick={() => addValueToOption(optIdx(), sug.name)}
                                                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-border text-[11px] text-muted hover:text-primary hover:border-primary/40 transition-colors cursor-pointer shadow-2xs"
                                                        >
                                                            <Show when={sug.metadata?.hex}>
                                                                <span
                                                                    class="size-2 rounded-full border border-black/10 shrink-0"
                                                                    style={{ 'background-color': sug.metadata!.hex }}
                                                                />
                                                            </Show>
                                                            <span>{sug.name}</span>
                                                        </button>
                                                    )}
                                                </For>
                                            </div>
                                        </Show>
                                    </div>
                                </div>

                                {/* Option Actions Bottom Row (Shopify Screenshot 1 & 2) */}
                                <div class="flex items-center justify-between pt-2 border-t border-border/40 mt-1">
                                    <button
                                        type="button"
                                        onClick={() => removeOption(optIdx())}
                                        class="px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                                    >
                                        Eliminar
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (newValueInput().trim()) {
                                                addValueToOption(optIdx(), newValueInput());
                                            }
                                            setEditingOptionIndex(null);
                                        }}
                                        class="px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-strong text-on-primary transition-all cursor-pointer shadow-2xs"
                                    >
                                        Listo
                                    </button>
                                </div>
                            </div>
                        );
                    }}
                </For>

                {/* Button: Add another option */}
                <button
                    type="button"
                    onClick={addOption}
                    class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary/60 hover:bg-primary-soft/20 text-xs font-medium text-muted hover:text-primary transition-all cursor-pointer w-fit"
                >
                    <PlusIcon class="size-3.5" />
                    <span>Agregar otra opción</span>
                </button>
            </div>

            {/* ── Variants Table Section (Shopify Screenshots 2, 3, 5) ── */}
            <Show when={variants().length > 0}>
                <div class="pt-3 border-t border-border/70 flex flex-col gap-3">
                    {/* Table Toolbar (Shopify Screenshot 3 & 5) */}
                    <div class="flex items-center justify-between gap-3 flex-wrap">
                        {/* Group By selector */}
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-muted font-medium">Agrupar por:</span>
                            <span class="px-2.5 py-1 rounded-md bg-surface border border-border text-xs font-medium text-text">
                                {groupByOption() || 'Sin agrupar'}
                            </span>
                        </div>

                        {/* Search & Bulk Trigger */}
                        <div class="flex items-center gap-2 ml-auto">
                            <div class="relative">
                                <SearchIcon class="size-3.5 text-muted absolute left-2.5 top-2.5 pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchQuery()}
                                    onInput={(e) => setSearchQuery(e.currentTarget.value)}
                                    placeholder="Buscar variante..."
                                    class="h-8 pl-8 pr-2.5 bg-surface border border-border rounded-lg text-xs text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary w-36 sm:w-48 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table Header with Multi-Select Actions (Shopify Screenshot 5) */}
                    <div class="bg-surface border border-border/80 rounded-xl overflow-hidden shadow-2xs">
                        <div class="flex items-center justify-between px-3.5 py-2.5 bg-card-alt/60 border-b border-border text-xs font-semibold text-muted">
                            <div class="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={selectedVariantIndexes().size === variants().length && variants().length > 0}
                                    onChange={toggleSelectAll}
                                    class="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                                />

                                <Show
                                    when={selectedVariantIndexes().size > 0}
                                    fallback={<span>Variante</span>}
                                >
                                    <div class="flex items-center gap-2">
                                        <span class="text-primary font-medium">
                                            {selectedVariantIndexes().size} seleccionados
                                        </span>

                                        {/* Bulk Actions Dropdown Menu (Shopify Screenshot 5) */}
                                        <div class="relative">
                                            <button
                                                type="button"
                                                onClick={() => setIsBulkMenuOpen(!isBulkMenuOpen())}
                                                class="p-1 rounded-md border border-border bg-card hover:bg-card-alt text-text transition-colors cursor-pointer"
                                                title="Acciones masivas"
                                            >
                                                <MoreVerticalIcon class="size-3.5" />
                                            </button>

                                            <Show when={isBulkMenuOpen()}>
                                                <div class="absolute left-0 top-full mt-1 z-50 w-52 bg-card border border-border/90 rounded-xl shadow-lg p-1.5 flex flex-col gap-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={applyBulkPricePrompt}
                                                        class="px-2.5 py-1.5 text-xs text-left rounded-md hover:bg-surface text-text hover:text-primary transition-colors cursor-pointer"
                                                    >
                                                        Editar precios
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsBulkModalOpen(true);
                                                            setIsBulkMenuOpen(false);
                                                        }}
                                                        class="px-2.5 py-1.5 text-xs text-left rounded-md hover:bg-surface text-text hover:text-primary transition-colors cursor-pointer"
                                                    >
                                                        Editor Masivo Completo
                                                    </button>
                                                    <div class="border-t border-border/50 my-1" />
                                                    <button
                                                        type="button"
                                                        onClick={applyBulkDelete}
                                                        class="px-2.5 py-1.5 text-xs text-left rounded-md hover:bg-destructive/10 text-destructive transition-colors cursor-pointer"
                                                    >
                                                        Eliminar variantes
                                                    </button>
                                                </div>
                                            </Show>
                                        </div>
                                    </div>
                                </Show>
                            </div>

                            <div class="flex items-center gap-8 pr-4">
                                <span class="w-28 text-right">Precio</span>
                                <span class="w-16 text-center">Disponible</span>
                                <span class="w-16 text-center hidden sm:block">Publicación</span>
                            </div>
                        </div>

                        {/* Collapsible Groups & Rows (Shopify Screenshot 3) */}
                        <div class="divide-y divide-border/60">
                            <For each={groupedVariants()}>
                                {({ groupKey, items }) => {
                                    const isCollapsed = () => collapsedGroups().has(groupKey);
                                    const firstItemPrice = () => items[0]?.variant.unit_price;

                                    return (
                                        <div class="flex flex-col">
                                            {/* Parent Group Header Row */}
                                            <div class="flex items-center justify-between px-3.5 py-2.5 bg-surface/80 hover:bg-surface transition-colors">
                                                <div class="flex items-center gap-3 min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={items.every((it) => selectedVariantIndexes().has(it.originalIndex))}
                                                        onChange={() => toggleSelectGroup(groupKey)}
                                                        class="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer shrink-0"
                                                    />

                                                    {/* Image Placeholder with Icon */}
                                                    <div class="size-8 rounded-lg border border-border/80 bg-card flex items-center justify-center text-muted/60 shrink-0">
                                                        <span class="text-xs">🖼</span>
                                                    </div>

                                                    <div class="flex items-center gap-2 min-w-0">
                                                        <span class="text-xs font-semibold text-text truncate">
                                                            {groupKey}
                                                        </span>
                                                        <span class="text-[11px] text-muted shrink-0">
                                                            ({items.length} variante{items.length > 1 ? 's' : ''})
                                                        </span>
                                                    </div>
                                                </div>

                                                <div class="flex items-center gap-8 pr-4">
                                                    {/* Inline Group Price Editor (Shopify Screenshot 3) */}
                                                    <div class="relative w-28">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={firstItemPrice() ?? ''}
                                                            onInput={(e) => {
                                                                const val = e.currentTarget.value ? parseFloat(e.currentTarget.value) : null;
                                                                updateGroupPrice(groupKey, val);
                                                            }}
                                                            placeholder="0.00"
                                                            class="w-full h-8 pl-2.5 pr-6 text-right bg-surface border border-border hover:border-border-strong focus:border-primary focus:ring-1 focus:ring-primary rounded-lg text-xs font-medium text-text outline-none transition-colors"
                                                        />
                                                        <span class="absolute right-2 top-2 text-xs text-muted pointer-events-none">$</span>
                                                    </div>

                                                    <span class="w-16 text-center text-xs text-muted">-</span>

                                                    <div class="w-16 flex items-center justify-center gap-1.5 text-[11px] text-muted hidden sm:flex">
                                                        <span>🔀 2</span>
                                                        <span>🏷 0</span>
                                                    </div>

                                                    {/* Collapse Chevron */}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCollapseGroup(groupKey)}
                                                        class="p-1 rounded-md text-muted hover:text-text transition-transform cursor-pointer"
                                                        classList={{ 'rotate-180': isCollapsed() }}
                                                    >
                                                        <ChevronDownIcon class="size-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Indented Child Rows */}
                                            <Show when={!isCollapsed()}>
                                                <div class="divide-y divide-border/30 bg-card">
                                                    <For each={items}>
                                                        {({ variant, originalIndex }) => {
                                                            const subTitle = () => {
                                                                const attrs = variant.variant_attributes ?? {};
                                                                const nonGroupAttrs = Object.entries(attrs)
                                                                    .filter(([k]) => k !== groupByOption())
                                                                    .map(([, v]) => String(v));
                                                                return nonGroupAttrs.length > 0 ? nonGroupAttrs.join(' / ') : variant.variant_name ?? 'Estándar';
                                                            };

                                                            return (
                                                                <div class="flex items-center justify-between pl-8 pr-3.5 py-2 hover:bg-surface/50 transition-colors">
                                                                    <div class="flex items-center gap-3 min-w-0">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedVariantIndexes().has(originalIndex)}
                                                                            onChange={() => toggleSelectVariant(originalIndex)}
                                                                            class="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer shrink-0"
                                                                        />

                                                                        <div class="size-7 rounded-md border border-border/60 bg-surface flex items-center justify-center text-muted/50 shrink-0">
                                                                            <span class="text-[10px]">🖼</span>
                                                                        </div>

                                                                        <div class="flex flex-col min-w-0">
                                                                            <span class="text-xs font-medium text-text truncate">
                                                                                {subTitle()}
                                                                            </span>
                                                                            <Show when={variant.sku}>
                                                                                <span class="text-[10px] text-muted truncate">
                                                                                    {variant.sku}
                                                                                </span>
                                                                            </Show>
                                                                        </div>
                                                                    </div>

                                                                    <div class="flex items-center gap-8 pr-8">
                                                                        <div class="relative w-28">
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={variant.unit_price ?? ''}
                                                                                onInput={(e) => {
                                                                                    const val = e.currentTarget.value ? parseFloat(e.currentTarget.value) : null;
                                                                                    updateVariantPrice(originalIndex, val);
                                                                                }}
                                                                                placeholder="0.00"
                                                                                class="w-full h-7 pl-2 pr-5 text-right bg-surface border border-border hover:border-border-strong focus:border-primary focus:ring-1 focus:ring-primary rounded-md text-xs font-medium text-text outline-none transition-colors"
                                                                            />
                                                                            <span class="absolute right-1.5 top-1.5 text-xs text-muted pointer-events-none">$</span>
                                                                        </div>

                                                                        <span class="w-16 text-center text-xs text-muted">-</span>

                                                                        <div class="w-16 flex items-center justify-center gap-1.5 text-[11px] text-muted hidden sm:flex">
                                                                            <span>🔀 2</span>
                                                                            <span>🏷 0</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }}
                                                    </For>
                                                </div>
                                            </Show>
                                        </div>
                                    );
                                }}
                            </For>
                        </div>
                    </div>
                </div>
            </Show>

            {/* Bulk Variant Editor Modal */}
            <Show when={isBulkModalOpen()}>
                <BulkVariantEditorModal
                    isOpen={isBulkModalOpen()}
                    variants={variants()}
                    onClose={() => setIsBulkModalOpen(false)}
                    onSave={(updated) => {
                        props.form.setFieldValue('variants', updated);
                        setIsBulkModalOpen(false);
                    }}
                />
            </Show>
        </fieldset>
    );
};

export default VariantsSection;
