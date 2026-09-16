/**
 * InventorySection — Inventory configuration for physical products.
 * Fields: uom_inventory_id, min_stock_alert, 
 *         has_dimensional_tracking + conditional dimensional fields,
 *         and multi-warehouse initial stock distribution cards.
 */
import { Component, Show, For, createSignal, createMemo } from 'solid-js';
import type { CatalogFormApi } from '../catalog-form.types';
import TextField from '@form/TextField';
import Switch from '@/shared/ui/form/Switch';
import { UomSelect } from '@shared/ui/selectors';
import { RulerIcon } from '@icons/RulerIcon';
import { WarehouseIcon } from '@icons/WarehouseIcon';
import { hasFieldError, getFieldError } from '@shared/ui/form/form.types';
import FormSectionHeader from '@form/FormSectionHeader';
import { Badge } from '@display/Badge';
import { Skeleton } from '@display/Skeleton';
import { useWarehousesList } from '@modules/settings/data/warehouses.queries';
import { useUomList } from '@modules/uom/data/uom.queries';
import type { WarehouseItem } from '@modules/settings/data/warehouses.api';

interface InventorySectionProps {
    form: CatalogFormApi;
    hasAttemptedSubmit: () => boolean;
}

const InventorySection: Component<InventorySectionProps> = (props) => {
    const hasDimensional = props.form.useStore((s) => s.values.has_dimensional_tracking);
    const uomIdValue = props.form.useStore((s) => s.values.uom_inventory_id);

    // Active warehouses query for tenant
    const warehousesQuery = useWarehousesList();
    const activeWarehouses = createMemo(() => {
        const list = (warehousesQuery.data ?? []) as WarehouseItem[];
        return list.filter((w) => w.is_active !== false);
    });

    // UOM query to resolve unit code for adornments
    const uomsQuery = useUomList();
    const uomCode = createMemo(() => {
        const id = uomIdValue();
        if (!id) return '';
        const list = uomsQuery.data ?? [];
        return list.find((u) => u.id === id)?.code ?? '';
    });

    // Reactive state for initial stock distribution by warehouse
    const [warehouseStock, setWarehouseStock] = createSignal<Record<number, number>>({});
    const totalDistributedStock = createMemo(() => {
        const stockMap = warehouseStock();
        return Object.values(stockMap).reduce((sum, qty) => sum + (qty || 0), 0);
    });

    return (
        <div class="flex flex-col gap-4 sm:gap-5">
            {/* ── Core inventory config ── */}
            <fieldset class="space-y-4 bg-surface/30 p-4 sm:p-5 rounded-2xl border border-border/40">
                <FormSectionHeader
                    color="info"
                    title="Configuración de Inventario"
                    description="Unidad de medida, alertas de stock y seguimiento"
                />

                {/* UOM + Stock Mínimo */}
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
                                <TextField.Label>Stock Mínimo</TextField.Label>
                                <TextField.NumericInput
                                    placeholder="0"
                                    min={0}
                                    step={0.01}
                                    allowDecimal={true}
                                    allowNegative={false}
                                    suffix={uomCode() || 'U'}
                                />
                                <TextField.Description>Alerta cuando el stock sea menor a este valor</TextField.Description>
                            </TextField.Root>
                        )}
                    </props.form.Field>
                </div>

                {/* Dimensional Tracking */}
                <div class="grid grid-cols-1 gap-3">
                    <props.form.Field name="has_dimensional_tracking">
                        {(field) => (
                            <div class="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/40">
                                <Switch field={field()}>
                                    <div class="flex items-center gap-3">
                                        <div class="size-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                                            <RulerIcon class="size-4" />
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

            {/* ── Multi-Warehouse Initial Stock Distribution ── */}
            <fieldset class="space-y-4 bg-surface/30 p-4 sm:p-5 rounded-2xl border border-border/40">
                <div class="flex items-center justify-between">
                    <FormSectionHeader
                        color="primary"
                        title="Existencias por Almacén"
                        description="Distribución de inventario físico inicial por bodega y ubicación"
                    />
                    <Show when={activeWarehouses().length > 0}>
                        <Badge variant="primary" size="sm" class="gap-1.5">
                            <WarehouseIcon class="size-3.5" />
                            <span>{activeWarehouses().length} {activeWarehouses().length === 1 ? 'almacén' : 'almacenes'}</span>
                        </Badge>
                    </Show>
                </div>

                {/* Summary Banner */}
                <div class="flex flex-wrap items-center justify-between gap-3 p-3 bg-card rounded-xl border border-border/40">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <WarehouseIcon class="size-4" />
                        </div>
                        <div class="min-w-0">
                            <p class="text-xs font-semibold text-text truncate">Stock Inicial Distribuido</p>
                            <p class="text-[11px] text-muted truncate">Asigna la cantidad física disponible en cada bodega</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-muted font-medium">Total inicial:</span>
                        <Badge variant={totalDistributedStock() > 0 ? 'primary' : 'default'} size="md" class="font-mono font-bold">
                            {totalDistributedStock().toLocaleString()} {uomCode() || 'U'}
                        </Badge>
                    </div>
                </div>

                {/* Loading Skeletons */}
                <Show when={warehousesQuery.isLoading}>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Skeleton class="h-28 w-full rounded-xl" />
                        <Skeleton class="h-28 w-full rounded-xl" />
                    </div>
                </Show>

                {/* Empty State */}
                <Show when={!warehousesQuery.isLoading && activeWarehouses().length === 0}>
                    <div class="p-6 rounded-xl border border-dashed border-border/60 text-center bg-card/40">
                        <div class="size-10 rounded-full bg-surface flex items-center justify-center text-muted mx-auto mb-2.5 border border-border/40">
                            <WarehouseIcon class="size-5" />
                        </div>
                        <p class="text-sm font-semibold text-text">No hay almacenes activos configurados</p>
                        <p class="text-xs text-muted mt-1 max-w-sm mx-auto">
                            Configura bodegas en Configuración de Empresa para distribuir existencias físicas por ubicación.
                        </p>
                    </div>
                </Show>

                {/* Warehouse Stock Cards Grid */}
                <Show when={!warehousesQuery.isLoading && activeWarehouses().length > 0}>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <For each={activeWarehouses()}>
                            {(warehouse) => {
                                const currentQty = () => warehouseStock()[warehouse.id] ?? null;

                                return (
                                    <div class="flex flex-col justify-between p-3.5 bg-card rounded-xl border border-border/50 hover:border-primary/30 transition-all gap-3 shadow-xs">
                                        {/* Card Top: Warehouse Info */}
                                        <div class="flex items-start justify-between gap-2 min-w-0">
                                            <div class="flex items-center gap-2.5 min-w-0">
                                                <div class="size-8 rounded-lg bg-surface flex items-center justify-center text-primary shrink-0 border border-border/40">
                                                    <WarehouseIcon class="size-4" />
                                                </div>
                                                <div class="min-w-0">
                                                    <p class="text-xs font-bold text-text truncate" title={warehouse.name}>
                                                        {warehouse.name}
                                                    </p>
                                                    <p class="text-[11px] font-mono text-muted">
                                                        {warehouse.code}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge variant="default" size="sm" class="text-[10px] shrink-0 font-normal">
                                                {warehouse.locationCount ?? 1} {(warehouse.locationCount ?? 1) === 1 ? 'ubicación' : 'ubicaciones'}
                                            </Badge>
                                        </div>

                                        {/* Card Bottom: Numeric stock input */}
                                        <div class="space-y-1">
                                            <TextField.Root
                                                value={currentQty()}
                                                onChange={(val) => {
                                                    const num = val === '' || val == null ? 0 : Number(val);
                                                    setWarehouseStock((prev) => ({
                                                        ...prev,
                                                        [warehouse.id]: isNaN(num) ? 0 : Math.max(0, num),
                                                    }));
                                                }}
                                            >
                                                <TextField.Label class="text-[11px] text-muted">
                                                    Cantidad Inicial
                                                </TextField.Label>
                                                <TextField.NumericInput
                                                    placeholder="0"
                                                    min={0}
                                                    step={1}
                                                    allowDecimal={true}
                                                    allowNegative={false}
                                                    suffix={uomCode() || 'U'}
                                                />
                                            </TextField.Root>
                                        </div>
                                    </div>
                                );
                            }}
                        </For>
                    </div>
                </Show>
            </fieldset>

            {/* ── Conditional dimensional fields from variant[0] ── */}
            <Show when={hasDimensional()}>
                <fieldset class="space-y-4 bg-surface/30 p-4 sm:p-5 rounded-2xl border border-info/30 animate-in fade-in slide-in-from-top-1">
                    <FormSectionHeader
                        color="accent"
                        title="Dimensiones Estándar"
                        description="Medidas de referencia para la variante principal"
                    />

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <props.form.Field name={"variants[0].content_quantity" }>
                            {(field) => (
                                <TextField.Root field={field()}>
                                    <TextField.Label>Contenido por Unidad *</TextField.Label>
                                    <TextField.NumericInput
                                        min={0.01}
                                        step={0.01}
                                        placeholder="1"
                                        allowDecimal={true}
                                        allowNegative={false}
                                        suffix={uomCode() || 'U'}
                                    />
                                    <TextField.Description>Cantidad del UOM base por unidad</TextField.Description>
                                    <TextField.ErrorMessage />
                                </TextField.Root>
                            )}
                        </props.form.Field>

                        <props.form.Field name={"variants[0].std_length_cm" }>
                            {(field) => (
                                <TextField.Root field={field()}>
                                    <TextField.Label>Largo estándar (cm)</TextField.Label>
                                    <TextField.NumericInput
                                        step={0.01}
                                        min={0}
                                        placeholder="Ej: 244"
                                        allowDecimal={true}
                                        allowNegative={false}
                                        suffix="cm"
                                    />
                                </TextField.Root>
                            )}
                        </props.form.Field>

                        <props.form.Field name={"variants[0].std_width_cm" }>
                            {(field) => (
                                <TextField.Root field={field()}>
                                    <TextField.Label>Ancho estándar (cm)</TextField.Label>
                                    <TextField.NumericInput
                                        step={0.01}
                                        min={0}
                                        placeholder="Ej: 122"
                                        allowDecimal={true}
                                        allowNegative={false}
                                        suffix="cm"
                                    />
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

