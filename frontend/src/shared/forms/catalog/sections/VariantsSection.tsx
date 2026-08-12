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
import { Component, Show, For, Index, createSignal, createMemo, createEffect, type Accessor } from 'solid-js';
import {
    DragDropProvider,
    DragDropSensors,
    SortableProvider,
    createSortable,
    closestCenter,
    type DragEvent,
} from '@thisbeyond/solid-dnd';
import type { ProductVariantFormData } from '@app/schema/frontend';
import type { CatalogFormApi } from '../catalog-form.types';
import Button from '@shared/ui/Button';
import TextField from '@shared/ui/TextField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/Select';
import { Autocomplete } from '@shared/ui/Autocomplete';
import Checkbox from '@shared/ui/Checkbox';
import { PlusIcon, TrashIcon, GripVerticalIcon, CopyIcon } from '@shared/ui/icons';

interface VariantsSectionProps {
    form: CatalogFormApi;
    hasAttemptedSubmit: () => boolean;
    categoryAttributes: Accessor<Array<{ key: string; label: string; type: string; options?: string[] }>>;
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
    const allVariants = props.form.useStore((s) => s.values.variants);
    const hasDimensionalTracking = props.form.useStore((s) => s.values.has_dimensional_tracking);
    const categoryId = props.form.useStore((s) => s.values.category_id);
    const additionalVariants = createMemo(() => (allVariants() as ProductVariantFormData[]).slice(1));

    // Inner tab state
    const [activeTab, setActiveTab] = createSignal<'list' | 'add'>('list');

    // Toggle state
    const [hasVariants, setHasVariants] = createSignal(false);

    // Auto-detect existing additional variants
    createEffect(() => {
        if (additionalVariants().length > 0) setHasVariants(true);
    });

    // Category attributes passed from parent (eliminates redundant query)
    const categoryAttributes = () => props.categoryAttributes();

    // ── Responsive grid columns ──
    // Uses minmax() for attribute columns so the grid compresses gracefully
    const gridColumns = createMemo(() => {
        const attrs = categoryAttributes();
        const attrCols = attrs.length > 0
            ? attrs.map(() => 'minmax(80px, 120px)').join(' ')
            : '';
        return `20px minmax(100px, 140px) ${attrCols} minmax(80px, 100px) 60px 56px`.trim();
    });

    // Dynamic min-width so the scroll container adapts to actual column count
    const gridMinWidth = createMemo(() => {
        const baseWidth = 20 + 140 + 100 + 60 + 56; // drag + name + price + status + actions
        const attrWidth = categoryAttributes().length * 90;
        return `${baseWidth + attrWidth}px`;
    });

