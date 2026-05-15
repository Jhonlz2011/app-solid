/**
 * VariantFields — Field inputs for ADDITIONAL variants (not the default).
 * Used by SortableVariantCard. Integrated with TanStack Form via indexed paths.
 *
 * Additional variants inherit product name + shared_attributes as starting point.
 * Fields shown:
 * - SKU (required)
 * - Variant Name (pre-populated from product name)
 * - Barcode
 * - Price override (empty = inherits product price)
 * - Sale UOM override (empty = inherits product UOM)
 * - Dimensional fields (if has_dimensional_tracking: content, length, width)
 * - Active toggle
 */
import { Component, Show } from 'solid-js';
import TextField from '@shared/ui/TextField';
import Switch from '@shared/ui/Switch';
import { UomSelect } from '@shared/ui/selectors';

export interface VariantFieldsProps {
    form: any;
    /** Base path for field names, e.g. "variants[1]" or "variants[2]" */
    basePath: string;
    hasDimensionalTracking: boolean;
    /** Show price override field (default: true) */
    showPrice?: boolean;
    /** Show is_active toggle (default: true) */
    showActiveToggle?: boolean;
    /** Show variant_name field (default: true) */
    showVariantName?: boolean;
    hasAttemptedSubmit?: () => boolean;
}

const VariantFields: Component<VariantFieldsProps> = (props) => {
    const fieldName = (field: string) => `${props.basePath}.${field}` as any;

    return (
        <>
            {/* Row 1: SKU + Variant Name */}
            <div class="grid grid-cols-2 gap-4">
                <props.form.Field name={fieldName('sku')}>
                    {(field: any) => (
                        <TextField.Root field={field()}>
                            <TextField.Label>SKU *</TextField.Label>
                            <TextField.Input type="text" placeholder="Ej: PRD-001-V2" class="font-mono" />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )}
                </props.form.Field>

                <Show when={props.showVariantName !== false}>
                    <props.form.Field name={fieldName('variant_name')}>
                        {(field: any) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Nombre de Variante</TextField.Label>
                                <TextField.Input type="text" placeholder="Hereda del producto" />
                                <TextField.Description>Vacío = hereda nombre del producto</TextField.Description>
                            </TextField.Root>
                        )}
                    </props.form.Field>
                </Show>
            </div>

            {/* Row 2: Barcode + Price + Sale UOM */}
            <div class="grid grid-cols-3 gap-4">
                <props.form.Field name={fieldName('barcode')}>
                    {(field: any) => (
                        <TextField.Root field={field()}>
                            <TextField.Label>Código de Barras</TextField.Label>
                            <TextField.Input type="text" class="font-mono" placeholder="EAN/UPC" />
                        </TextField.Root>
                    )}
                </props.form.Field>

                <Show when={props.showPrice !== false}>
                    <props.form.Field name={fieldName('base_price')}>
                        {(field: any) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Precio Override</TextField.Label>
                                <TextField.Input type="number" step="0.01" min={0} class="font-mono" placeholder="Hereda" />
                                <TextField.Description>Vacío = hereda precio base</TextField.Description>
                            </TextField.Root>
                        )}
                    </props.form.Field>
                </Show>

                <props.form.Field name={fieldName('sale_uom_id')}>
                    {(field: any) => (
                        <UomSelect
                            value={field().state.value}
                            onChange={(id) => field().handleChange(id)}
                            label="UOM Venta"
                            placeholder="Misma que inventario"
                        />
                    )}
                </props.form.Field>
            </div>

            {/* Dimensional tracking fields (only when active) */}
            <Show when={props.hasDimensionalTracking}>
                <div class="grid grid-cols-3 gap-3 p-3 bg-info/5 border border-info/20 rounded-xl">
                    <props.form.Field name={fieldName('content_quantity')}>
                        {(field: any) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Contenido *</TextField.Label>
                                <TextField.Input type="number" min={0.01} step="0.01" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </props.form.Field>

                    <props.form.Field name={fieldName('std_length_cm')}>
                        {(field: any) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Largo (cm)</TextField.Label>
                                <TextField.Input type="number" step="0.01" min={0} placeholder="244" />
                            </TextField.Root>
                        )}
                    </props.form.Field>

                    <props.form.Field name={fieldName('std_width_cm')}>
                        {(field: any) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Ancho (cm)</TextField.Label>
                                <TextField.Input type="number" step="0.01" min={0} placeholder="122" />
                            </TextField.Root>
                        )}
                    </props.form.Field>
                </div>
            </Show>

            {/* Active toggle */}
            <Show when={props.showActiveToggle !== false}>
                <props.form.Field name={fieldName('is_active')}>
                    {(field: any) => (
                        <Switch field={field()}>Variante Activa</Switch>
                    )}
                </props.form.Field>
            </Show>
        </>
    );
};

export default VariantFields;
