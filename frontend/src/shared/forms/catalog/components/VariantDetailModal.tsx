import { Component, createSignal, createEffect, createMemo, Show, For } from 'solid-js';
import type { ProductVariantFormData } from '@app/schema/frontend';
import { BARCODE_TYPES, type BarcodeType } from '@app/schema/enums';
import { FormDialog } from '@overlay/FormDialog';
import TextField from '@form/TextField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@form/Select';
import { Switch } from '@form/Switch';
import { Badge } from '@display/Badge';
import { TagIcon } from '@icons/TagIcon';
import { SparklesIcon } from '@icons/SparklesIcon';
import { BoxIcon } from '@icons/BoxIcon';
import { LayersIcon } from '@icons/LayersIcon';

export interface VariantDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    variant: ProductVariantFormData | null;
    variantIndex: number | null;
    defaultPrice?: number | null;
    form?: any;
    onSave?: (updatedVariant: ProductVariantFormData, index: number) => void;
}

export const VariantDetailModal: Component<VariantDetailModalProps> = (props) => {
    // Form state signals
    const [unitPrice, setUnitPrice] = createSignal<number | null>(null);
    const [lastCost, setLastCost] = createSignal<number | null>(null);
    const [sku, setSku] = createSignal<string>('');
    const [barcode, setBarcode] = createSignal<string>('');
    const [barcodeType, setBarcodeType] = createSignal<BarcodeType>('CUSTOM');
    const [isActive, setIsActive] = createSignal<boolean>(true);
    const [isDefault, setIsDefault] = createSignal<boolean>(false);
    const [contentQuantity, setContentQuantity] = createSignal<number>(1);
    const [variantName, setVariantName] = createSignal<string>('');

    // Synchronize local signals when modal opens or target variant changes
    createEffect(() => {
        if (props.isOpen && props.variant) {
            setUnitPrice(props.variant.unit_price ?? null);
            setLastCost(props.variant.last_cost ?? null);
            setSku(props.variant.sku ?? '');
            setBarcode(props.variant.barcode ?? '');
            setBarcodeType((props.variant.barcode_type as BarcodeType) ?? 'CUSTOM');
            setIsActive(props.variant.is_active ?? true);
            setIsDefault(props.variant.is_default ?? false);
            setContentQuantity(props.variant.content_quantity ?? 1);
            setVariantName(props.variant.variant_name ?? '');
        }
    });

    // Real-Time Live Financial Reactive Engine
    const effectivePrice = createMemo(() => {
        const p = unitPrice();
        if (p !== null && p !== undefined) return Number(p);
        const def = props.defaultPrice;
        if (def !== null && def !== undefined) return Number(def);
        return 0;
    });

    const effectiveCost = createMemo(() => {
        const c = lastCost();
        if (c !== null && c !== undefined) return Number(c);
        return 0;
    });

    // Profit ($) = Price - Cost
    const profit = createMemo(() => {
        return effectivePrice() - effectiveCost();
    });

    // Gross Margin (%) = ((Price - Cost) / Price) * 100 (handles 0 price safely)
    const grossMargin = createMemo(() => {
        const p = effectivePrice();
        const c = effectiveCost();
        if (p <= 0) return 0;
        return ((p - c) / p) * 100;
    });

    // Markup on Cost (%) = ((Price - Cost) / Cost) * 100 (handles 0 cost safely)
    const costMarkup = createMemo(() => {
        const p = effectivePrice();
        const c = effectiveCost();
        if (c <= 0) return 0;
        return ((p - c) / c) * 100;
    });

    const handleSubmit = (e: Event) => {
        e.preventDefault();
        if (!props.variant || props.variantIndex === null) return;

        const updated: ProductVariantFormData = {
            ...props.variant,
            sku: sku().trim(),
            variant_name: variantName().trim() || null,
            unit_price: unitPrice(),
            last_cost: lastCost(),
            barcode: barcode().trim() || null,
            barcode_type: barcodeType(),
            content_quantity: contentQuantity(),
            is_active: isActive(),
            is_default: isDefault(),
        };

        if (props.form && typeof props.form.setFieldValue === 'function') {
            props.form.setFieldValue(`variants[${props.variantIndex}]`, updated);
        }

        props.onSave?.(updated, props.variantIndex);
        props.onClose();
    };

    const modalTitle = () => {
        if (!props.variant) return 'Detalle de Variante';
        if (props.variant.variant_name) return `Variante: ${props.variant.variant_name}`;
        if (props.variant.sku) return `Variante: ${props.variant.sku}`;
        return `Variante #${(props.variantIndex ?? 0) + 1}`;
    };

    return (
        <FormDialog
            isOpen={props.isOpen}
            onClose={props.onClose}
            title={modalTitle()}
            subtitle="Configuración comercial, financiera e identificación de la variante."
            maxWidth="2xl"
            onSubmit={handleSubmit}
            submitLabel="Guardar Cambios"
            cancelLabel="Cancelar"
            titleExtra={
                <Show when={props.variant?.is_default}>
                    <Badge variant="primary" size="sm">
                        Predeterminada
                    </Badge>
                </Show>
            }
        >
            <div class="space-y-5 py-2">
                {/* ── Real-Time Live Financial Card ── */}
                <div class="rounded-xl border border-border/70 bg-card-alt p-4">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                            <TagIcon class="size-3.5 text-primary" />
                            <span>Rentabilidad en Tiempo Real</span>
                        </div>
                        <Show when={effectivePrice() > 0}>
                            <Badge
                                variant={profit() > 0 ? 'success' : profit() < 0 ? 'danger' : 'default'}
                                size="sm"
                            >
                                {profit() > 0 ? 'Rentable' : profit() < 0 ? 'Pérdida' : 'Sin margen'}
                            </Badge>
                        </Show>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div class="flex flex-col gap-1 p-2.5 rounded-lg bg-surface/60 border border-border/40">
                            <span class="text-[11px] font-medium text-muted">Beneficio Neto</span>
                            <p
                                class="text-base font-mono font-bold"
                                classList={{
                                    'text-success': profit() > 0,
                                    'text-danger': profit() < 0,
                                    'text-muted': profit() === 0,
                                }}
                            >
                                {profit() < 0 ? `-$${Math.abs(profit()).toFixed(2)}` : `$${profit().toFixed(2)}`}
                            </p>
                        </div>

                        <div class="flex flex-col gap-1 p-2.5 rounded-lg bg-surface/60 border border-border/40">
                            <span class="text-[11px] font-medium text-muted">Margen Bruto</span>
                            <p
                                class="text-base font-mono font-bold"
                                classList={{
                                    'text-success': grossMargin() > 0,
                                    'text-danger': grossMargin() < 0,
                                    'text-muted': grossMargin() === 0,
                                }}
                            >
                                {grossMargin().toFixed(1)}%
                            </p>
                        </div>

                        <div class="flex flex-col gap-1 p-2.5 rounded-lg bg-surface/60 border border-border/40">
                            <span class="text-[11px] font-medium text-muted">Margen s/ Costo (Markup)</span>
                            <p class="text-base font-mono font-bold text-text">
                                {costMarkup().toFixed(1)}%
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Commercial & Pricing Grid ── */}
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <TextField.Root
                        value={unitPrice() ?? ''}
                        onChange={(val) => {
                            const n = val === '' || val == null ? null : parseFloat(val);
                            setUnitPrice(n != null && !isNaN(n) ? n : null);
                        }}
                    >
                        <TextField.Label tooltip="Precio de venta específico para esta variante. Si se deja vacío, hereda el precio base del producto.">
                            Precio de Venta
                        </TextField.Label>
                        <TextField.NumericInput
                            prefix="$"
                            allowDecimal={true}
                            step={0.01}
                            min={0}
                            placeholder={props.defaultPrice != null ? `Hereda ($${props.defaultPrice})` : '0.00'}
                        />
                    </TextField.Root>

                    <TextField.Root
                        value={lastCost() ?? ''}
                        onChange={(val) => {
                            const n = val === '' || val == null ? null : parseFloat(val);
                            setLastCost(n != null && !isNaN(n) ? n : null);
                        }}
                    >
                        <TextField.Label tooltip="Último costo unitario de adquisición para valuación y cálculo de margen.">
                            Costo Unitario
                        </TextField.Label>
                        <TextField.NumericInput
                            prefix="$"
                            allowDecimal={true}
                            step={0.01}
                            min={0}
                            placeholder="0.00"
                        />
                    </TextField.Root>
                </div>

                {/* ── Identification & Barcode Grid ── */}
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <TextField.Root
                        value={sku()}
                        onChange={setSku}
                    >
                        <TextField.Label tooltip="Código único identificador de variante (SKU).">
                            SKU
                        </TextField.Label>
                        <TextField.Input placeholder="POLO-S-BLK" />
                    </TextField.Root>

                    <div class="flex flex-col gap-1.5">
                        <span class="text-xs font-medium text-text">Tipo de Código</span>
                        <Select<BarcodeType>
                            options={[...BARCODE_TYPES]}
                            value={barcodeType()}
                            onChange={(val) => val && setBarcodeType(val)}
                            itemComponent={(itemProps) => (
                                <SelectItem item={itemProps.item}>
                                    {itemProps.item.rawValue}
                                </SelectItem>
                            )}
                        >
                            <SelectTrigger>
                                <SelectValue<BarcodeType>>{(state) => state.selectedOption()}</SelectValue>
                            </SelectTrigger>
                            <SelectContent />
                        </Select>
                    </div>

                    <TextField.Root
                        value={barcode()}
                        onChange={setBarcode}
                    >
                        <TextField.Label tooltip="Código de barras estándar escaneable.">
                            Código de Barras
                        </TextField.Label>
                        <TextField.Input placeholder="750123456789" />
                    </TextField.Root>
                </div>

                {/* ── Variant Attributes Overview ── */}
                <div class="space-y-2">
                    <div class="flex items-center gap-1.5 text-xs font-medium text-text">
                        <LayersIcon class="size-3.5 text-primary" />
                        <span>Atributos y Opciones Configuradas</span>
                    </div>
                    <div class="flex flex-wrap gap-2 p-3 bg-card-alt/60 rounded-xl border border-border/50 min-h-12 items-center">
                        <Show
                            when={props.variant?.variant_attributes && Object.keys(props.variant.variant_attributes).length > 0}
                            fallback={<span class="text-xs text-muted">Sin atributos específicos asociados.</span>}
                        >
                            <For each={Object.entries(props.variant?.variant_attributes ?? {})}>
                                {([key, value]) => (
                                    <Badge variant="primary" size="sm" radius="md">
                                        <span class="font-normal opacity-80">{key}:</span>
                                        <span class="font-semibold">{String(value)}</span>
                                    </Badge>
                                )}
                            </For>
                        </Show>
                    </div>
                </div>

                {/* ── Status & Settings Flags ── */}
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-card-alt/40 rounded-xl border border-border/40">
                    <Switch
                        checked={isActive()}
                        onChange={setIsActive}
                    >
                        <div class="flex flex-col">
                            <span class="text-xs font-medium text-text">Variante Activa</span>
                            <span class="text-[11px] text-muted">Habilitada para ventas y catálogo</span>
                        </div>
                    </Switch>

                    <Switch
                        checked={isDefault()}
                        onChange={setIsDefault}
                    >
                        <div class="flex flex-col">
                            <span class="text-xs font-medium text-text">Variante Predeterminada</span>
                            <span class="text-[11px] text-muted">Referencia principal en listados</span>
                        </div>
                    </Switch>
                </div>
            </div>
        </FormDialog>
    );
};

export default VariantDetailModal;
