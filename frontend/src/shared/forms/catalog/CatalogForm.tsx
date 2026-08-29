/**
 * CatalogForm — 2-column layout: Tabs LEFT, Images+Attributes RIGHT.
 * Mode-aware version of ProductForm for both Products and Services.
 */
import { Component, Show, createSignal, createEffect, createMemo, onCleanup, untrack } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { ProductFormSchema } from '@app/schema/frontend';
import type { ProductFormData, ProductVariantFormData } from '@app/schema/frontend';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { handleFormApiErrors } from '@shared/utils/form.utils';
import type { ProductComponentFormData } from '@app/schema/frontend';

// Shared UI
import Switch from '@/shared/ui/form/Switch';
import { FileUploadDropzone } from '@/shared/ui/overlay/FileUpload';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/form/Tabs';
import { UploadIcon } from '@icons/UploadIcon';
import { InfoIcon } from '@icons/InfoIcon';

// Data
import { useCategoryFormSchema } from '@/modules/categories/data/categories.queries';
import { productsApi } from '@/modules/products/data/products.api';
import type { Product } from '@/modules/products/data/products.api';

// Form sections
import ClassificationSection from '@/shared/forms/catalog/sections/ClassificationSection';
import IdentificationSection from '@/shared/forms/catalog/sections/IdentificationSection';
import SalesSection from '@/shared/forms/catalog/sections/SalesSection';
import PurchaseSection from '@/shared/forms/catalog/sections/PurchaseSection';
import InventorySection from '@/shared/forms/catalog/sections/InventorySection';

import VariantsSection from '@/shared/forms/catalog/sections/VariantsSection';
import BomSection from '@/shared/forms/catalog/sections/BomSection';
import DynamicAttributeFields from '@/modules/products/components/DynamicAttributeFields';
import NameTemplatePreview from '@shared/forms/catalog/sections/NameTemplatePreview';

import type { CatalogModeConfig } from './catalog-form.utils';
import { useTabErrors } from '@shared/forms/useTabErrors';

export interface CatalogFormProps {
    mode: CatalogModeConfig;
    product?: Product;
    onSubmit: (data: ProductFormData) => Promise<void>;
    isSubmitting: boolean;
    formId: string;
}

const defaultVariant = (): ProductVariantFormData => ({
    id: null,
    sku: '',
    variant_name: null,
    variant_attributes: {},
    content_quantity: 1,
    sale_uom_id: null,
    base_price: null,
    last_cost: null,
    barcode: null,
    image_urls: null,
    std_length_cm: null,
    std_width_cm: null,
    is_default: true,
    is_active: true,
    sort_order: 0,
});

function buildDefaultValues(mode: CatalogModeConfig, product?: Product): ProductFormData {
    if (product) {
        const variants = product.variants ?? [];
        return {
            product_type: product.product_type ?? mode.type,
            product_subtype: product.product_subtype ?? null,
            category_id: product.category_id ?? 0,
            brand_id: product.brand_id ?? null,
            slug: product.slug ?? '',
            name: product.name ?? '',
            description: product.description ?? null,
            shared_attributes: (product.shared_attributes as Record<string, unknown>) ?? {},

            image_urls: product.image_urls ?? [],
            components: (product.components ?? []).map((c) => ({
                id: c.id ?? null,
                component_product_id: c.component_product_id,
                quantity_per_parent: Number(c.quantity_per_parent),
                is_reversible: c.is_reversible ?? true,
                notes: c.notes ?? null,
            })),
            uom_inventory_id: product.uom_inventory_id ?? 0,

            has_dimensional_tracking: product.has_dimensional_tracking ?? false,
            min_stock_alert: Number(product.min_stock_alert) || null,
            default_base_price: Number(product.default_base_price) || 0,
            iva_rate_code: product.iva_rate_code ?? 4,
            is_active: product.is_active ?? true,
            variants: variants.length > 0
                ? variants.map((v) => ({
                    id: v.id ?? null,
                    sku: v.sku ?? '',
                    variant_name: v.variant_name ?? null,
                    variant_attributes: (v.variant_attributes as Record<string, unknown>) ?? {},
                    content_quantity: Number(v.content_quantity) || 1,
                    sale_uom_id: v.sale_uom_id ?? null,
                    base_price: v.base_price ? Number(v.base_price) : null,
                    last_cost: v.last_cost ? Number(v.last_cost) : null,
                    barcode: v.barcode ?? null,
                    image_urls: v.image_urls ?? null,
                    std_length_cm: v.std_length_cm ? Number(v.std_length_cm) : null,
                    std_width_cm: v.std_width_cm ? Number(v.std_width_cm) : null,
                    is_default: v.is_default ?? false,
                    is_active: v.is_active ?? true,
                    sort_order: v.sort_order ?? 0,
                }))
                : [defaultVariant()],
        };
    }
    return {
        product_type: mode.type,
        product_subtype: mode.type === 'SERVICIO' ? null : 'SIMPLE',
        category_id: 0, brand_id: null,
        slug: '', name: '', description: null,
        shared_attributes: {}, image_urls: [], components: [],
        uom_inventory_id: 0,
        has_dimensional_tracking: false,
        min_stock_alert: null, default_base_price: 0, iva_rate_code: 4,
        is_active: true, variants: [defaultVariant()],
    };
}

