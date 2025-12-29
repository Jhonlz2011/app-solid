import { Component, Show, For, createEffect, onCleanup, createSignal, createMemo } from 'solid-js';
import { createQuery, useQueryClient } from '@tanstack/solid-query';
import { Portal } from 'solid-js/web';
import { productsApi } from '../data/products.api';
import { productKeys } from '../data/products.keys';
import type { Product, ProductClass, Category, Brand } from '../models/products.type';
import { productClassLabels, ivaRateLabels } from '../models/products.type';
import ProductFormSections from './ProductFormSections';

// Icons - from shared library
import { CloseIcon, EditIcon, ViewIcon } from '@shared/components/icons';

export type SlideMode = 'view' | 'edit' | 'create';

interface ProductSlidePanelProps {
    productId?: number;
    mode: SlideMode;
    categories: Category[];
    brands: Brand[];
    onClose: () => void;
    onSuccess: () => void;
}

const ProductSlidePanel: Component<ProductSlidePanelProps> = (props) => {
    const queryClient = useQueryClient();
    const [isAnimatingOut, setIsAnimatingOut] = createSignal(false);
    const [internalMode, setInternalMode] = createSignal<SlideMode>(props.mode);

    // Sync internal mode with prop changes
    createEffect(() => {
        setInternalMode(props.mode);
    });

    const isOpen = createMemo(() => props.mode === 'create' || props.productId !== undefined);
    const currentMode = () => internalMode();
    const isEditing = () => currentMode() === 'edit' || currentMode() === 'create';

    // Fetch product for view/edit modes
    const productQuery = createQuery(() => ({
        queryKey: productKeys.detail(props.productId!),
        queryFn: () => productsApi.get(props.productId!),
        enabled: !!props.productId && props.mode !== 'create',
        staleTime: 1000 * 60 * 5,
    }));

    const product = () => productQuery.data;

    const handleClose = () => {
        setIsAnimatingOut(true);
        setTimeout(() => {
            setIsAnimatingOut(false);
            props.onClose();
        }, 200);
    };

    const handleModeSwitch = () => {
        const newMode = currentMode() === 'view' ? 'edit' : 'view';
        setInternalMode(newMode);
    };

    const handleFormSuccess = () => {
        queryClient.invalidateQueries({ queryKey: productKeys.all });
        if (props.productId) {
            queryClient.invalidateQueries({ queryKey: productKeys.detail(props.productId) });
        }
        props.onSuccess();
        handleClose();
    };

    // ESC to close
    createEffect(() => {
        if (isOpen()) {
            const handleEscape = (e: KeyboardEvent) => {
                if (e.key === 'Escape') handleClose();
            };
            window.addEventListener('keydown', handleEscape);
            onCleanup(() => window.removeEventListener('keydown', handleEscape));
        }
    });

    // Helpers
    const formatCurrency = (val: string | number) => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(num);
    };

    const classColors: Record<ProductClass, { bg: string; text: string; border: string }> = {
        MATERIAL: { bg: 'var(--color-info-bg)', text: 'var(--color-info-text)', border: 'var(--color-info-border)' },
        TOOL: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)', border: 'var(--color-warning-border)' },
        EPP: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)', border: 'var(--color-success-border)' },
        ASSET: { bg: 'var(--color-primary-soft)', text: 'var(--color-primary)', border: 'var(--color-primary)' },
        SERVICE: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)', border: 'var(--color-warning-border)' },
        MANUFACTURED: { bg: 'var(--color-danger-bg)', text: 'var(--color-danger-text)', border: 'var(--color-danger-border)' },
    };

    const classGradients: Record<ProductClass, string> = {
        MATERIAL: 'from-blue-500 to-blue-600',
        TOOL: 'from-amber-500 to-amber-600',
        EPP: 'from-green-500 to-green-600',
        ASSET: 'from-purple-500 to-purple-600',
        SERVICE: 'from-orange-500 to-orange-600',
        MANUFACTURED: 'from-red-500 to-red-600',
    };

    const panelWidth = () => isEditing() ? 'max-w-2xl' : 'max-w-lg';
    const headerTitle = createMemo(() => {
        if (currentMode() === 'create') return 'Nuevo Producto';
        if (currentMode() === 'edit') return 'Editar Producto';
        return 'Detalle del Producto';
    });

    return (
        <Show when={isOpen()}>
            <Portal>
                {/* Backdrop */}
                <div
                    class={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-200 ${isAnimatingOut() ? 'opacity-0' : 'opacity-100'}`}
                    onClick={handleClose}
                />

                {/* Panel */}
                <div
                    class={`fixed right-0 top-0 bottom-0 z-50 w-full ${panelWidth()} shadow-2xl transform transition-all duration-300 ease-out ${isAnimatingOut() ? 'translate-x-full' : 'translate-x-0'}`}
                >
                    <div class="h-full bg-card border-l border-border flex flex-col">
                        {/* Header */}
                        <div class="flex-shrink-0 relative">
                            <Show when={product() && !isEditing()}>
                                <div class={`absolute inset-0 bg-gradient-to-br ${classGradients[product()!.product_class]} opacity-10`} />
                            </Show>
                            <Show when={isEditing()}>
                                <div class="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 opacity-10" />
                            </Show>

                            <div class="relative flex items-center justify-between px-6 py-4 border-b border-border">
                                <div class="flex items-center gap-3">
                                    <Show when={product() && currentMode() === 'view'}>
                                        <span
                                            class="px-2.5 py-1 text-xs font-semibold rounded-full border"
                                            style={{
                                                background: classColors[product()!.product_class].bg,
                                                color: classColors[product()!.product_class].text,
                                                'border-color': classColors[product()!.product_class].border
                                            }}
                                        >
                                            {productClassLabels[product()!.product_class]}
                                        </span>
                                    </Show>
                                    <Show when={isEditing()}>
                                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                        </div>
                                    </Show>
                                    <h2 class="text-lg font-semibold title-primary">{headerTitle()}</h2>
                                </div>

                                <div class="flex items-center gap-2">
                                    {/* Mode toggle (only in view/edit when product exists) */}
                                    <Show when={product() && currentMode() !== 'create'}>
                                        <button
                                            onClick={handleModeSwitch}
                                            class={`btn text-sm py-1.5 px-3 gap-1.5 ${isEditing() ? 'btn-ghost' : 'btn-primary'}`}
                                        >
                                            <Show when={isEditing()} fallback={<><EditIcon /> Editar</>}>
                                                <ViewIcon /> Ver Detalle
                                            </Show>
                                        </button>
                                    </Show>
                                    <button onClick={handleClose} class="p-2 hover:bg-white/5 rounded-lg text-muted transition-colors">
                                        <CloseIcon />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div class="flex-1 overflow-y-auto">
                            <Show when={isEditing()}>
                                {/* Edit/Create Form */}
                                <div class="p-6">
                                    <ProductFormSections
                                        initialData={currentMode() === 'edit' ? product() : undefined}
                                        categories={props.categories}
                                        brands={props.brands}
                                        onSuccess={handleFormSuccess}
                                        onCancel={handleClose}
                                    />
                                </div>
                            </Show>

                            <Show when={!isEditing()}>
                                {/* View Mode */}
                                <Show
                                    when={!productQuery.isPending && product()}
                                    fallback={
                                        <div class="p-6 space-y-6">
                                            {/* Skeleton loader */}
                                            <div class="flex items-start gap-4 animate-pulse">
                                                <div class="w-24 h-24 rounded-xl bg-surface/50" />
                                                <div class="flex-1 space-y-3">
                                                    <div class="w-20 h-3 rounded bg-surface/50" />
                                                    <div class="w-48 h-5 rounded bg-surface/50" />
                                                    <div class="w-32 h-3 rounded bg-surface/50" />
                                                </div>
                                            </div>
                                            <div class="grid grid-cols-2 gap-3">
                                                <div class="h-16 rounded-xl bg-surface/30" />
                                                <div class="h-16 rounded-xl bg-surface/30" />
                                            </div>
                                        </div>
                                    }
                                >
                                    <div class="p-6 space-y-6">
                                        {/* Hero Section */}
                                        <div class="flex items-start gap-4">
                                            <Show when={product()!.image_urls?.[0]} fallback={
                                                <div class="w-24 h-24 rounded-xl bg-gradient-to-br from-surface to-surface/50 flex items-center justify-center border border-white/5">
                                                    <svg class="w-10 h-10 text-muted/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                            }>
                                                <img
                                                    src={product()!.image_urls![0]}
                                                    alt={product()!.name}
                                                    class="w-24 h-24 rounded-xl object-cover ring-2 ring-white/10"
                                                />
                                            </Show>
                                            <div class="flex-1 min-w-0">
                                                <p class="font-mono text-sm text-primary font-semibold">{product()!.sku}</p>
                                                <h3 class="text-xl font-bold title-primary mt-1 leading-tight">{product()!.name}</h3>
                                                <Show when={product()!.description}>
                                                    <p class="text-muted text-sm mt-2 line-clamp-2">{product()!.description}</p>
                                                </Show>
                                            </div>
                                        </div>

                                        {/* Classification */}
                                        <div class="grid grid-cols-2 gap-3">
                                            <div class="p-4 bg-surface/30 rounded-xl border border-white/5">
                                                <p class="text-xs text-muted uppercase tracking-wider font-medium">Categoría</p>
                                                <p class="font-semibold title-primary mt-1">{product()!.category?.name || '—'}</p>
                                            </div>
                                            <div class="p-4 bg-surface/30 rounded-xl border border-white/5">
                                                <p class="text-xs text-muted uppercase tracking-wider font-medium">Marca</p>
                                                <p class="font-semibold title-primary mt-1">{product()!.brand?.name || '—'}</p>
                                            </div>
                                        </div>

                                        {/* Pricing Card */}
                                        <div class="p-5 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl border border-emerald-500/20">
                                            <div class="flex items-center justify-between">
                                                <div>
                                                    <p class="text-xs text-emerald-400/80 uppercase tracking-wider font-medium">Precio de Venta</p>
                                                    <p class="text-3xl font-bold text-emerald-400 mt-1">{formatCurrency(product()!.base_price)}</p>
                                                </div>
                                                <div class="text-right">
                                                    <p class="text-xs text-muted uppercase tracking-wider font-medium">Costo</p>
                                                    <p class="text-lg font-semibold text-muted mt-1">{formatCurrency(product()!.last_cost)}</p>
                                                </div>
                                            </div>
                                            <Show when={parseFloat(product()!.last_cost) > 0}>
                                                <div class="flex items-center justify-between mt-4 pt-4 border-t border-emerald-500/20">
                                                    <span class="text-sm text-muted">Margen de Ganancia</span>
                                                    <span class="text-lg font-bold text-emerald-400">
                                                        {((parseFloat(product()!.base_price) - parseFloat(product()!.last_cost)) / parseFloat(product()!.last_cost) * 100).toFixed(1)}%
                                                    </span>
                                                </div>
                                            </Show>
                                        </div>

                                        {/* Quick Stats */}
                                        <div class="grid grid-cols-3 gap-3">
                                            <div class="p-3 bg-surface/30 rounded-xl border border-white/5 text-center">
                                                <p class="text-xs text-muted">UOM</p>
                                                <p class="font-semibold title-primary mt-1">{product()!.uom_inventory_code || 'UND'}</p>
                                            </div>
                                            <div class="p-3 bg-surface/30 rounded-xl border border-white/5 text-center">
                                                <p class="text-xs text-muted">Stock Mín.</p>
                                                <p class="font-semibold title-primary mt-1">{product()!.min_stock_alert || '0'}</p>
                                            </div>
                                            <div class="p-3 bg-surface/30 rounded-xl border border-white/5 text-center">
                                                <p class="text-xs text-muted">IVA</p>
                                                <p class="font-semibold title-primary mt-1">{ivaRateLabels[product()!.iva_rate_code] || '15%'}</p>
                                            </div>
                                        </div>

                                        {/* Specs */}
                                        <Show when={product()!.specs && Object.keys(product()!.specs!).length > 0}>
                                            <div class="space-y-3">
                                                <h4 class="text-sm font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                    </svg>
                                                    Especificaciones
                                                </h4>
                                                <div class="p-4 bg-surface/30 rounded-xl border border-white/5 space-y-2">
                                                    <For each={Object.entries(product()!.specs!)}>
                                                        {([key, value]) => (
                                                            <div class="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
                                                                <span class="text-sm text-muted capitalize">{key.replace(/_/g, ' ')}</span>
                                                                <span class="font-medium title-primary text-sm">{String(value)}</span>
                                                            </div>
                                                        )}
                                                    </For>
                                                </div>
                                            </div>
                                        </Show>

                                        {/* Images Gallery */}
                                        <Show when={product()!.image_urls && product()!.image_urls!.length > 1}>
                                            <div class="space-y-3">
                                                <h4 class="text-sm font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    Galería
                                                </h4>
                                                <div class="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
                                                    <For each={product()!.image_urls}>
                                                        {(url) => (
                                                            <img
                                                                src={url}
                                                                alt=""
                                                                class="w-20 h-20 rounded-lg object-cover flex-shrink-0 ring-1 ring-white/10 hover:ring-2 hover:ring-primary transition-all cursor-pointer"
                                                            />
                                                        )}
                                                    </For>
                                                </div>
                                            </div>
                                        </Show>

                                        {/* Status Tags */}
                                        <div class="flex flex-wrap gap-2 pt-2">
                                            <span class={`px-3 py-1.5 text-xs font-semibold rounded-full ${product()!.is_active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                                {product()!.is_active ? '✓ Activo' : '✕ Inactivo'}
                                            </span>
                                            <Show when={product()!.track_dimensional}>
                                                <span class="px-3 py-1.5 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                    📐 Dimensional
                                                </span>
                                            </Show>
                                            <Show when={product()!.is_service}>
                                                <span class="px-3 py-1.5 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                                    🛠️ Servicio
                                                </span>
                                            </Show>
                                        </div>
                                    </div>
                                </Show>
                            </Show>
                        </div>
                    </div>
                </div>
            </Portal>
        </Show>
    );
};

export default ProductSlidePanel;
