/**
 * InventorySection — Shopify-style inventory card with progressive disclosure.
 * Card container: bg-card with crisp borders and clean tokens.
 * Includes:
 * 1. Inventory tracking toggle & UOM
 * 2. SKU and Barcode with standard type selector (GTIN, UPC, EAN, ISBN, CUSTOM)
 * 3. Min stock alert and optional dimensional tracking
 */
import { Component, Show, createSignal } from 'solid-js';
import type { CatalogFormApi } from '../catalog-form.types';
import TextField, { FieldLabel } from '@form/TextField';
import Switch from '@/shared/ui/form/Switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@form/Select';
import { UomSelect } from '@shared/ui/selectors';
import { WarehouseIcon } from '@icons/WarehouseIcon';
import { RulerIcon } from '@icons/RulerIcon';
import { ChevronDownIcon } from '@icons/ChevronDownIcon';
import { BARCODE_TYPES, type BarcodeType } from '@app/schema/enums';
import { hasFieldError, getFieldError } from '@shared/ui/form/form.types';

type SelectOption<T> = { value: T; label: string };

const BARCODE_TYPE_OPTIONS: Array<SelectOption<BarcodeType>> = BARCODE_TYPES.map((t) => ({
    value: t,
    label: t,
}));

interface InventorySectionProps {
    form: CatalogFormApi;
    hasAttemptedSubmit: () => boolean;
}

