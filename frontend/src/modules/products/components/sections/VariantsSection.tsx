/**
 * VariantsSection V2 — Tabbed variant manager inspired by modern POS/ERP design.
 *
 * Inner tabs:
 *   [Variantes]    → List of existing variants (table-like rows)
 *   [Agregar Nueva] → Inline form to add a new variant with attribute columns
 *
 * Attribute columns are dynamically derived from the category's attributes.
 * Each variant row shows: attribute values + Price + Active status.
 */
import { Component, Show, For, createSignal, createMemo } from 'solid-js';
import {
    DragDropProvider,
    DragDropSensors,
    SortableProvider,
    closestCenter,
    type DragEvent,
} from '@thisbeyond/solid-dnd';
import type { ProductVariantFormData } from '@app/schema/frontend';
import { useCategoryFormSchema } from '@/modules/categories/data/categories.queries';
import Button from '@shared/ui/Button';
import { PlusIcon, TrashIcon, GripVerticalIcon, MoreVerticalIcon } from '@shared/ui/icons';

interface VariantsSectionProps {
    form: any;
    hasAttemptedSubmit: () => boolean;
}

const emptyVariant = (sortOrder: number, productName?: string, sharedAttrs?: Record<string, unknown>): ProductVariantFormData => ({
    id: null,
    sku: '',
    variant_name: productName ?? null,
    variant_attributes: sharedAttrs ? { ...sharedAttrs } : {},
    content_quantity: 1,
    sale_uom_id: null,
    base_price: null,
    last_cost: null,
    barcode: null,
    image_urls: null,
    std_length_cm: null,
    std_width_cm: null,
    is_default: false,
    is_active: true,
    sort_order: sortOrder,
});

