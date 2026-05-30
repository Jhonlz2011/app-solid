/**
 * ProductForm V8 — 2-column layout: Tabs LEFT, Images+Attributes RIGHT.
 *
 * Layout:
 * ─ is_active toggle (edit only, top-right)
 * ─ [LEFT COLUMN]  Tabs (General, Compras) — scrollable form content
 * ─ [RIGHT COLUMN] Images + CategoryAttributeTags — sticky sidebar, persistent
 * ─ On mobile: stacks with images on top, tabs below
 */
import { Component, Show, createSignal, createEffect, createMemo } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { ProductFormSchema } from '@app/schema/frontend';
import type { ProductFormData, ProductVariantFormData } from '@app/schema/frontend';
import { ApiError } from '@shared/utils/api-errors';
import { FormSubmissionContext } from '@shared/ui/form/form.types';

// Shared UI
import Switch from '@shared/ui/Switch';
import { FileUploadDropzone } from '@shared/ui/FileUpload';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/Tabs';

// Data
import { useCategoryFormSchema } from '@/modules/categories/data/categories.queries';
import { productsApi } from '../data/products.api';
import type { Product } from '../data/products.api';

// Form sections
import ClassificationSection from './sections/ClassificationSection';
import IdentificationSection from './sections/IdentificationSection';
import PricingInventorySection from './sections/PricingInventorySection';
import ExtraSpecsSection from './sections/ExtraSpecsSection';
import VariantsSection from './sections/VariantsSection';
import DynamicAttributeFields from './DynamicAttributeFields';
import CategoryAttributeTags from './CategoryAttributeTags';

// =============================================================================
// Types & Helpers
// =============================================================================

export interface ProductFormProps {
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

function buildDefaultValues(product?: Product): ProductFormData {
    if (product) {
        const p = product as any;
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
            extra_specs: p.extra_specs ?? {},
            image_urls: p.image_urls ?? [],
            uom_inventory_id: p.uom_inventory_id ?? 0,
            has_dimensional_tracking: p.has_dimensional_tracking ?? false,
            min_stock_alert: Number(p.min_stock_alert) || null,
            default_base_price: Number(p.default_base_price) || 0,
            iva_rate_code: p.iva_rate_code ?? 4,
            is_active: p.is_active ?? true,
            variants: variants.length > 0
                ? variants.map((v: any) => ({
                    id: v.id, sku: v.sku, variant_name: v.variant_name ?? null,
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
        product_type: 'PRODUCTO', product_subtype: 'SIMPLE',
        category_id: 0, brand_id: null,
        slug: '', name: '', description: null,
        shared_attributes: {}, extra_specs: {}, image_urls: [],
        uom_inventory_id: 0, has_dimensional_tracking: false,
        min_stock_alert: null, default_base_price: 0, iva_rate_code: 4,
        is_active: true, variants: [defaultVariant()],
    };
}

// =============================================================================
// Main Component
// =============================================================================

export const ProductForm: Component<ProductFormProps> = (props) => {
    const isEdit = () => !!props.product;
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);
    const [manualNameOverride, setManualNameOverride] = createSignal(false);
    const [pendingFiles, setPendingFiles] = createSignal<File[]>([]);
    const [isUploading, setIsUploading] = createSignal(false);

    // ── TanStack Form ─────────────────────────────────────────────────
    const form = createForm(() => ({
        defaultValues: buildDefaultValues(props.product),
        validatorAdapter: valibotValidator(),
        validators: { onChange: ProductFormSchema, onSubmit: ProductFormSchema },
        onSubmit: async ({ value }) => {
            let uploadedUrls: string[] = [];
            if (pendingFiles().length > 0) {
                setIsUploading(true);
                try { uploadedUrls = await productsApi.uploadImages(pendingFiles()); }
                finally { setIsUploading(false); }
            }

            let slug = value.slug;
            if (!slug || slug.trim() === '') {
                slug = await productsApi.generateSku(value.category_id || undefined, value.brand_id || undefined);
            }
            if (!value.variants[0]?.sku || value.variants[0].sku.trim() === '') {
                value.variants[0].sku = slug;
            }
            if (!value.has_dimensional_tracking) {
                value.variants = value.variants.map(v => ({ ...v, content_quantity: 1, std_length_cm: null, std_width_cm: null }));
            }

            const existingUrls = form.getFieldValue('image_urls') ?? [];
            const payload: ProductFormData = {
                ...value, slug,
                image_urls: [...existingUrls, ...uploadedUrls],
                shared_attributes: form.getFieldValue('shared_attributes') ?? {},
                extra_specs: form.getFieldValue('extra_specs') ?? {},
                variants: value.variants.map((v, i) => ({ ...v, is_default: i === 0 ? true : v.is_default })),
            };

            try { await props.onSubmit(payload); }
            catch (err) {
                if (err instanceof ApiError && err.errors?.length) {
                    for (const fe of err.errors) {
                        try { form.setFieldMeta(fe.field as any, (p) => ({ ...p, errorMap: { ...p.errorMap, onSubmit: fe.message } })); }
                        catch { /* field not in form */ }
                    }
                }
            }
        },
    }));

    // ── Reactive selectors ────────────────────────────────────────────
    const categoryId = form.useStore((s) => s.values.category_id);
    const productType = form.useStore((s) => s.values.product_type);
    const imageUrls = form.useStore((s) => s.values.image_urls);
    const sharedAttributes = form.useStore((s) => s.values.shared_attributes);
    const categorySchemaQuery = useCategoryFormSchema(() => categoryId() > 0 ? categoryId() : null);
    const hasTemplate = createMemo(() => !!(categorySchemaQuery.data as any)?.category?.nameTemplate);

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
                id="product-form"
                onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); setHasAttemptedSubmit(true); form.handleSubmit(); }}
                class="flex flex-col gap-4"
            >
                {/* ═══ Active Toggle (edit only) ═══ */}
                <Show when={isEdit()}>
                    <div class="flex items-center justify-end">
                        <form.Field name="is_active">
                            {(field: any) => {
                                const f = field();
                                return (
                                    <div class="flex items-center gap-2 px-3 py-1.5 bg-surface/30 rounded-lg border border-border/40">
                                        <Switch field={f}>
                                            <span class="text-xs font-medium">Producto Activo</span>
                                        </Switch>
                                    </div>
                                );
                            }}
                        </form.Field>
                    </div>
                </Show>