export const InventorySection: Component<InventorySectionProps> = (props) => {
    const hasDimensional = props.form.useStore((s) => s.values.has_dimensional_tracking);
    const skuValue = props.form.useStore((s) => s.values.variants?.[0]?.sku);
    const barcodeValue = props.form.useStore((s) => s.values.variants?.[0]?.barcode);

    // Expandable progressive disclosure for extra identifiers
    const [showMoreDetails, setShowMoreDetails] = createSignal<boolean>(Boolean(skuValue() || barcodeValue()));

    return (
        <fieldset class="bg-card border border-border/90 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col gap-4">
            {/* ── Header ── */}
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <div class="p-1 rounded-md bg-primary-soft text-primary">
                        <WarehouseIcon class="size-4" />
                    </div>
                    <h3 class="text-sm font-semibold text-text">Inventario</h3>
                </div>
            </div>

            {/* ── Primary Inventory Controls ── */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* UOM Inventario */}
                <props.form.Field name="uom_inventory_id">
                    {(field) => (
                        <UomSelect
                            value={field().state.value}
                            onChange={(id) => id && field().handleChange(id)}
                            label="UOM de Inventario *"
                            required
                            error={hasFieldError(field(), props.hasAttemptedSubmit()) ? getFieldError(field()) : undefined}
                        />
                    )}
                </props.form.Field>

                {/* Stock Mínimo */}
                <props.form.Field name="min_stock_alert">
                    {(field) => (
                        <TextField.Root field={field()}>
                            <TextField.Label>Alerta de Stock Mínimo</TextField.Label>
                            <TextField.Input type="number" placeholder="0" min={0} step="0.01" />
                            <TextField.Description>Notificar cuando las existencias caigan de este nivel</TextField.Description>
                        </TextField.Root>
                    )}
                </props.form.Field>
            </div>

            {/* ── More Details Accordion (SKU, Barcode, Barcode Type) ── */}
            <div class="pt-2 border-t border-border/60 flex flex-col gap-3">
                <button
                    type="button"
                    onClick={() => setShowMoreDetails(!showMoreDetails())}
                    class="inline-flex items-center gap-2 text-xs font-medium text-primary hover:text-primary-strong transition-colors cursor-pointer w-fit"
                >
                    <span>Códigos de identificación (SKU, Código de barras)</span>
                    <ChevronDownIcon
                        class="size-3.5 transition-transform"
                        classList={{ 'rotate-180': showMoreDetails() }}
                    />
                </button>

                <Show when={showMoreDetails()}>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-surface/50 rounded-lg border border-border/70 animate-in fade-in">
                        {/* SKU */}
                        <props.form.Field name={"variants[0].sku" as any}>
                            {(field) => (
                                <TextField.Root field={field()}>
                                    <TextField.Label>SKU Principal *</TextField.Label>
                                    <TextField.Input type="text" placeholder="Ej: PROD-001" />
                                    <TextField.ErrorMessage />
                                </TextField.Root>
                            )}
                        </props.form.Field>

                        {/* Barcode */}
                        <props.form.Field name={"variants[0].barcode" as any}>
                            {(field) => (
                                <TextField.Root field={field()}>
                                    <TextField.Label>Código de Barras</TextField.Label>
                                    <TextField.Input type="text" placeholder="Ej: 786100012345" />
                                </TextField.Root>
                            )}
                        </props.form.Field>

                        {/* Barcode Type */}
                        <props.form.Field name={"variants[0].barcode_type" as any}>
                            {(field) => {
                                const selected = () => BARCODE_TYPE_OPTIONS.find((o) => o.value === field().state.value);
                                return (
                                    <div class="space-y-1">
                                        <FieldLabel>Tipo de Código</FieldLabel>
                                        <Select
                                            value={selected()}
                                            onChange={(opt: SelectOption<BarcodeType> | null) => opt && (field() as any).handleChange(opt.value)}
                                            options={[...BARCODE_TYPE_OPTIONS]}
                                            optionValue="value"
                                            optionTextValue="label"
                                            placeholder="Tipo..."
                                            itemComponent={(itemProps) => (
                                                <SelectItem item={itemProps.item}>{itemProps.item.rawValue?.label}</SelectItem>
                                            )}
                                        >
                                            <SelectTrigger class="h-9 bg-surface border border-border rounded-lg text-xs">
                                                <SelectValue<SelectOption<BarcodeType>>>
                                                    {(state) => state.selectedOption()?.label ?? 'CUSTOM'}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent />
                                        </Select>
                                    </div>
                                );
                            }}
                        </props.form.Field>
                    </div>
                </Show>
            </div>

            {/* ── Dimensional Tracking Switch ── */}
            <div class="pt-2 border-t border-border/60">
                <props.form.Field name="has_dimensional_tracking">
                    {(field) => (
                        <div class="flex items-center gap-3 p-3 bg-surface/50 rounded-lg border border-border/60">
                            <Switch field={field()}>
                                <div class="flex items-center gap-3">
                                    <div class="size-7 rounded-md bg-primary-soft text-primary flex items-center justify-center">
                                        <RulerIcon class="size-4" />
                                    </div>
                                    <div>
                                        <p class="text-xs font-semibold text-text">Rastreo Dimensional</p>
                                        <p class="text-[11px] text-muted">Control de corte y medidas (largo × ancho / planchas / rollos)</p>
                                    </div>
                                </div>
                            </Switch>
                        </div>
                    )}
                </props.form.Field>
            </div>

            {/* ── Conditional dimensional fields ── */}
            <Show when={hasDimensional()}>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-surface/40 rounded-lg border border-primary/20 animate-in fade-in">
                    <props.form.Field name={"variants[0].content_quantity" as any}>
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Contenido por Unidad</TextField.Label>
                                <TextField.Input type="number" min={0.01} step="0.01" placeholder="1" />
                            </TextField.Root>
                        )}
                    </props.form.Field>

                    <props.form.Field name={"variants[0].std_length_cm" as any}>
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Largo Estándar (cm)</TextField.Label>
                                <TextField.Input type="number" step="0.1" placeholder="0.0" />
                            </TextField.Root>
                        )}
                    </props.form.Field>

                    <props.form.Field name={"variants[0].std_width_cm" as any}>
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Ancho Estándar (cm)</TextField.Label>
                                <TextField.Input type="number" step="0.1" placeholder="0.0" />
                            </TextField.Root>
                        )}
                    </props.form.Field>
                </div>
            </Show>
        </fieldset>
    );
};

export default InventorySection;