export const CatalogForm: Component<CatalogFormProps> = (props) => {
    const isEdit = () => !!props.product;
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);
    const [manualNameOverride, setManualNameOverride] = createSignal(false);
    const [pendingFiles, setPendingFiles] = createSignal<File[]>([]);
    const [isUploading, setIsUploading] = createSignal(false);

    onCleanup(() => {
        pendingFiles().forEach((f) => {
            const fileWithPreview = f as File & { _previewUrl?: string };
            if (fileWithPreview._previewUrl) {
                try { URL.revokeObjectURL(fileWithPreview._previewUrl); } catch { }
            }
        });
    });

    // ── TanStack Form ─────────────────────────────────────────────────
    const form = createForm(() => ({
        defaultValues: buildDefaultValues(props.mode, props.product),
        validators: { onChange: ProductFormSchema, onSubmit: ProductFormSchema },
        onSubmit: async ({ value }) => {
            let uploadedUrls: string[] = [];
            if (pendingFiles().length > 0) {
                setIsUploading(true);
                try {
                    uploadedUrls = await productsApi.uploadImages(pendingFiles());
                    const existing = form.getFieldValue('image_urls') ?? [];
                    form.setFieldValue('image_urls', [...existing, ...uploadedUrls]);
                    setPendingFiles([]);
                }
                finally { setIsUploading(false); }
            }

            // Work on a copy to avoid mutating TanStack Form internal state
            const formValue = structuredClone(value);

            let slug = formValue.slug;
            if (!slug || slug.trim() === '') {
                slug = await productsApi.generateSku(formValue.category_id || undefined, formValue.brand_id || undefined);
            }
            if (!formValue.variants[0]?.sku || formValue.variants[0].sku.trim() === '') {
                formValue.variants[0].sku = slug;
            }
            if (!formValue.has_dimensional_tracking) {
                formValue.variants = formValue.variants.map(v => ({ ...v, content_quantity: 1, std_length_cm: null, std_width_cm: null }));
            }

            const existingUrls = form.getFieldValue('image_urls') ?? [];
            const payload: ProductFormData = {
                ...formValue, slug,
                image_urls: existingUrls,
                shared_attributes: form.getFieldValue('shared_attributes') ?? {},
                variants: formValue.variants.map((v, i) => ({ ...v, is_default: i === 0 ? true : v.is_default })),
            };

            try { await props.onSubmit(payload); }
            catch (err) {
                // Fire-and-forget cleanup of orphaned R2 images
                if (uploadedUrls.length > 0) {
                    Promise.allSettled(
                        uploadedUrls.map(url => productsApi.deleteImage?.(url))
                    ).catch(() => {/* silent */ });
                }
                handleFormApiErrors(form, err, 'Error al guardar el producto', props.formId ?? 'product-form');
            }
        },
    }));

    // ── Reactive selectors ────────────────────────────────────────────────────
    const categoryId = form.useStore((s) => s.values.category_id);
    const productSubtype = form.useStore((s) => s.values.product_subtype);
    const imageUrls = form.useStore((s) => s.values.image_urls);
    // Stabilize shared_attributes: serialize in selector → primitive comparison
    // prevents downstream effects from re-firing when unrelated fields change
    const sharedAttributesJson = form.useStore((s) => JSON.stringify(s.values.shared_attributes ?? {}));
    const sharedAttributes = createMemo(() => JSON.parse(sharedAttributesJson()) as Record<string, unknown>);
    const variants = form.useStore((s) => s.values.variants);

    // Centralized category schema query — single subscription shared via props
    const categorySchemaQuery = useCategoryFormSchema(() => categoryId() > 0 ? categoryId() : null);

    const categoryAttributes = createMemo(() => categorySchemaQuery.data?.attributes ?? []);
    const nameTemplate = createMemo(() => categorySchemaQuery.data?.category?.nameTemplate ?? null);
    const hasTemplate = createMemo(() => !!nameTemplate());


    // Pre-computed additional variants — single computation shared via props
    const additionalVariants = createMemo(() => (variants() as ProductVariantFormData[]).slice(1));

    createEffect(() => { categoryId(); setManualNameOverride(false); });

    // Multi-tab error indicators
    const tabErrors = useTabErrors(form, hasAttemptedSubmit, {
        general: { prefixes: [], isDefault: true },
        ventas: { prefixes: ['default_base_price', 'iva_rate_code', 'variants[0].sale_uom_id'] },
        compras: { prefixes: ['variants[0].last_cost'] },
        inventario: { prefixes: ['uom_inventory_id', 'min_stock_alert', 'has_dimensional_tracking', 'variants[0].content_quantity', 'variants[0].std_length_cm', 'variants[0].std_width_cm'] },
    });

    const removeImageUrl = (url: string) => {
        const current = form.getFieldValue('image_urls') ?? [];
        form.setFieldValue('image_urls', current.filter(u => u !== url));
    };
    const totalImages = () => (imageUrls()?.length ?? 0) + pendingFiles().length;

    // ── Render ────────────────────────────────────────────────────────
    return (
        <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
            <form
                id={props.mode.formId}
                onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); setHasAttemptedSubmit(true); form.handleSubmit(); }}
                class="flex flex-col gap-4"
            >
                {/* ═══ Active Toggle (edit only) ═══ */}
                <Show when={isEdit()}>
                    <div class="flex items-center justify-end">
                        <form.Field name="is_active">
                            {(field) => {
                                const f = field();
                                return (
                                    <div class="flex items-center gap-2 px-3 py-1.5 bg-surface/30 rounded-lg border border-border/40">
                                        <Switch field={f}>
                                            <span class="text-xs font-medium">{props.mode.label} Activo</span>
                                        </Switch>
                                    </div>
                                );
                            }}
                        </form.Field>
                    </div>
                </Show>

                <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px] gap-4">

                    {/* ══════ LEFT: Tabs ══════ */}
                    <div class="min-w-0 order-2 lg:order-1">
                        {/* ── Determine if we need tabs ── */}
                        {(() => {
                            const hasTabs = props.mode.features.salesTab || props.mode.features.purchaseTab || props.mode.features.inventoryTab;

                            // ── General content (shared between tabbed and non-tabbed) ──
                            const generalContent = (
                                <div class="flex flex-col gap-4 sm:gap-5 pt-4">
                                    <ClassificationSection
                                        form={form}
                                        mode={props.mode}
                                        hasAttemptedSubmit={hasAttemptedSubmit}
                                    />

                                    <Show when={categoryId() > 0}>
                                        <DynamicAttributeFields
                                            attributes={categoryAttributes}
                                            nameTemplate={nameTemplate}
                                            values={() => (sharedAttributes() ?? {}) as Record<string, unknown>}
                                            onChange={(attrs) => untrack(() => form.setFieldValue('shared_attributes', attrs))}
                                            onNameGenerated={(generated) => {
                                                if (!manualNameOverride()) {
                                                    untrack(() => {
                                                        if (form.getFieldValue('name') !== generated) {
                                                            form.setFieldValue('name', generated);
                                                        }
                                                    });
                                                }
                                            }}
                                            categoryId={categoryId}
                                        />
                                    </Show>

                                    <IdentificationSection
                                        form={form}
                                        hasTemplate={hasTemplate}
                                        manualNameOverride={manualNameOverride}
                                        setManualNameOverride={setManualNameOverride}
                                    />

                                    <VariantsSection form={form} hasAttemptedSubmit={hasAttemptedSubmit} categoryAttributes={categoryAttributes} />

                                    <Show when={productSubtype() === 'COMPUESTO' || productSubtype() === 'FABRICADO'}>
                                        <BomSection form={form} currentProductId={props.product?.id} />
                                    </Show>


                                </div>
                            );

                            if (!hasTabs) {
                                // No tabs mode (unlikely but safe)
                                return generalContent;
                            }

                            return (
                                <Tabs defaultValue="general">
                                    <div class="sticky top-0 z-20 max-w-full bg-card pt-4 pb-2">
                                        <TabsList>
                                            <TabsTrigger value="general" hasError={tabErrors().general}><InfoIcon />General</TabsTrigger>
                                            <Show when={props.mode.features.salesTab}>
                                                <TabsTrigger value="ventas" hasError={tabErrors().ventas}>Ventas</TabsTrigger>
                                            </Show>
                                            <Show when={props.mode.features.purchaseTab}>
                                                <TabsTrigger value="compras" hasError={tabErrors().compras}>Compras</TabsTrigger>
                                            </Show>
                                            <Show when={props.mode.features.inventoryTab}>
                                                <TabsTrigger value="inventario" hasError={tabErrors().inventario}>Inventario</TabsTrigger>
                                            </Show>
                                        </TabsList>
                                    </div>

                                    {/* Tab: General */}
                                    <TabsContent value="general" forceMount class="hidden data-selected:block">
                                        {generalContent}
                                    </TabsContent>

                                    {/* Tab: Ventas */}
                                    <Show when={props.mode.features.salesTab}>
                                        <TabsContent value="ventas">
                                            <div class="flex flex-col gap-4 sm:gap-5 pt-4">
                                                <SalesSection form={form} hasAttemptedSubmit={hasAttemptedSubmit} additionalVariants={additionalVariants} />
                                            </div>
                                        </TabsContent>
                                    </Show>

                                    {/* Tab: Compras */}
                                    <Show when={props.mode.features.purchaseTab}>
                                        <TabsContent value="compras">
                                            <div class="flex flex-col gap-4 sm:gap-5 pt-4">
                                                <PurchaseSection form={form} hasAttemptedSubmit={hasAttemptedSubmit} additionalVariants={additionalVariants} />
                                            </div>
                                        </TabsContent>
                                    </Show>

                                    {/* Tab: Inventario */}
                                    <Show when={props.mode.features.inventoryTab}>
                                        <TabsContent value="inventario">
                                            <div class="flex flex-col gap-4 sm:gap-5 pt-4">
                                                <InventorySection form={form} hasAttemptedSubmit={hasAttemptedSubmit} />
                                            </div>
                                        </TabsContent>
                                    </Show>
                                </Tabs>
                            );
                        })()}
                    </div>

                    {/* ══════ RIGHT: Images + Attributes (sticky sidebar) ══════ */}
                    <div class="order-1 lg:order-2 lg:sticky lg:top-0 lg:self-start flex flex-col gap-4">
                        {/* Images */}
                        <div class="bg-surface/30 rounded-2xl border border-border/40 p-4 flex flex-col gap-3">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <div class="w-1 h-4 rounded-full bg-info" />
                                    <span class="text-xs font-semibold uppercase tracking-wider text-muted">Imágenes</span>
                                </div>
                                <span class="text-[10px] text-muted tabular-nums">{totalImages()}/6</span>
                            </div>
                            <FileUploadDropzone
                                accept={['image/jpeg', 'image/png', 'image/webp', 'image/avif']}
                                maxFiles={6}
                                maxFileSize={5 * 1024 * 1024}
                                crop={true}
                                cropShape="rectangle"
                                cropAspectRatio={1}
                                onFilesChange={(files) => setPendingFiles(prev => [...prev, ...files])}
                                existingUrls={imageUrls() ?? []}
                                onRemoveUrl={removeImageUrl}
                                showPreview={true}
                            />
                            <Show when={pendingFiles().length > 0}>
                                <div class="flex items-center gap-1.5 px-2.5 py-1.5 bg-info/10 border border-info/20 rounded-lg">
                                    <UploadIcon class="size-3.5 text-info shrink-0" />
                                    <span class="text-[11px] text-info font-medium">
                                        {pendingFiles().length} pendiente{pendingFiles().length > 1 ? 's' : ''} de subir
                                    </span>
                                </div>
                            </Show>
                        </div>

                        {/* Name Template Preview */}
                        <NameTemplatePreview
                            attributes={categoryAttributes}
                            values={() => (sharedAttributes() ?? {}) as Record<string, unknown>}
                            nameTemplate={nameTemplate}
                        />
                    </div>
                </div>
            </form>
        </FormSubmissionContext.Provider>
    );
};
