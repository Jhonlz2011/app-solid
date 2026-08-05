import { Component, Show, For } from 'solid-js';
import TextField, { FieldLabel } from '@shared/ui/TextField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/Select';
import { UomSelect } from '@shared/ui/selectors';
import type { ProductVariantFormData } from '@app/schema/frontend';
import type { CatalogFormApi } from '../catalog-form.types';
import SectionHeader from '../../../../modules/products/components/ui/SectionHeader';

const IVA_OPTIONS = [
    { value: 0, label: '0% – Exento' },
    { value: 2, label: 'IVA – 12%' },
    { value: 4, label: 'IVA – 15%' },
] as const;

type SelectOption<T> = { value: T; label: string };

interface SalesSectionProps {
    form: CatalogFormApi;
    hasAttemptedSubmit: () => boolean;
    additionalVariants: () => ProductVariantFormData[];
}

const SalesSection: Component<SalesSectionProps> = (props) => {
    const variants = props.form.useStore((s) => s.values.variants) as () => ProductVariantFormData[];
    const additionalVariants = () => props.additionalVariants();

    return (
        <div class="flex flex-col gap-4 sm:gap-5">
            {/* ── Pricing defaults ── */}
            <fieldset class="space-y-4 bg-surface/30 p-4 sm:p-5 rounded-2xl border border-border/40">
                <SectionHeader color="success" title="Precios de Venta" />

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Precio Base */}
                    <props.form.Field name="default_base_price">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Precio de Venta *</TextField.Label>
                                <TextField.Input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    class="font-mono"
                                    placeholder="0.00"
                                />
                                <TextField.Description>Precio base que heredan las variantes</TextField.Description>
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </props.form.Field>

                    {/* IVA */}
                    <props.form.Field name="iva_rate_code">
                        {(field) => {
                            const selectedIva = () => IVA_OPTIONS.find(o => o.value === field().state.value);
                            return (
                                <div class="space-y-1">
                                    <FieldLabel>Código IVA *</FieldLabel>
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
                                        <SelectTrigger>
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

                    {/* UOM de Venta (variante default) */}
                    <props.form.Field name={"variants[0].sale_uom_id" }>
                        {(field) => (
                            <UomSelect
                                value={field().state.value}
                                onChange={(id) => field().handleChange(id ?? null)}
                                label="UOM de Venta"
                                placeholder="Hereda del inventario"
                            />
                        )}
                    </props.form.Field>
                </div>
            </fieldset>

            {/* ── Variant price overrides ── */}
            <Show when={additionalVariants().length > 0}>
                <fieldset class="space-y-3 bg-surface/30 p-4 sm:p-5 rounded-2xl border border-border/40">
                    <SectionHeader
                        color="success"
                        title="Precios por Variante"
                        description="Deja vacío para heredar el precio base del producto"
                    />

                    {/* Header row */}
                    <div class="hidden sm:grid grid-cols-[1fr_140px_100px] gap-3 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                        <div>Variante</div>
                        <div>Precio</div>
                        <div>Estado</div>
                    </div>

                    {/* Variant rows */}
                    <div class="space-y-1.5">
                        <For each={additionalVariants()}>
                            {(variant, index) => {
                                const formIndex = () => index() + 1;
                                return (
                                    <div class="grid grid-cols-1 sm:grid-cols-[1fr_140px_100px] gap-3 items-center px-3 py-2.5 rounded-xl bg-card border border-border/40">
                                        {/* Name */}
                                        <div class="flex items-center gap-2">
                                            <div class="size-2 rounded-full bg-primary/40" />
                                            <span class="text-sm font-medium text-text truncate">
                                                {variants()[formIndex()]?.variant_name || variants()[formIndex()]?.sku || variant.variant_name || variant.sku || `Variante ${formIndex()}`}
                                            </span>
                                        </div>

                                        {/* Price override */}
                                        {/* @ts-expect-error - Dynamic array paths cannot be fully inferred */}
                                        <props.form.Field name={`variants[${formIndex()}].base_price`}>
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
                                                    placeholder="Hereda"
                                                    class="w-full bg-card-alt border border-border rounded-lg px-2.5 py-2 text-sm font-mono text-text placeholder:text-muted/40 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
                                                />
                                            )}
                                        </props.form.Field>

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

export default SalesSection;
