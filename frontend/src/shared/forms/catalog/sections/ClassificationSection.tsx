/**
 * ClassificationSection — Classification module for Product/Service Catalog.
 * 
 * Features:
 * - Interactive Subtype Card Selector (SIMPLE, COMPUESTO, FABRICADO) with icons & contextual guidance.
 * - Category Autocomplete selector with inline creation shortcut and selected card with dynamic path Link.
 * - Brand Autocomplete selector with inline creation shortcut and selected card with dynamic path Link.
 */
import { Component, Show, For, createMemo } from 'solid-js';
import type { CatalogFormApi } from '../catalog-form.types';
import { Link } from '@tanstack/solid-router';
import { FieldLabel } from '@shared/ui/TextField';
import { CategorySelect, BrandSelect, SelectorBreadcrumbs, buildBreadcrumbs, useResolvedSelectorPath } from '@shared/ui/selectors';
import { PlusIcon, FolderIcon, TagIcon, CloseIcon, ProductIcon, LayersIcon, BoxIcon } from '@shared/ui/icons';
import Button from '@shared/ui/Button';
import type { CatalogModeConfig } from '@shared/forms/catalog';
import type { ProductSubtype } from '@app/schema/enums';
import { useCategoriesFlat } from '@/modules/categories/data/categories.queries';
import { useBrandsList } from '@/modules/brands/data/brands.queries';
import SectionHeader from '../../../../modules/products/components/ui/SectionHeader';

import type { JSX } from 'solid-js';

interface SubtypeOption {
    value: ProductSubtype;
    label: string;
    icon: () => JSX.Element;
    description: string;
    badge: string;
}

const SUBTYPE_OPTIONS: SubtypeOption[] = [
    {
        value: 'SIMPLE',
        label: 'Simple',
        icon: () => <ProductIcon class="size-5" />,
        description: 'Ítem estándar de compra, venta o almacenamiento individual.',
        badge: 'Estándar',
    },
    {
        value: 'COMPUESTO',
        label: 'Compuesto / Kit',
        icon: () => <LayersIcon class="size-5" />,
        description: 'Ensamblado a partir de otros productos (BOM / Kit de venta / Despiece).',
        badge: 'BOM / Kit',
    },
    {
        value: 'FABRICADO',
        label: 'Fabricado',
        icon: () => <BoxIcon class="size-5" />,
        description: 'Producido mediante órdenes de fabricación con transformación de insumos.',
        badge: 'Producción',
    },
];

interface ClassificationSectionProps {
    form: CatalogFormApi;
    mode: CatalogModeConfig;
    hasAttemptedSubmit: () => boolean;
}

const ClassificationSection: Component<ClassificationSectionProps> = (props) => {
    const categoriesFlat = useCategoriesFlat();
    const brandsQuery = useBrandsList();

    const resolvedCategoryPath = useResolvedSelectorPath('/categories');
    const resolvedBrandPath = useResolvedSelectorPath('/brands');

    const categoryIdValue = props.form.useStore((s) => s.values.category_id);
    const brandIdValue = props.form.useStore((s) => s.values.brand_id);

    type CategoryItem = { id: number; name: string; parent_id: number | null };
    type BrandItem = { id: number; name: string };
    const flatCategories = createMemo(() => (categoriesFlat.data ?? []) as CategoryItem[]);
    const flatBrands = createMemo(() => (brandsQuery.data ?? []) as BrandItem[]);

    const selectedCategory = createMemo(() => {
        const id = categoryIdValue();
        if (!id || id <= 0) return null;
        return flatCategories().find(c => c.id === id) ?? null;
    });

    const selectedBrand = createMemo(() => {
        const id = brandIdValue();
        if (!id) return null;
        return flatBrands().find(b => b.id === id) ?? null;
    });

    const categoryBreadcrumbs = createMemo(() => {
        const cat = selectedCategory();
        if (!cat) return [];
        return buildBreadcrumbs(cat.id, flatCategories(), {
            getId: (c) => c.id,
            getParentId: (c) => c.parent_id,
            getName: (c) => c.name,
            skipSelf: true,
        });
    });

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
                    {(field) => {
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
                                                            <span class="text-base leading-none">{opt.icon()}</span>
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
                        {(field) => {
                            const f = field();
                            return (
                                <Show
                                    when={selectedCategory()}
                                    fallback={
                                        <CategorySelect
                                            value={f.state.value}
                                            onChange={(id) => f.handleChange(id ?? 0)}
                                            parentSelectable={false}
                                            field={f}
                                            inputPrefix={<FolderIcon class="size-4 text-muted" />}
                                            placeholder="Seleccionar categoría..."
                                        />
                                    }
                                >
                                    {(cat) => (
                                        <div class="flex items-center gap-2 p-1 pl-3 pr-2 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/30 hover:border-primary/50 transition-all duration-200 shadow-xs min-h-9.5">
                                            <div class="flex-1 min-w-0">
                                                <div class="flex items-center gap-2">
                                                    <TagIcon class="size-4 text-primary dark:text-primary/400 shrink-0" />
                                                    <Link
                                                        to={`${resolvedCategoryPath()}/${cat().id}/show`}
                                                        preload="intent"
                                                        class="text-xs font-bold text-text uppercase tracking-wide truncate hover:text-primary hover:underline cursor-pointer"
                                                        title="Ver detalle de esta categoría"
                                                    >
                                                        {cat().name}
                                                    </Link>
                                                </div>
                                                <SelectorBreadcrumbs 
                                                    items={categoryBreadcrumbs()} 
                                                    basePath="/categories" 
                                                />
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => f.handleChange(0)}
                                                class="text-muted/60 hover:text-danger hover:bg-transparent p-1 rounded-lg shrink-0 cursor-pointer h-7"
                                                title="Desvincular categoría"
                                            >
                                                <CloseIcon class="size-4" />
                                            </Button>
                                        </div>
                                    )}
                                </Show>
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
                        {(field) => {
                            const f = field();
                            return (
                                <Show
                                    when={selectedBrand()}
                                    fallback={
                                        <BrandSelect
                                            value={f.state.value}
                                            onChange={(id) => f.handleChange(id)}
                                        />
                                    }
                                >
                                    {(brand) => (
                                        <div class="flex items-center gap-2 p-1 pl-3 pr-2 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/30 hover:border-primary/50 transition-all duration-200 shadow-xs min-h-9.5">
                                            <div class="flex-1 min-w-0">
                                                <div class="flex items-center gap-2">
                                                    <TagIcon class="size-4 text-primary shrink-0" />
                                                    <Link
                                                        to={`${resolvedBrandPath()}/${brand().id}/show`}
                                                        preload="intent"
                                                        class="text-xs font-bold text-text uppercase tracking-wide truncate hover:text-primary hover:underline cursor-pointer"
                                                        title="Ver detalle de esta marca"
                                                    >
                                                        {brand().name}
                                                    </Link>
                                                </div>
                                                <span class="text-[11px] font-semibold text-primary/80 ml-6 block truncate">
                                                    MARCA SELECCIONADA
                                                </span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => f.handleChange(null)}
                                                class="text-muted/60 hover:text-danger hover:bg-transparent p-1 rounded-lg shrink-0 cursor-pointer h-7"
                                                title="Desvincular marca"
                                            >
                                                <CloseIcon class="size-4" />
                                            </Button>
                                        </div>
                                    )}
                                </Show>
                            );
                        }}
                    </props.form.Field>
                </div>
            </div>
        </fieldset>
    );
};

export default ClassificationSection;
