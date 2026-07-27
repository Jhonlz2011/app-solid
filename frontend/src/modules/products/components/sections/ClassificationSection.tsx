/**
 * ClassificationSection — Classification module for Product/Service Catalog.
 * 
 * Features:
 * - Interactive Subtype Card Selector (SIMPLE, COMPUESTO, FABRICADO) with icons & contextual guidance.
 * - Category Autocomplete selector with inline creation shortcut.
 * - Brand Autocomplete selector with inline creation shortcut.
 */
import { Component, Show, For } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import { FieldLabel } from '@shared/ui/TextField';
import { CategorySelect, BrandSelect } from '@shared/ui/selectors';
import { PlusIcon, FolderIcon } from '@shared/ui/icons';
import type { CatalogModeConfig } from '@shared/forms/catalog';
import type { ProductSubtype } from '@app/schema/enums';
import SectionHeader from '../ui/SectionHeader';

interface SubtypeOption {
    value: ProductSubtype;
    label: string;
    icon: string;
    description: string;
    badge: string;
}

const SUBTYPE_OPTIONS: SubtypeOption[] = [
    {
        value: 'SIMPLE',
        label: 'Simple',
        icon: '📦',
        description: 'Ítem estándar de compra, venta o almacenamiento individual.',
        badge: 'Estándar',
    },
    {
        value: 'COMPUESTO',
        label: 'Compuesto / Kit',
        icon: '🧩',
        description: 'Ensamblado a partir de otros productos (BOM / Kit de venta / Despiece).',
        badge: 'BOM / Kit',
    },
    {
        value: 'FABRICADO',
        label: 'Fabricado',
        icon: '⚙️',
        description: 'Producido mediante órdenes de fabricación con transformación de insumos.',
        badge: 'Producción',
    },
];

interface ClassificationSectionProps {
    form: any;
    mode: CatalogModeConfig;
    hasAttemptedSubmit: () => boolean;
}

const ClassificationSection: Component<ClassificationSectionProps> = (props) => {
    return (
        <fieldset class="space-y-4 bg-surface/30 p-4 sm:p-5 rounded-2xl border border-border/40">
            <SectionHeader 
                color="primary" 
                title="Tipo y Clasificación" 
                description="Define la naturaleza del ítem y su jerarquía en el catálogo"
            />

            {/* Row 1: Subtype Card Selector — Only for PRODUCTO mode */}
            <Show when={props.mode.features.subtype}>
                <props.form.Field name="product_subtype">
                    {(field: any) => {
                        const currentValue = () => (field().state.value ?? 'SIMPLE') as ProductSubtype;

                        return (
                            <div class="space-y-2">
                                <div class="flex items-center justify-between">
                                    <FieldLabel>Subtipo de Producto *</FieldLabel>
                                    <span class="text-[11px] text-muted font-medium">
                                        Selecciona cómo opera este ítem
                                    </span>
                                </div>

                                {/* 3-Card Interactive Selector */}
                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                    <For each={SUBTYPE_OPTIONS}>
                                        {(opt) => {
                                            const isSelected = () => currentValue() === opt.value;
                                            return (
                                                <button
                                                    type="button"
                                                    onClick={() => field().handleChange(opt.value)}
                                                    class="relative flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer outline-none group"
                                                    classList={{
                                                        'bg-primary/10 border-primary shadow-sm ring-1 ring-primary/30': isSelected(),
                                                        'bg-card border-border/60 hover:border-primary/40 hover:bg-card-alt': !isSelected(),
                                                    }}
                                                >
                                                    {/* Header: Icon + Label + Badge */}
                                                    <div class="flex items-center justify-between gap-1.5 w-full mb-1">
                                                        <div class="flex items-center gap-1.5 min-w-0">
                                                            <span class="text-base leading-none">{opt.icon}</span>
                                                            <span 
                                                                class="text-xs font-bold truncate"
                                                                classList={{
                                                                    'text-primary': isSelected(),
                                                                    'text-text': !isSelected(),
                                                                }}
                                                            >
                                                                {opt.label}
                                                            </span>
                                                        </div>
                                                        <span 
                                                            class="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                                                            classList={{
                                                                'bg-primary text-white': isSelected(),
                                                                'bg-surface-hover text-muted': !isSelected(),
                                                            }}
                                                        >
                                                            {opt.badge}
                                                        </span>
                                                    </div>

                                                    {/* Description micro-copy */}
                                                    <p class="text-[11px] text-muted leading-tight line-clamp-2">
                                                        {opt.description}
                                                    </p>

                                                    {/* Selection Radio Indicator Dot */}
                                                    <div 
                                                        class="absolute top-2.5 right-2.5 size-2 rounded-full transition-all"
                                                        classList={{
                                                            'bg-primary ring-2 ring-primary/30 scale-100': isSelected(),
                                                            'opacity-0 scale-50': !isSelected(),
                                                        }}
                                                    />
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

            {/* Row 2: Category + Brand — 2-column responsive grid */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Category Selector */}
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
                                    parentSelectable={false}
                                    field={f}
                                    inputPrefix={<FolderIcon class="size-4 text-muted" />}
                                    placeholder="Seleccionar categoría..."
                                />
                            );
                        }}
                    </props.form.Field>
                </div>

                {/* Brand Selector */}
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
        </fieldset>
    );
};

export default ClassificationSection;
