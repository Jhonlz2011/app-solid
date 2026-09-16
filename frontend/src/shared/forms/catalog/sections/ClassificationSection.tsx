/**
 * ClassificationSection — Shopify-style Organization & Classification card.
 * Elevated bg-card with crisp borders and clean tokens.
 * Features:
 * - Subtype Segmented Control (Simple, Compuesto, Fabricado)
 * - Category Autocomplete connected to standard taxonomy
 * - Brand selector
 */
import { Component, Show, For } from 'solid-js';
import type { CatalogFormApi } from '../catalog-form.types';
import { FieldLabel } from '@form/TextField';
import { CategorySelect, BrandSelect } from '@shared/ui/selectors';
import { LayersIcon } from '@icons/LayersIcon';
import type { CatalogModeConfig } from '@shared/forms/catalog';
import type { ProductSubtype } from '@app/schema/enums';

interface SubtypeOption {
    value: ProductSubtype;
    label: string;
    description: string;
}

const SUBTYPE_OPTIONS: SubtypeOption[] = [
    {
        value: 'SIMPLE',
        label: 'Simple',
        description: 'Ítem estándar de compra, venta o inventario',
    },
    {
        value: 'COMPUESTO',
        label: 'Compuesto / Kit',
        description: 'Ensamblado a partir de otros productos (BOM)',
    },
    {
        value: 'FABRICADO',
        label: 'Fabricado',
        description: 'Transformación con orden de producción',
    },
];

interface ClassificationSectionProps {
    form: CatalogFormApi;
    mode: CatalogModeConfig;
    hasAttemptedSubmit: () => boolean;
}

export const ClassificationSection: Component<ClassificationSectionProps> = (props) => {
    return (
        <fieldset class="bg-card border border-border/90 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col gap-4">
            <div class="flex items-center gap-2">
                <div class="p-1 rounded-md bg-primary-soft text-primary">
                    <LayersIcon class="size-4" />
                </div>
                <h3 class="text-sm font-semibold text-text">Organización</h3>
            </div>

            {/* Subtype Selector (Only for PRODUCTO mode) */}
            <Show when={props.mode.features.subtype}>
                <props.form.Field name="product_subtype">
                    {(field) => {
                        const currentValue = () => (field().state.value ?? 'SIMPLE') as ProductSubtype;

                        return (
                            <div class="space-y-1.5">
                                <FieldLabel>Subtipo de Producto *</FieldLabel>
                                <div class="grid grid-cols-3 gap-1.5 p-1 bg-surface border border-border rounded-lg">
                                    <For each={SUBTYPE_OPTIONS}>
                                        {(opt) => {
                                            const isSelected = () => currentValue() === opt.value;
                                            return (
                                                <button
                                                    type="button"
                                                    onClick={() => field().handleChange(opt.value)}
                                                    class="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all text-center cursor-pointer"
                                                    classList={{
                                                        'bg-card text-primary font-semibold border border-border/80 shadow-2xs': isSelected(),
                                                        'text-muted hover:text-text hover:bg-card-alt/50': !isSelected(),
                                                    }}
                                                    title={opt.description}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        }}
                                    </For>
                                </div>
                            </div>
                        );
                    }}
                </props.form.Field>
            </Show>

            {/* Category Selector with Taxonomy Autocomplete */}
            <props.form.Field name="category_id">
                {(field) => {
                    const f = field();
                    return (
                        <CategorySelect
                            value={f.state.value}
                            onChange={(id) => f.handleChange(id ?? 0)}
                            label="Categoría del Producto *"
                            placeholder="Buscar en taxonomía estándar..."
                            field={f}
                        />
                    );
                }}
            </props.form.Field>

            {/* Brand Selector */}
            <props.form.Field name="brand_id">
                {(field) => {
                    const f = field();
                    return (
                        <div class="space-y-1.5">
                            <FieldLabel optional>Marca</FieldLabel>
                            <BrandSelect
                                value={f.state.value}
                                onChange={(id) => f.handleChange(id)}
                            />
                        </div>
                    );
                }}
            </props.form.Field>
        </fieldset>
    );
};

export default ClassificationSection;
