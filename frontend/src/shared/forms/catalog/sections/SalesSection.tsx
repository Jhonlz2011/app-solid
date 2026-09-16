/**
 * SalesSection — Shopify-style progressive disclosure pricing card.
 * Main input: Precio [ 0,00 $ ]
 * Progressive disclosure chips: [+ Último costo], [+ Tarifa IVA], [+ UOM de Venta]
 * (Omits "precio de comparación" to adhere strictly to existing ERP schema fields).
 */
import { Component, Show, createSignal } from 'solid-js';
import TextField, { FieldLabel } from '@form/TextField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@form/Select';
import { UomSelect } from '@shared/ui/selectors';
import type { CatalogFormApi } from '../catalog-form.types';
import { TagIcon } from '@icons/TagIcon';
import { PlusIcon } from '@icons/PlusIcon';
import { CloseIcon } from '@icons/CloseIcon';

const IVA_OPTIONS = [
    { value: 0, label: '0% – Exento' },
    { value: 2, label: 'IVA – 12%' },
    { value: 4, label: 'IVA – 15%' },
] as const;

type SelectOption<T> = { value: T; label: string };

interface SalesSectionProps {
    form: CatalogFormApi;
    hasAttemptedSubmit: () => boolean;
}

export const SalesSection: Component<SalesSectionProps> = (props) => {
    const rawCost = props.form.useStore((s) => s.values.variants?.[0]?.last_cost);
    const rawIva = props.form.useStore((s) => s.values.iva_rate_code);
    const rawSaleUom = props.form.useStore((s) => s.values.variants?.[0]?.sale_uom_id);

    // Toggle states for progressive disclosure
    const [showCost, setShowCost] = createSignal<boolean>(Boolean(rawCost() && Number(rawCost()) > 0));
    const [showIva, setShowIva] = createSignal<boolean>(Boolean(rawIva() !== undefined));
    const [showSaleUom, setShowSaleUom] = createSignal<boolean>(Boolean(rawSaleUom()));

    return (
        <fieldset class="bg-card border border-border/90 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col gap-4">
            {/* ── Header ── */}
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <div class="p-1 rounded-md bg-primary-soft text-primary">
                        <TagIcon class="size-4" />
                    </div>
                    <h3 class="text-sm font-semibold text-text">Precios</h3>
                </div>
            </div>

            {/* ── Main Price Input ── */}
            <props.form.Field name="default_unit_price">
                {(field) => (
                    <div class="space-y-1">
                        <FieldLabel>Precio Unitario de Venta *</FieldLabel>
                        <div class="relative max-w-sm">
                            <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={field().state.value ?? ''}
                                onInput={(e) => {
                                    const val = e.currentTarget.value ? parseFloat(e.currentTarget.value) : 0;
                                    field().handleChange(val);
                                    // Sincronizar con variants[0].unit_price
                                    props.form.setFieldValue('variants[0].unit_price', val);
                                }}
                                placeholder="0.00"
                                class="w-full h-9 pl-3 pr-8 bg-surface border border-border hover:border-border-strong focus:border-primary focus:ring-1 focus:ring-primary rounded-lg text-sm font-mono text-text outline-none transition-colors"
                            />
                            <span class="absolute right-3 top-2 text-sm text-muted pointer-events-none">$</span>
                        </div>
                    </div>
                )}
            </props.form.Field>

            {/* ── Progressive Disclosure Chips Toolbar ── */}
            <div class="flex items-center gap-2 flex-wrap pt-1">
                <Show when={!showCost()}>
                    <button
                        type="button"
                        onClick={() => setShowCost(true)}
                        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border/80 hover:border-primary/50 hover:bg-primary-soft/30 text-xs text-muted hover:text-text transition-all cursor-pointer shadow-2xs"
                    >
                        <PlusIcon class="size-3 text-muted" />
                        <span>Costo / Último costo</span>
                    </button>
                </Show>

                <Show when={!showIva()}>
                    <button
                        type="button"
                        onClick={() => setShowIva(true)}
                        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border/80 hover:border-primary/50 hover:bg-primary-soft/30 text-xs text-muted hover:text-text transition-all cursor-pointer shadow-2xs"
                    >
                        <PlusIcon class="size-3 text-muted" />
                        <span>Tarifa IVA</span>
                    </button>
                </Show>

                <Show when={!showSaleUom()}>
                    <button
                        type="button"
                        onClick={() => setShowSaleUom(true)}
                        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border/80 hover:border-primary/50 hover:bg-primary-soft/30 text-xs text-muted hover:text-text transition-all cursor-pointer shadow-2xs"
                    >
                        <PlusIcon class="size-3 text-muted" />
                        <span>UOM de Venta</span>
                    </button>
                </Show>
            </div>

            {/* ── Revealed Auxiliary Fields ── */}
            <Show when={showCost() || showIva() || showSaleUom()}>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border/60">
                    {/* Costo */}
                    <Show when={showCost()}>
                        <props.form.Field name={"variants[0].last_cost" as any}>
                            {(field) => (
                                <div class="space-y-1">
                                    <div class="flex items-center justify-between">
                                        <FieldLabel>Último Costo</FieldLabel>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                (field() as any).handleChange(null);
                                                setShowCost(false);
                                            }}
                                            class="text-muted/60 hover:text-destructive p-0.5 cursor-pointer"
                                            title="Ocultar costo"
                                        >
                                            <CloseIcon class="size-3" />
                                        </button>
                                    </div>
                                    <div class="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min={0}
                                            value={field().state.value ?? ''}
                                            onInput={(e) => (field() as any).handleChange(e.currentTarget.value ? parseFloat(e.currentTarget.value) : null)}
                                            placeholder="0.00"
                                            class="w-full h-9 pl-3 pr-8 bg-surface border border-border hover:border-border-strong focus:border-primary focus:ring-1 focus:ring-primary rounded-lg text-sm font-mono text-text outline-none transition-colors"
                                        />
                                        <span class="absolute right-3 top-2 text-sm text-muted pointer-events-none">$</span>
                                    </div>
                                </div>
                            )}
                        </props.form.Field>
                    </Show>

                    {/* IVA */}
                    <Show when={showIva()}>
                        <props.form.Field name="iva_rate_code">
                            {(field) => {
                                const selectedIva = () => IVA_OPTIONS.find((o) => o.value === field().state.value);
                                return (
                                    <div class="space-y-1">
                                        <div class="flex items-center justify-between">
                                            <FieldLabel>Tarifa IVA *</FieldLabel>
                                            <button
                                                type="button"
                                                onClick={() => setShowIva(false)}
                                                class="text-muted/60 hover:text-destructive p-0.5 cursor-pointer"
                                                title="Ocultar IVA"
                                            >
                                                <CloseIcon class="size-3" />
                                            </button>
                                        </div>
                                        <Select
                                            value={selectedIva()}
                                            onChange={(opt: SelectOption<number> | null) => opt && field().handleChange(opt.value)}
                                            options={[...IVA_OPTIONS]}
                                            optionValue="value"
                                            optionTextValue="label"
                                            placeholder="Seleccionar IVA..."
                                            itemComponent={(itemProps) => (
                                                <SelectItem item={itemProps.item}>{itemProps.item.rawValue?.label}</SelectItem>
                                            )}
                                        >
                                            <SelectTrigger class="h-9 bg-surface border border-border rounded-lg text-sm">
                                                <SelectValue<SelectOption<number>>>
                                                    {(state) => state.selectedOption()?.label ?? 'Seleccionar...'}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent />
                                        </Select>
                                    </div>
                                );
                            }}
                        </props.form.Field>
                    </Show>

                    {/* UOM de Venta */}
                    <Show when={showSaleUom()}>
                        <props.form.Field name={"variants[0].sale_uom_id" as any}>
                            {(field) => (
                                <div class="space-y-1">
                                    <div class="flex items-center justify-between">
                                        <FieldLabel>UOM de Venta</FieldLabel>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                (field() as any).handleChange(null);
                                                setShowSaleUom(false);
                                            }}
                                            class="text-muted/60 hover:text-destructive p-0.5 cursor-pointer"
                                            title="Ocultar UOM"
                                        >
                                            <CloseIcon class="size-3" />
                                        </button>
                                    </div>
                                    <UomSelect
                                        value={field().state.value}
                                        onChange={(id) => (field() as any).handleChange(id ?? null)}
                                        placeholder="Hereda del inventario"
                                    />
                                </div>
                            )}
                        </props.form.Field>
                    </Show>
                </div>
            </Show>
        </fieldset>
    );
};

export default SalesSection;