    // DnD — stable IDs: use DB id for persisted, negative index for new
    const variantIds = createMemo(() =>
        additionalVariants().map((v, i) => v.id ?? -(i + 1))
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

    const cloneVariant = (additionalIndex: number) => {
        const current = props.form.getFieldValue('variants') as ProductVariantFormData[];
        const sourceIndex = additionalIndex + 1;
        const source = current[sourceIndex];
        if (!source) return;

        const maxSort = current.reduce((max, v) => Math.max(max, v.sort_order ?? 0), 0);
        const cloned: ProductVariantFormData = {
            ...source,
            id: null,
            sku: source.sku ? `${source.sku}-copia` : '',
            variant_name: source.variant_name ? `${source.variant_name} (Copia)` : null,
            variant_attributes: { ...(source.variant_attributes ?? {}) },
            is_default: false,
            sort_order: maxSort + 1,
        };

        props.form.setFieldValue('variants', [...current, cloned]);
    };

    const addVariantFromForm = () => {
        const current = props.form.getFieldValue('variants') as ProductVariantFormData[];
        const maxSort = current.reduce((max, v) => Math.max(max, v.sort_order ?? 0), 0);
        const productName = props.form.getFieldValue('name') as string;
        const sharedAttrs = props.form.getFieldValue('shared_attributes') as Record<string, unknown>;

        const variant = emptyVariant(maxSort + 1, productName, sharedAttrs);
        const attrs = newAttrValues();
        if (Object.keys(attrs).length > 0) {
            variant.variant_attributes = { ...variant.variant_attributes, ...attrs };
        }
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
                        {/* POS/ERP High-Density Matrix Table */}
                        <div class="space-y-2 mb-4 overflow-x-auto scrollbar-thin">
                            {/* Column headers */}
                            <div
                                class="grid gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted"
                                style={{
                                    'grid-template-columns': gridColumns(),
                                    'min-width': gridMinWidth(),
                                }}
                            >
                                <div />
                                <div class="truncate">Nombre / SKU</div>
                                <For each={categoryAttributes()}>
                                    {(attr) => <div class="truncate" title={attr.label}>{attr.label}</div>}
                                </For>
                                <div>Precio</div>
                                <div>Estado</div>
                                <div>Acciones</div>
                            </div>

                            {/* Variant rows */}
                            <DragDropProvider onDragEnd={onDragEnd} collisionDetector={closestCenter}>
                                <DragDropSensors />
                                <SortableProvider ids={variantIds()}>
                                    <div class="space-y-2">
                                        <Index each={additionalVariants()}>
                                            {(variant, index) => {
                                                const formIndex = () => index + 1;
                                                const variantData = () => (allVariants() as ProductVariantFormData[])[formIndex()];
                                                const sortableId = () => variant().id ?? -(index + 1);
                                                const sortable = createSortable(sortableId());

                                                return (
                                                    <div
                                                        ref={sortable.ref}
                                                        class="grid items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border/40 hover:border-primary/30 transition-all group"
                                                        classList={{ 'opacity-25': sortable.isActiveDraggable }}
                                                        style={{
                                                            'grid-template-columns': gridColumns(),
                                                            'min-width': gridMinWidth(),
                                                        }}
                                                    >
                                                        {/* Drag handle */}
                                                        <div
                                                            {...sortable.dragActivators}
                                                            class="flex items-center justify-center text-muted/30 group-hover:text-muted cursor-grab"
                                                        >
                                                            <GripVerticalIcon class="size-3.5" />
                                                        </div>

                                                        {/* Variant Name / SKU — native input for focus stability */}
                                                        <div class="space-y-1">
                                                            <props.form.Field name={`variants[${formIndex()}].variant_name`}>
                                                                {(field) => (
                                                                    <input
                                                                        type="text"
                                                                        value={field().state.value ?? ''}
                                                                        onInput={(e) => field().handleChange(e.currentTarget.value || null)}
                                                                        onBlur={() => field().handleBlur()}
                                                                        placeholder={`Variante ${formIndex()}`}
                                                                        class="w-full bg-card-alt border border-border rounded-md px-2 py-1 text-xs text-text font-medium outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-colors"
                                                                    />
                                                                )}
                                                            </props.form.Field>
                                                        </div>

                                                        {/* Dynamic Attribute Inline Inputs — native inputs to avoid re-mount on store change */}
                                                        <For each={categoryAttributes()}>
                                                            {(attr) => {
                                                                const val = () => variantData()?.variant_attributes?.[attr.key];
                                                                const updateAttr = (newVal: unknown) => {
                                                                    const currentAttrs = (props.form.getFieldValue(`variants[${formIndex()}].variant_attributes`) ?? {}) as Record<string, unknown>;
                                                                    props.form.setFieldValue(`variants[${formIndex()}].variant_attributes`, { ...currentAttrs, [attr.key]: newVal });
                                                                };

                                                                return (
                                                                    <div>
                                                                        <Show
                                                                            when={attr.type === 'BOOLEAN'}
                                                                            fallback={
                                                                                <Show
                                                                                    when={(attr.options ?? []).length > 0}
                                                                                    fallback={
                                                                                        <input
                                                                                            type={attr.type === 'NUMBER' ? 'number' : 'text'}
                                                                                            value={val() != null ? String(val()) : ''}
                                                                                            onInput={(e) => updateAttr(attr.type === 'NUMBER' ? (parseFloat(e.currentTarget.value) || null) : e.currentTarget.value)}
                                                                                            placeholder={attr.label}
                                                                                            class="w-full bg-card-alt border border-border rounded-md px-2 py-1 text-xs text-text outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-colors"
                                                                                        />
                                                                                    }
                                                                                >
                                                                                    <Autocomplete.Root>
                                                                                        <Autocomplete.Input<string>
                                                                                            value={val() != null ? String(val()) : ''}
                                                                                            onInputChange={() => {}}
                                                                                            options={attr.options ?? []}
                                                                                            optionValue={(o) => o}
                                                                                            optionLabel={(o) => o}
                                                                                            onSelect={(opt) => updateAttr(opt ?? '')}
                                                                                            placeholder={attr.label}
                                                                                            minLength={0}
                                                                                            clearOnBlur={false}
                                                                                        />
                                                                                    </Autocomplete.Root>
                                                                                </Show>
                                                                            }
                                                                        >
                                                                            <Checkbox
                                                                                checked={val() === true}
                                                                                onChange={(checked) => updateAttr(checked)}
                                                                            />
                                                                        </Show>
                                                                    </div>
                                                                );
                                                            }}
                                                        </For>

                                                        {/* Base Price Override — native input for focus stability */}
                                                        <props.form.Field name={`variants[${formIndex()}].base_price`}>
                                                            {(field) => (
                                                                <input
                                                                    type="text"
                                                                    value={field().state.value != null ? String(field().state.value) : ''}
                                                                    onInput={(e) => {
                                                                        const val = e.currentTarget.value;
                                                                        field().handleChange(val === '' ? null : parseFloat(val));
                                                                    }}
                                                                    onBlur={() => field().handleBlur()}
                                                                    placeholder="Hereda"
                                                                    class="w-full bg-card-alt border border-border rounded-md px-2 py-1 text-xs font-mono text-text outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-colors"
                                                                />
                                                            )}
                                                        </props.form.Field>

                                                        {/* Active Status Toggle */}
                                                        {/* @ts-expect-error - Dynamic array paths cannot be fully inferred */}
                                                        <props.form.Field name={`variants[${formIndex()}].is_active`}>
                                                            {(field) => (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => field().handleChange(!field().state.value)}
                                                                    class="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase cursor-pointer transition-colors"
                                                                    classList={{
                                                                        'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20': field().state.value,
                                                                        'bg-danger/10 text-danger border border-danger/20': !field().state.value,
                                                                    }}
                                                                >
                                                                    {field().state.value ? 'Sí' : 'No'}
                                                                </button>
                                                            )}
                                                        </props.form.Field>

                                                        {/* Clone & Delete Actions */}
                                                        <div class="flex items-center gap-1 justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => cloneVariant(index)}
                                                                class="p-1 rounded-md text-muted/50 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                                                                title="Clonar variante"
                                                            >
                                                                <CopyIcon class="size-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeVariant(index)}
                                                                class="p-1 rounded-md text-muted/50 hover:text-danger hover:bg-danger/10 transition-all cursor-pointer"
                                                                title="Eliminar variante"
                                                            >
                                                                <TrashIcon class="size-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            }}
                                        </Index>
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
                                    'grid-template-columns': `${categoryAttributes().map(() => 'minmax(80px, 1fr)').join(' ')} minmax(80px, 120px) 80px`.trim(),
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
                                                when={attr.type === 'BOOLEAN'}
                                                fallback={
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
                                                        <Autocomplete.Root>
                                                            <Autocomplete.Input<string>
                                                                value={newAttrValues()[attr.key] ?? ''}
                                                                onInputChange={() => {}}
                                                                options={attr.options ?? []}
                                                                optionValue={(o) => o}
                                                                optionLabel={(o) => o}
                                                                onSelect={(opt) => setNewAttrValues(prev => ({ ...prev, [attr.key]: opt ?? '' }))}
                                                                placeholder={attr.label}
                                                                minLength={0}
                                                                clearOnBlur={false}
                                                            />
                                                        </Autocomplete.Root>
                                                    </Show>
                                                }
                                            >
                                                <Checkbox
                                                    checked={newAttrValues()[attr.key] === 'true'}
                                                    onChange={(checked) => setNewAttrValues(prev => ({ ...prev, [attr.key]: String(checked) }))}
                                                />
                                            </Show>
                                        </div>
                                    )}
                                </For>

                                {/* Price input */}
                                <TextField.Root
                                    value={newPrice()}
                                    onChange={setNewPrice}
                                >
                                    <TextField.Input
                                        type="text"
                                        placeholder="0.00"
                                        class="font-mono"
                                    />
                                </TextField.Root>

                                {/* Available select */}
                                <Select
                                    value={newIsActive() ? 'yes' : 'no'}
                                    onChange={(v: string | null) => setNewIsActive(v === 'yes')}
                                    options={['yes', 'no']}
                                    optionValue={(o: string) => o}
                                    optionTextValue={(o: string) => o === 'yes' ? 'Sí' : 'No'}
                                    placeholder="Sí"
                                    itemComponent={(itemProps: any) => (
                                        <SelectItem item={itemProps.item}>
                                            {itemProps.item.rawValue === 'yes' ? 'Sí' : 'No'}
                                        </SelectItem>
                                    )}
                                >
                                    <SelectTrigger>
                                        <SelectValue<string>>
                                            {(state) => state.selectedOption() === 'yes' ? 'Sí' : 'No'}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent />
                                </Select>
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
