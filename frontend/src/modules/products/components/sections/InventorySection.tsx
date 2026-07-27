/**
 * InventorySection — Inventory configuration for physical products.
 * Fields: uom_inventory_id, is_stockable, min_stock_alert, 
 *         has_dimensional_tracking + conditional dimensional fields.
 */
import { Component, Show } from 'solid-js';
import TextField from '@shared/ui/TextField';
import Switch from '@shared/ui/Switch';
import { UomSelect } from '@shared/ui/selectors';
import { hasFieldError, getFieldError } from '@shared/ui/form/form.types';
import SectionHeader from '../ui/SectionHeader';

interface InventorySectionProps {
    form: any;
    hasAttemptedSubmit: () => boolean;
}

const InventorySection: Component<InventorySectionProps> = (props) => {
    const hasDimensional = props.form.useStore((s: any) => s.values.has_dimensional_tracking);
    const isStockable = props.form.useStore((s: any) => s.values.is_stockable);

    return (
        <div class="flex flex-col gap-4 sm:gap-5">
            {/* ── Core inventory config ── */}
            <fieldset class="space-y-4 bg-surface/30 p-4 sm:p-5 rounded-2xl border border-border/40">
                <SectionHeader
                    color="info"
                    title="Configuración de Inventario"
                    description="Unidad de medida, alertas de stock y seguimiento"
                />

                {/* UOM + Stock Mínimo */}
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* UOM Inventario */}
                    <props.form.Field name="uom_inventory_id">
                        {(field: any) => (
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
                        {(field: any) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Stock Mínimo</TextField.Label>
                                <TextField.Input type="number" placeholder="0" min={0} step="0.01" />
                                <TextField.Description>Alerta cuando el stock sea menor a este valor</TextField.Description>
                            </TextField.Root>
                        )}
                    </props.form.Field>
                </div>

                {/* Stockable toggle + Dimensional tracking toggle */}
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Is Stockable — read-only computed, but shown for visibility */}
                    <div class="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/40">
                        <div class="flex items-center gap-3 flex-1">
                            <div class="size-8 rounded-lg bg-info/10 flex items-center justify-center text-info">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
                                </svg>
                            </div>
                            <div>
                                <p class="text-sm font-medium text-text">Producto Stockeable</p>
                                <p class="text-xs text-muted">Maneja stock físico en bodegas</p>
                            </div>
                        </div>
                        <Show
                            when={isStockable()}
                            fallback={
                                <span class="text-[10px] px-2 py-0.5 rounded-md bg-muted/10 text-muted font-semibold uppercase">No</span>
                            }
                        >
                            <span class="text-[10px] px-2 py-0.5 rounded-md bg-success/10 text-success font-semibold uppercase">Sí</span>
                        </Show>
                    </div>

                    {/* Dimensional Tracking */}
                    <props.form.Field name="has_dimensional_tracking">
                        {(field: any) => (
                            <div class="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/40">
                                <Switch field={field()}>
                                    <div class="flex items-center gap-3">
                                        <div class="size-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" /><path d="m14.5 12.5 2-2" /><path d="m11.5 9.5 2-2" /><path d="m8.5 6.5 2-2" /><path d="m17.5 15.5 2-2" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p class="text-sm font-medium text-text">Maneja dimensiones</p>
                                            <p class="text-xs text-muted">Seguimiento por largo × ancho (planchas, rollos)</p>
                                        </div>
                                    </div>
                                </Switch>
                            </div>
                        )}
                    </props.form.Field>
                </div>
            </fieldset>

            {/* ── Conditional dimensional fields from variant[0] ── */}
            <Show when={hasDimensional()}>
                <fieldset class="space-y-4 bg-surface/30 p-4 sm:p-5 rounded-2xl border border-info/30 animate-in fade-in slide-in-from-top-1">
                    <SectionHeader
                        color="accent"
                        title="Dimensiones Estándar"
                        description="Medidas de referencia para la variante principal"
                    />

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <props.form.Field name={"variants[0].content_quantity" as any}>
                            {(field: any) => (
                                <TextField.Root field={field()}>
                                    <TextField.Label>Contenido por Unidad *</TextField.Label>
                                    <TextField.Input type="number" min={0.01} step="0.01" placeholder="1" />
                                    <TextField.Description>Cantidad del UOM base por unidad</TextField.Description>
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
                </fieldset>
            </Show>
        </div>
    );
};

export default InventorySection;
