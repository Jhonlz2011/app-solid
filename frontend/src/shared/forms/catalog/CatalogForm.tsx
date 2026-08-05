/**
 * CatalogForm — 2-column layout: Tabs LEFT, Images+Attributes RIGHT.
 * Mode-aware version of ProductForm for both Products and Services.
 */
import { Component, Show, createSignal, createEffect, createMemo, onCleanup } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { ProductFormSchema } from '@app/schema/frontend';
import type { ProductFormData, ProductVariantFormData } from '@app/schema/frontend';
import { ApiError } from '@shared/utils/api-errors';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import type { ProductComponentFormData } from '@app/schema/frontend';

// Shared UI
import Switch from '@shared/ui/Switch';
import { FileUploadDropzone } from '@shared/ui/FileUpload';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/Tabs';
import { TagIcon, UploadIcon } from '@shared/ui/icons';

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
import CategoryAttributeTags from '@/modules/products/components/CategoryAttributeTags';

import type { CatalogModeConfig } from './catalog-form.utils';

export interface CatalogFormProps {
    mode: CatalogModeConfig;
    product?: Product;
    onSubmit: (data: ProductFormData) => Promise<void>;
    isSubmitting: boolean;
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
        // Cast to our payload interface + potential relations
        const p = product as unknown as Partial<ProductFormData> & { product_components?: ProductComponentFormData[], id?: number };
        const variants = p.variants ?? [];
        return {
            product_type: p.product_type,
            product_subtype: p.product_subtype ?? null,
            category_id: p.category_id,
            brand_id: p.brand_id ?? null,
            slug: p.slug,
            name: p.name,
            description: p.description ?? null,
            shared_attributes: p.shared_attributes ?? {},

            image_urls: p.image_urls ?? [],
            components: (p.components ?? p.product_components ?? []).map((c) => ({
                id: c.id ?? null,
                component_product_id: c.component_product_id,
                quantity_per_parent: Number(c.quantity_per_parent),
                is_reversible: c.is_reversible ?? true,
                notes: c.notes ?? null,
            })),
            uom_inventory_id: p.uom_inventory_id ?? 0,

            has_dimensional_tracking: p.has_dimensional_tracking ?? false,
            min_stock_alert: Number(p.min_stock_alert) || null,
            default_base_price: Number(p.default_base_price) || 0,
            iva_rate_code: p.iva_rate_code ?? 4,
            is_active: p.is_active ?? true,
            variants: variants.length > 0
                ? variants.map((v) => ({
                    id: v.id ?? null, sku: v.sku ?? '', variant_name: v.variant_name ?? null,
                    variant_attributes: v.variant_attributes ?? {},
                    content_quantity: Number(v.content_quantity) || 1,
                    sale_uom_id: v.sale_uom_id ?? null,
                    base_price: v.base_price ? Number(v.base_price) : null,
                    last_cost: v.last_cost ? Number(v.last_cost) : null,
                    barcode: v.barcode ?? null, image_urls: v.image_urls ?? null,
                    std_length_cm: v.std_length_cm ? Number(v.std_length_cm) : null,
                    std_width_cm: v.std_width_cm ? Number(v.std_width_cm) : null,
                    is_default: v.is_default, is_active: v.is_active,
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
                try { URL.revokeObjectURL(fileWithPreview._previewUrl); } catch {}
            }
        });
    });

    // ── TanStack Form ─────────────────────────────────────────────────
    const form = createForm(() => ({
        defaultValues: buildDefaultValues(props.mode, props.product),
        validatorAdapter: valibotValidator(),
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
                    ).catch(() => {/* silent */});
                }
                if (err instanceof ApiError && err.errors?.length) {
                    for (const fe of err.errors) {
                        try {
                            // @ts-expect-error - Dynamic field strings from backend cannot be statically typed
                            form.setFieldMeta(fe.field, (p) => ({ ...p, errorMap: { ...p.errorMap, onSubmit: fe.message } }));
                        }
                        catch { /* field not in form */ }
                    }
                }
            }
        },
    }));

    // ── Reactive selectors ────────────────────────────────────────────────────
    const categoryId = form.useStore((s) => s.values.category_id);
    const productSubtype = form.useStore((s) => s.values.product_subtype);
    const imageUrls = form.useStore((s) => s.values.image_urls);
    const sharedAttributes = form.useStore((s) => s.values.shared_attributes);
    const variants = form.useStore((s) => s.values.variants);

    // Centralized category schema query — single subscription shared via props
    const categorySchemaQuery = useCategoryFormSchema(() => categoryId() > 0 ? categoryId() : null);
    
    // Create a strict type cast for the response data
    type CategorySchemaResponse = { attributes?: unknown[], category?: { nameTemplate?: string, name?: string } };
    const catData = () => (categorySchemaQuery.data as CategorySchemaResponse | undefined);

    const categoryAttributes = createMemo(() => catData()?.attributes ?? []);
    const nameTemplate = createMemo(() => catData()?.category?.nameTemplate ?? null);
    const hasTemplate = createMemo(() => !!nameTemplate());
    const categoryName = createMemo(() => catData()?.category?.name ?? '');

    // Pre-computed additional variants — single computation shared via props
    const additionalVariants = createMemo(() => (variants() as ProductVariantFormData[]).slice(1));

    createEffect(() => { categoryId(); setManualNameOverride(false); });

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
                                        onChange={(attrs) => form.setFieldValue('shared_attributes', attrs)}
                                        onNameGenerated={(generated) => {
                                                if (!manualNameOverride()) form.setFieldValue('name', generated);
                                            }}
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
                                    <TabsList>
                                        <TabsTrigger value="general">General</TabsTrigger>
                                        <Show when={props.mode.features.salesTab}>
                                            <TabsTrigger value="ventas">Ventas</TabsTrigger>
                                        </Show>
                                        <Show when={props.mode.features.purchaseTab}>
                                            <TabsTrigger value="compras">Compras</TabsTrigger>
                                        </Show>
                                        <Show when={props.mode.features.inventoryTab}>
                                            <TabsTrigger value="inventario">Inventario</TabsTrigger>
                                        </Show>
                                    </TabsList>

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

                        {/* Category Attribute Tags */}
                        <Show
                            when={categoryId() > 0}
                            fallback={
                                <div class="bg-surface/30 rounded-2xl border border-dashed border-border/40 p-5 flex flex-col items-center justify-center text-center min-h-[100px]">
                                    <TagIcon class="size-6 text-muted/30 mb-1.5" />
                                    <p class="text-xs font-medium text-muted">Selecciona una categoría</p>
                                    <p class="text-[10px] text-muted/60 mt-0.5">Los atributos aparecerán aquí</p>
                                </div>
                            }
                        >
                            <CategoryAttributeTags
                                attributes={categoryAttributes}
                                categoryName={categoryName}
                                values={() => (sharedAttributes() ?? {}) as Record<string, unknown>}
                                onAddCustom={(key, value) => {
                                    const current = form.getFieldValue('shared_attributes') ?? {};
                                    form.setFieldValue('shared_attributes', { ...current, [key]: value });
                                }}
                            />
                        </Show>
                    </div>
                </div>
            </form>
        </FormSubmissionContext.Provider>
    );
};