const VariantsSection: Component<VariantsSectionProps> = (props) => {
    const allVariants = props.form.useStore((s: any) => s.values.variants);
    const hasDimensionalTracking = props.form.useStore((s: any) => s.values.has_dimensional_tracking);
    const categoryId = props.form.useStore((s: any) => s.values.category_id);
    const additionalVariants = createMemo(() => (allVariants() as ProductVariantFormData[]).slice(1));

    // Inner tab state
    const [activeTab, setActiveTab] = createSignal<'list' | 'add'>('list');

    // Toggle state
    const [hasVariants, setHasVariants] = createSignal(false);

    // Auto-detect existing additional variants
    createMemo(() => {
        if (additionalVariants().length > 0) setHasVariants(true);
    });

    // Category attributes for variant columns
    const schemaQuery = useCategoryFormSchema(() => categoryId() > 0 ? categoryId() : null);
    const categoryAttributes = createMemo(() => {
        if (!schemaQuery.data) return [];
        return ((schemaQuery.data as any).attributes ?? []) as Array<{
            key: string;
            label: string;
            type: string;
            options?: string[];
        }>;
    });

    // DnD
    const variantIds = createMemo(() =>
        additionalVariants().map((v, i) => v.id ?? `new-${v.sort_order ?? i}`)
    );

    // ── New variant form state ──
    const [newAttrValues, setNewAttrValues] = createSignal<Record<string, string>>({});
    const [newPrice, setNewPrice] = createSignal('');
    const [newIsActive, setNewIsActive] = createSignal(true);

    const clearNewForm = () => {
        setNewAttrValues({});
        setNewPrice('');
        setNewIsActive(true);
    };

    const addVariant = () => {
        const current = props.form.getFieldValue('variants') as ProductVariantFormData[];
        const maxSort = current.reduce((max, v) => Math.max(max, v.sort_order ?? 0), 0);
        const productName = props.form.getFieldValue('name') as string;
        const sharedAttrs = props.form.getFieldValue('shared_attributes') as Record<string, unknown>;
        props.form.setFieldValue('variants', [...current, emptyVariant(maxSort + 1, productName, sharedAttrs)]);
        if (!hasVariants()) setHasVariants(true);
    };

    const addVariantFromForm = () => {
        const current = props.form.getFieldValue('variants') as ProductVariantFormData[];
        const maxSort = current.reduce((max, v) => Math.max(max, v.sort_order ?? 0), 0);
        const productName = props.form.getFieldValue('name') as string;
        const sharedAttrs = props.form.getFieldValue('shared_attributes') as Record<string, unknown>;

        const variant = emptyVariant(maxSort + 1, productName, sharedAttrs);
        // Merge attribute values from form
        const attrs = newAttrValues();
        if (Object.keys(attrs).length > 0) {
            variant.variant_attributes = { ...variant.variant_attributes, ...attrs };
        }
        // Set price if provided
        const price = parseFloat(newPrice());
        if (!isNaN(price) && price > 0) {
            variant.base_price = price;
        }
        variant.is_active = newIsActive();

        props.form.setFieldValue('variants', [...current, variant]);
        if (!hasVariants()) setHasVariants(true);
        clearNewForm();
        setActiveTab('list');
    };

    const removeVariant = (additionalIndex: number) => {
        const current = props.form.getFieldValue('variants') as ProductVariantFormData[];
        props.form.setFieldValue('variants', current.filter((_, i) => i !== additionalIndex + 1));
        if (current.length <= 2) setHasVariants(false);
    };

    const onDragEnd = (event: DragEvent) => {
        const { draggable, droppable } = event;
        if (!draggable || !droppable || draggable.id === droppable.id) return;

        const addVars = additionalVariants();
        const fromIdx = addVars.findIndex((v, i) => (v.id ?? `new-${v.sort_order ?? i}`) === draggable.id);
        const toIdx = addVars.findIndex((v, i) => (v.id ?? `new-${v.sort_order ?? i}`) === droppable.id);
        if (fromIdx < 0 || toIdx < 0) return;

        const reordered = [...addVars];
        const [item] = reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, item);

        const def = (props.form.getFieldValue('variants') as ProductVariantFormData[])[0];
        props.form.setFieldValue('variants', [
            def,
            ...reordered.map((v, i) => ({ ...v, sort_order: i + 1 })),
        ]);
    };

    return (
        <fieldset class="bg-surface/30 rounded-2xl border border-border/40 overflow-hidden">
            {/* ── Header with inner tabs ── */}
            <div class="flex items-center justify-between px-4 sm:px-5 pt-4 pb-0">
                <div class="flex items-center gap-2">
                    <div class="w-1 h-4 rounded-full bg-info" />
                    <span class="text-sm font-bold text-text">Variantes</span>
                </div>

                <div class="flex items-center gap-0.5">
                    {/* Inner tab buttons */}
                    <button
                        type="button"
                        onClick={() => setActiveTab('list')}
                        class="px-3 py-1.5 text-xs font-medium rounded-t-lg transition-all cursor-pointer"
                        classList={{
                            'text-primary border-b-2 border-primary bg-primary/5': activeTab() === 'list',
                            'text-muted hover:text-text': activeTab() !== 'list',
                        }}
                    >
                        Variantes
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('add')}
                        class="px-3 py-1.5 text-xs font-medium rounded-t-lg transition-all cursor-pointer"
                        classList={{
                            'text-primary border-b-2 border-primary bg-primary/5': activeTab() === 'add',
                            'text-muted hover:text-text': activeTab() !== 'add',
                        }}
                    >
                        Agregar Nueva
                    </button>
                    <button
                        type="button"
                        class="p-1.5 text-muted/50 hover:text-muted transition-colors rounded-lg cursor-pointer"
                        title="Configuración"
                    >
                        <MoreVerticalIcon class="size-3.5" />
                    </button>
                </div>
            </div>

            <div class="border-t border-border/30 mt-2" />

            {/* ── Tab Content ── */}
            <div class="p-4 sm:p-5">
                {/* ─── List Tab ─── */}
                <Show when={activeTab() === 'list'}>
                    <Show
                        when={additionalVariants().length > 0}
                        fallback={
                            <div class="flex flex-col items-center justify-center py-10 text-center">
                                <p class="text-base font-semibold text-text">No hay variantes</p>
                                <p class="text-sm text-muted mt-1 max-w-xs">
                                    Configura diferentes opciones para este producto
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    class="mt-4"
                                    onClick={() => setActiveTab('add')}
                                    icon={<PlusIcon class="size-3.5" />}
                                >
                                    Agregar Variante
                                </Button>
                            </div>
                        }
                    >
                        {/* Variant summary table */}
                        <div class="space-y-2 mb-4">
                            {/* Column headers */}
                            <div class="hidden sm:grid gap-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted"
                                style={{
                                    'grid-template-columns': `24px ${categoryAttributes().length > 0 ? categoryAttributes().map(() => '1fr').join(' ') : ''} 100px 80px 36px`.trim(),
                                }}
                            >
                                <div />
                                <For each={categoryAttributes()}>
                                    {(attr) => <div class="truncate">{attr.label}</div>}
                                </For>
                                <div>Precio</div>
                                <div>Estado</div>
                                <div />
                            </div>

                            {/* Variant rows */}
                            <DragDropProvider onDragEnd={onDragEnd} collisionDetector={closestCenter}>
                                <DragDropSensors />
                                <SortableProvider ids={variantIds()}>
                                    <div class="space-y-1.5">
                                        <For each={additionalVariants()}>
                                            {(variant, index) => {
                                                const variantData = () => (allVariants() as ProductVariantFormData[])[index() + 1];

                                                return (
                                                    <div
                                                        class="grid items-center gap-3 px-3 py-2.5 rounded-xl bg-card border border-border/40 hover:border-primary/30 transition-all group"
                                                        style={{
                                                            'grid-template-columns': `24px ${categoryAttributes().length > 0 ? categoryAttributes().map(() => '1fr').join(' ') : ''} 100px 80px 36px`.trim(),
                                                        }}
                                                    >
                                                        {/* Drag handle */}
                                                        <div class="flex items-center justify-center text-muted/30 group-hover:text-muted cursor-grab">
                                                            <GripVerticalIcon class="size-3.5" />
                                                        </div>

                                                        {/* Attribute values */}
                                                        <For each={categoryAttributes()}>
                                                            {(attr) => {
                                                                const val = () => variantData()?.variant_attributes?.[attr.key];
                                                                return (
                                                                    <div class="text-sm text-text truncate" title={String(val() ?? '')}>
                                                                        <Show when={val()} fallback={<span class="text-muted/40 text-xs">—</span>}>
                                                                            {String(val())}
                                                                        </Show>
                                                                    </div>
                                                                );
                                                            }}
                                                        </For>

                                                        {/* Price */}
                                                        <div class="text-sm font-mono font-semibold tabular-nums">
                                                            <Show
                                                                when={variantData()?.base_price != null}
                                                                fallback={<span class="text-muted/40 text-xs">Hereda</span>}
                                                            >
                                                                ${Number(variantData()?.base_price ?? 0).toFixed(2)}
                                                            </Show>
                                                        </div>

                                                        {/* Active status */}
                                                        <div>
                                                            <Show
                                                                when={variantData()?.is_active}
                                                                fallback={
                                                                    <span class="text-[10px] px-2 py-0.5 rounded-md bg-danger/10 text-danger font-semibold uppercase">
                                                                        No
                                                                    </span>
                                                                }
                                                            >
                                                                <span class="text-[10px] px-2 py-0.5 rounded-md bg-success/10 text-success font-semibold uppercase">
                                                                    Sí
                                                                </span>
                                                            </Show>
                                                        </div>

                                                        {/* Remove */}
                                                        <button
                                                            type="button"
                                                            onClick={() => removeVariant(index())}
                                                            class="p-1 rounded-lg text-muted/30 hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                                        >
                                                            <TrashIcon class="size-3.5" />
                                                        </button>
                                                    </div>
                                                );
                                            }}
                                        </For>
                                    </div>
                                </SortableProvider>
                            </DragDropProvider>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTab('add')}
                            icon={<PlusIcon class="size-3.5" />}
                        >
                            Agregar Variante
                        </Button>
                    </Show>
                </Show>

                {/* ─── Add New Tab ─── */}
                <Show when={activeTab() === 'add'}>
                    <div class="space-y-4">
                        {/* Dynamic attribute inputs from category */}
                        <Show
                            when={categoryAttributes().length > 0}
                            fallback={
                                <p class="text-xs text-muted">
                                    Selecciona una categoría para ver los atributos disponibles como columnas de variante.
                                </p>
                            }
                        >
                            <div class="grid gap-3"
                                style={{
                                    'grid-template-columns': `${categoryAttributes().map(() => '1fr').join(' ')} 120px 80px`.trim(),
                                }}
                            >
                                {/* Attribute column headers */}
                                <For each={categoryAttributes()}>
                                    {(attr) => (
                                        <div class="text-[11px] font-semibold uppercase tracking-wider text-muted truncate">
                                            {attr.label}
                                        </div>
                                    )}
                                </For>
                                <div class="text-[11px] font-semibold uppercase tracking-wider text-muted">Precio</div>
                                <div class="text-[11px] font-semibold uppercase tracking-wider text-muted">Disponible</div>

                                {/* Attribute inputs */}
                                <For each={categoryAttributes()}>
                                    {(attr) => (
                                        <div>
                                            <Show
                                                when={attr.options && attr.options.length > 0}
                                                fallback={
                                                    <input
                                                        type={attr.type === 'NUMBER' ? 'number' : 'text'}
                                                        value={newAttrValues()[attr.key] ?? ''}
                                                        onInput={(e) => setNewAttrValues(prev => ({ ...prev, [attr.key]: e.currentTarget.value }))}
                                                        placeholder={attr.label}
                                                        class="w-full bg-card-alt border border-border rounded-lg px-2.5 py-2 text-sm text-text placeholder:text-muted/40 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
                                                    />
                                                }
                                            >
                                                <select
                                                    value={newAttrValues()[attr.key] ?? ''}
                                                    onChange={(e) => setNewAttrValues(prev => ({ ...prev, [attr.key]: e.currentTarget.value }))}
                                                    class="w-full bg-card-alt border border-border rounded-lg px-2.5 py-2 text-sm text-text outline-none focus:border-primary/50 cursor-pointer appearance-none"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    <For each={attr.options}>
                                                        {(opt) => <option value={opt}>{opt}</option>}
                                                    </For>
                                                </select>
                                            </Show>
                                        </div>
                                    )}
                                </For>

                                {/* Price input */}
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={newPrice()}
                                    onInput={(e) => setNewPrice(e.currentTarget.value)}
                                    placeholder="0.00"
                                    class="w-full bg-card-alt border border-border rounded-lg px-2.5 py-2 text-sm font-mono text-text placeholder:text-muted/40 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
                                />

                                {/* Available select */}
                                <select
                                    value={newIsActive() ? 'yes' : 'no'}
                                    onChange={(e) => setNewIsActive(e.currentTarget.value === 'yes')}
                                    class="w-full bg-card-alt border border-border rounded-lg px-2.5 py-2 text-sm text-text outline-none focus:border-primary/50 cursor-pointer appearance-none"
                                >
                                    <option value="yes">Sí</option>
                                    <option value="no">No</option>
                                </select>
                            </div>
                        </Show>

                        {/* Action buttons */}
                        <div class="flex items-center justify-end gap-2 pt-2 border-t border-border/30">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => { clearNewForm(); setActiveTab('list'); }}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={addVariantFromForm}
                            >
                                Agregar Variante
                            </Button>
                        </div>
                    </div>
                </Show>
            </div>
        </fieldset>
    );
};

export default VariantsSection;
