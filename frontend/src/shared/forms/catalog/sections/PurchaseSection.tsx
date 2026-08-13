import { Component, Show, For, createMemo } from 'solid-js';
import TextField from '@shared/ui/TextField';
import type { ProductVariantFormData } from '@app/schema/frontend';
import type { CatalogFormApi } from '../catalog-form.types';
import SectionHeader from '../../../../modules/products/components/ui/SectionHeader';

interface PurchaseSectionProps {
    form: CatalogFormApi;
    hasAttemptedSubmit: () => boolean;
    additionalVariants: () => ProductVariantFormData[];
}

const PurchaseSection: Component<PurchaseSectionProps> = (props) => {
    const variants = props.form.useStore((s) => s.values.variants) as () => ProductVariantFormData[];
    const defaultBasePrice = props.form.useStore((s) => s.values.default_base_price) as () => number;
    const additionalVariants = () => props.additionalVariants();

    // Calculated margin for the default variant
    const defaultCost = createMemo(() => {
        const v0 = variants()[0];
        return v0?.last_cost != null ? Number(v0.last_cost) : 0;
    });
    const defaultMargin = createMemo(() => {
        const price = Number(defaultBasePrice()) || 0;
        const cost = defaultCost();
        if (cost <= 0 || price <= 0) return null;
        return ((price - cost) / cost * 100).toFixed(1);
    });

    return (
        <div class="flex flex-col gap-4 sm:gap-5">
            {/* ── Default variant cost ── */}
            <fieldset class="space-y-4 bg-surface/30 p-4 sm:p-5 rounded-2xl border border-border/40">
                <SectionHeader
                    color="warning"
                    title="Costos de Compra"
                    description="Último costo de adquisición registrado"
                />

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Último Costo */}
                    <props.form.Field name={"variants[0].last_cost" }>
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Último Costo</TextField.Label>
                                <TextField.Input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    class="font-mono"
                                    placeholder="0.00"
                                />
                                <TextField.Description>Se actualiza automáticamente con cada compra</TextField.Description>
                            </TextField.Root>
                        )}
                    </props.form.Field>

                    {/* Margen calculado (read-only) */}
                    <div class="space-y-1">
                        <span class="text-sm font-medium text-text">Margen Estimado</span>
                        <div class="flex items-center gap-2 h-10 px-3 bg-card-alt border border-border rounded-lg">
                            <Show
                                when={defaultMargin() !== null}
                                fallback={
                                    <span class="text-sm text-muted/50 italic">Sin datos suficientes</span>
                                }
                            >
                                <span
                                    class="text-sm font-mono font-semibold tabular-nums"
                                    classList={{
                                        'text-success': Number(defaultMargin()) > 0,
                                        'text-danger': Number(defaultMargin()) < 0,
                                        'text-muted': Number(defaultMargin()) === 0,
                                    }}
                                >
                                    {Number(defaultMargin()) > 0 ? '+' : ''}{defaultMargin()}%
                                </span>
                                <span class="text-[10px] text-muted ml-1">(Precio − Costo) / Costo</span>
                            </Show>
                        </div>
                        <p class="text-[11px] text-muted">Calculado sobre precio de venta vs último costo</p>
                    </div>
                </div>
            </fieldset>

            {/* ── Variant cost overrides ── */}
            <Show when={additionalVariants().length > 0}>
                <fieldset class="space-y-3 bg-surface/30 p-4 sm:p-5 rounded-2xl border border-border/40">
                    <SectionHeader
                        color="warning"
                        title="Costos por Variante"
                        description="Cada variante puede tener su propio costo de adquisición"
                    />

                    {/* Header row */}
                    <div class="hidden sm:grid grid-cols-[1fr_140px_140px_100px] gap-3 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                        <div>Variante</div>
                        <div>Último Costo</div>
                        <div>Margen</div>
                        <div>Estado</div>
                    </div>

                    {/* Variant rows */}
                    <div class="space-y-1.5">
                        <For each={additionalVariants()}>
                            {(variant, index) => {
                                const formIndex = () => index() + 1;
                                const variantPrice = () => {
                                    const v = variants()[formIndex()];
                                    return v?.base_price != null ? Number(v.base_price) : Number(defaultBasePrice()) || 0;
                                };
                                const variantCost = () => {
                                    const v = variants()[formIndex()];
                                    return v?.last_cost != null ? Number(v.last_cost) : 0;
                                };
                                const variantMargin = () => {
                                    const p = variantPrice();
                                    const c = variantCost();
                                    if (c <= 0 || p <= 0) return null;
                                    return ((p - c) / c * 100).toFixed(1);
                                };

                                return (
                                    <div class="grid grid-cols-1 sm:grid-cols-[1fr_140px_140px_100px] gap-3 items-center px-3 py-2.5 rounded-xl bg-card border border-border/40">
                                        {/* Name */}
                                        <div class="flex items-center gap-2">
                                            <div class="size-2 rounded-full bg-warning/40" />
                                            <span class="text-sm font-medium text-text truncate">
                                                {variants()[formIndex()]?.variant_name || variants()[formIndex()]?.sku || variant.variant_name || variant.sku || `Variante ${formIndex()}`}
                                            </span>
                                        </div>

                                        {/* Cost */}   
                                        <props.form.Field name={`variants[${formIndex()}].last_cost`}>
                                            {(field) => (
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={field().state.value ?? ''}
                                                    onInput={(e) => {
                                                        const val = e.currentTarget.value;
                                                        field().handleChange(val === '' ? null : parseFloat(val));
                                                    }}
                                                    placeholder="0.00"
                                                    class="w-full bg-card-alt border border-border rounded-lg px-2.5 py-2 text-sm font-mono text-text placeholder:text-muted/40 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
                                                />
                                            )}
                                        </props.form.Field>

                                        {/* Margin */}
                                        <div class="text-sm font-mono tabular-nums">
                                            <Show when={variantMargin() !== null} fallback={<span class="text-muted/40">—</span>}>
                                                <span classList={{
                                                    'text-success': Number(variantMargin()) > 0,
                                                    'text-danger': Number(variantMargin()) < 0,
                                                }}>
                                                    {Number(variantMargin()!) > 0 ? '+' : ''}{variantMargin()}%
                                                </span>
                                            </Show>
                                        </div>

                                        {/* Active badge */}
                                        <div>
                                            <Show
                                                when={variants()[formIndex()]?.is_active ?? variant.is_active}
                                                fallback={
                                                    <span class="text-[10px] px-2 py-0.5 rounded-md bg-danger/10 text-danger font-semibold uppercase">
                                                        Inactivo
                                                    </span>
                                                }
                                            >
                                                <span class="text-[10px] px-2 py-0.5 rounded-md bg-success/10 text-success font-semibold uppercase">
                                                    Activo
                                                </span>
                                            </Show>
                                        </div>
                                    </div>
                                );
                            }}
                        </For>
                    </div>
                </fieldset>
            </Show>
        </div>
    );
};

export default PurchaseSection;