                {/* ═════════════════════════════════════════════════════════
                    2-COLUMN LAYOUT
                    LEFT  → Tabs (General, Compras)
                    RIGHT → Images + Attribute Tags (sticky sidebar)
                    Mobile → images first (order-1), tabs below (order-2)
                ═════════════════════════════════════════════════════════ */}
                <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px] gap-4">

                    {/* ══════ LEFT: Tabs ══════ */}
                    <div class="min-w-0 order-2 lg:order-1">
                        <Tabs defaultValue="general">
                            <TabsList>
                                <TabsTrigger value="general">General</TabsTrigger>
                                <TabsTrigger value="compras">Compras</TabsTrigger>
                            </TabsList>

                            {/* Tab: General */}
                            <TabsContent value="general" forceMount class="hidden data-[selected]:block">
                                <div class="flex flex-col gap-4 sm:gap-5 pt-4">
                                    <ClassificationSection
                                        form={form}
                                        productType={productType}
                                        hasAttemptedSubmit={hasAttemptedSubmit}
                                    />

                                    <Show when={categoryId() > 0}>
                                        <DynamicAttributeFields
                                            categoryId={() => categoryId() || null}
                                            values={(form.getFieldValue('shared_attributes') ?? {}) as Record<string, unknown>}
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

                                    <VariantsSection form={form} hasAttemptedSubmit={hasAttemptedSubmit} />
                                    <ExtraSpecsSection form={form} />
                                </div>
                            </TabsContent>

                            {/* Tab: Compras */}
                            <TabsContent value="compras" forceMount class="hidden data-[selected]:block">
                                <div class="flex flex-col gap-4 sm:gap-5 pt-4">
                                    <PricingInventorySection form={form} hasAttemptedSubmit={hasAttemptedSubmit} />
                                </div>
                            </TabsContent>
                        </Tabs>
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
                                onFilesChange={(files) => setPendingFiles(prev => [...prev, ...files])}
                                existingUrls={imageUrls() ?? []}
                                onRemoveUrl={removeImageUrl}
                                showPreview={true}
                            />
                            <Show when={pendingFiles().length > 0}>
                                <div class="flex items-center gap-1.5 px-2.5 py-1.5 bg-info/10 border border-info/20 rounded-lg">
                                    <span class="text-[11px] text-info font-medium">
                                        📎 {pendingFiles().length} pendiente{pendingFiles().length > 1 ? 's' : ''} de subir
                                    </span>
                                </div>
                            </Show>
                        </div>

                        {/* Category Attribute Tags */}
                        <Show
                            when={categoryId() > 0}
                            fallback={
                                <div class="bg-surface/30 rounded-2xl border border-dashed border-border/40 p-5 flex flex-col items-center justify-center text-center min-h-[100px]">
                                    <div class="text-xl mb-1.5 opacity-30">🏷️</div>
                                    <p class="text-xs font-medium text-muted">Selecciona una categoría</p>
                                    <p class="text-[10px] text-muted/60 mt-0.5">Los atributos aparecerán aquí</p>
                                </div>
                            }
                        >
                            <CategoryAttributeTags
                                categoryId={() => categoryId() || null}
                                values={(sharedAttributes() ?? {}) as Record<string, unknown>}
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

export default ProductForm;
