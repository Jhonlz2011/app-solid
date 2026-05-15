/**
 * ClassificationSection — Compact layout for product classification.
 * Type + Subtype in 2 columns. Category + Brand in 2 columns. Family below.
 * Each Autocomplete selector has a "+" Link button for inline creation via TanStack Router.
 */
import { Component, Show, Index } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import { FieldLabel } from '@shared/ui/TextField';
import { CategorySelect, BrandSelect, FamilySelect } from '@shared/ui/selectors';
import {
    SegmentedControl, SegmentedControlIndicator,
    SegmentedControlItem, SegmentedControlItemInput, SegmentedControlItemLabel,
} from '@shared/ui/SegmentedControl';
import { hasFieldError, getFieldError } from '@shared/ui/form/form.types';
import { PlusIcon } from '@shared/ui/icons';
import SectionHeader from '../ui/SectionHeader';

const PRODUCT_TYPE_OPTIONS = [
    { value: 'PRODUCTO', label: 'Producto', icon: '📦' },
    { value: 'SERVICIO', label: 'Servicio', icon: '🔧' },
];

const PRODUCT_SUBTYPE_OPTIONS = [
    { value: 'SIMPLE', label: 'Simple' },
    { value: 'COMPUESTO', label: 'Compuesto' },
    { value: 'FABRICADO', label: 'Fabricado' },
];

interface ClassificationSectionProps {
    form: any;
    productType: () => string;
    hasAttemptedSubmit: () => boolean;
}

const ClassificationSection: Component<ClassificationSectionProps> = (props) => {
    return (
        <fieldset class="space-y-4 bg-surface/30 p-4 sm:p-5 rounded-2xl border border-border/40">
            <SectionHeader color="primary" title="Tipo y Clasificación" />

            {/* Row 1: Type + Subtype — compact 2-col, responsive */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                    <FieldLabel>Tipo de Producto</FieldLabel>
                    <props.form.Field name="product_type">
                        {(field: any) => {
                            const f = field();
                            return (
                                <SegmentedControl
                                    value={f.state.value}
                                    onChange={(val: any) => f.handleChange(val as any)}
                                >
                                    <SegmentedControlIndicator />
                                    <Index each={PRODUCT_TYPE_OPTIONS}>
                                        {(opt) => (
                                            <SegmentedControlItem value={opt().value}>
                                                <SegmentedControlItemInput />
                                                <SegmentedControlItemLabel>
                                                    {opt().icon} {opt().label}
                                                </SegmentedControlItemLabel>
                                            </SegmentedControlItem>
                                        )}
                                    </Index>
                                </SegmentedControl>
                            );
                        }}
                    </props.form.Field>
                </div>

                <Show when={props.productType() === 'PRODUCTO'}>
                    <div class="space-y-1.5">
                        <FieldLabel>Subtipo</FieldLabel>
                        <props.form.Field name="product_subtype">
                            {(field: any) => {
                                const f = field();
                                return (
                                    <SegmentedControl
                                        value={f.state.value ?? ''}
                                        onChange={(val: any) => f.handleChange((val || null) as any)}
                                    >
                                        <SegmentedControlIndicator />
                                        <Index each={PRODUCT_SUBTYPE_OPTIONS}>
                                            {(opt) => (
                                                <SegmentedControlItem value={opt().value}>
                                                    <SegmentedControlItemInput />
                                                    <SegmentedControlItemLabel>{opt().label}</SegmentedControlItemLabel>
                                                </SegmentedControlItem>
                                            )}
                                        </Index>
                                    </SegmentedControl>
                                );
                            }}
                        </props.form.Field>
                    </div>
                </Show>
            </div>

            {/* Row 2: Category + Brand — responsive grid with Link create buttons */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                    <div class="flex items-center justify-between">
                        <FieldLabel>Categoría *</FieldLabel>
                        <Link
                            to="./categories/new"
                            preload="intent"
                            class="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
                            title="Crear nueva categoría"
                        >
                            <PlusIcon class="size-3" />
                            Nueva
                        </Link>
                    </div>
                    <props.form.Field name="category_id">
                        {(field: any) => {
                            const f = field();
                            return (
                                <CategorySelect
                                    value={f.state.value}
                                    onChange={(id) => f.handleChange(id ?? 0)}
                                    required
                                    error={hasFieldError(f, props.hasAttemptedSubmit()) ? getFieldError(f) : undefined}
                                />
                            );
                        }}
                    </props.form.Field>
                </div>

                <div class="space-y-1.5">
                    <div class="flex items-center justify-between">
                        <FieldLabel>Marca</FieldLabel>
                        <Link
                            to="./brands/new"
                            preload="intent"
                            class="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
                            title="Crear nueva marca"
                        >
                            <PlusIcon class="size-3" />
                            Nueva
                        </Link>
                    </div>
                    <props.form.Field name="brand_id">
                        {(field: any) => {
                            const f = field();
                            return (
                                <BrandSelect
                                    value={f.state.value}
                                    onChange={(id) => f.handleChange(id)}
                                />
                            );
                        }}
                    </props.form.Field>
                </div>
            </div>

            {/* Row 3: Family */}
            <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                    <FieldLabel>Familia de Producto</FieldLabel>
                    <Link
                        to="./families/new"
                        preload="intent"
                        class="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
                        title="Crear nueva familia"
                    >
                        <PlusIcon class="size-3" />
                        Nueva
                    </Link>
                </div>
                <props.form.Field name="family_id">
                    {(field: any) => {
                        const f = field();
                        return (
                            <FamilySelect
                                value={f.state.value}
                                onChange={(id) => f.handleChange(id)}
                            />
                        );
                    }}
                </props.form.Field>
            </div>
        </fieldset>
    );
};

export default ClassificationSection;
