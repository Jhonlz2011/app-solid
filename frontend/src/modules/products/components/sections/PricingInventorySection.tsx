/**
 * PricingInventorySection — Pricing + UOM + Min Stock + conditional dimensional tracking.
 * Dimensional fields (content_quantity, std_length_cm, std_width_cm) from variants[0]
 * are only shown when has_dimensional_tracking = true.
 */
import { Component, Show } from 'solid-js';
import TextField, { FieldLabel } from '@shared/ui/TextField';
import Switch from '@shared/ui/Switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/Select';
import { UomSelect } from '@shared/ui/selectors';
import { hasFieldError, getFieldError } from '@shared/ui/form/form.types';
import type { CatalogModeConfig } from '@shared/forms/catalog';
import SectionHeader from '../ui/SectionHeader';

const IVA_OPTIONS = [
    { value: 0, label: '0% – Exento' },
    { value: 2, label: 'IVA – 12%' },
    { value: 4, label: 'IVA – 15%' },
];

type SelectOption<T> = { value: T; label: string };

interface PricingInventorySectionProps {
    form: any;
    mode: CatalogModeConfig;
    hasAttemptedSubmit: () => boolean;
}

const PricingInventorySection: Component<PricingInventorySectionProps> = (props) => {
    const hasDimensional = props.form.useStore((s: any) => s.values.has_dimensional_tracking);

    return (
        <fieldset class="space-y-4 bg-surface/30 p-5 rounded-2xl border border-border/40">
            <SectionHeader color="warning" title={props.mode.features.inventoryTab ? 'Precios e Inventario' : 'Precios'} />

            {/* Row: Price + IVA + UOM + Min Stock (conditional) */}
            <div class={`grid grid-cols-2 gap-4 ${props.mode.features.inventoryTab ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
                {/* Precio Base */}
                <props.form.Field name="default_base_price">
                    {(field: any) => (
                        <TextField.Root field={field()}>
                            <TextField.Label>Precio Base *</TextField.Label>
                            <TextField.Input
                                type="number"
                                step="0.01"
                                min={0}
                                class="font-mono"
                                placeholder="0.00"
                            />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )}
                </props.form.Field>

                {/* IVA */}
                <props.form.Field name="iva_rate_code">
                    {(field: any) => {
                        const selectedIva = () => IVA_OPTIONS.find(o => o.value === field().state.value);
                        return (
                            <div class="space-y-1">
                                <FieldLabel>Código IVA</FieldLabel>
                                <Select
                                    value={selectedIva()}
                                    onChange={(opt: SelectOption<number> | null) => opt && field().handleChange(opt.value)}
                                    options={IVA_OPTIONS}
                                    optionValue="value"
                                    optionTextValue="label"
                                    placeholder="Seleccionar IVA..."
                                    itemComponent={(itemProps: any) => (
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

                {/* UOM Inventario */}
                <props.form.Field name="uom_inventory_id">
                    {(field: any) => (
                        <UomSelect
                            value={field().state.value}
                            onChange={(id) => id && field().handleChange(id)}
                            label="UOM Inventario *"
                            required
                            error={hasFieldError(field(), props.hasAttemptedSubmit()) ? getFieldError(field()) : undefined}
                        />
                    )}
                </props.form.Field>

                {/* Stock Mínimo */}
                <Show when={props.mode.features.inventoryTab}>
                    <props.form.Field name="min_stock_alert">
                        {(field: any) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Stock Mínimo</TextField.Label>
                                <TextField.Input type="number" placeholder="0" min={0} step="0.01" />
                                <TextField.Description>Alerta de reposición</TextField.Description>
                            </TextField.Root>
                        )}
                    </props.form.Field>
                </Show>
            </div>

            {/* Dimensional tracking toggle */}
            <Show when={props.mode.features.inventoryTab}>
                <props.form.Field name="has_dimensional_tracking">
                    {(field: any) => (
                        <div class="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/40">
                            <Switch field={field()}>
                                <div>
                                    <p class="text-sm font-medium text-text">Maneja dimensiones</p>
                                    <p class="text-xs text-muted">Habilitar seguimiento por largo × ancho (planchas, rollos)</p>
                                </div>
                            </Switch>
                        </div>
                    )}
                </props.form.Field>
            </Show>

            {/* Conditional dimensional fields from variant[0] */}
            <Show when={props.mode.features.inventoryTab && hasDimensional()}>
                <div class="grid grid-cols-3 gap-4 p-4 bg-info/5 border border-info/20 rounded-xl animate-in fade-in slide-in-from-top-1">
                    <props.form.Field name={"variants[0].content_quantity" as any}>
                        {(field: any) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Contenido *</TextField.Label>
                                <TextField.Input type="number" min={0.01} step="0.01" />
                                <TextField.Description>Cantidad por unidad</TextField.Description>
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </props.form.Field>

                    <props.form.Field name={"variants[0].std_length_cm" as any}>
                        {(field: any) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Largo estándar (cm)</TextField.Label>
                                <TextField.Input type="number" step="0.01" min={0} placeholder="Ej: 244" />
                            </TextField.Root>
                        )}
                    </props.form.Field>

                    <props.form.Field name={"variants[0].std_width_cm" as any}>
                        {(field: any) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Ancho estándar (cm)</TextField.Label>
                                <TextField.Input type="number" step="0.01" min={0} placeholder="Ej: 122" />
                            </TextField.Root>
                        )}
                    </props.form.Field>
                </div>
            </Show>
        </fieldset>
    );
};

export default PricingInventorySection;
