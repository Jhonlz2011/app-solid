/**
 * CatalogForm — Continuous scroll layout with sticky ScrollSpyNav.
 * 2-column layout: Form sections LEFT in continuous scroll, Images+Attributes RIGHT.
 * Mode-aware version of ProductForm for both Products and Services.
 */
import { Component, Show, createSignal, createMemo, onCleanup, untrack } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { ProductFormSchema } from '@app/schema/frontend';
import type { ProductFormData, ProductVariantFormData } from '@app/schema/frontend';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { handleFormApiErrors } from '@shared/utils/form.utils';

// Shared UI & Icons
import Switch from '@/shared/ui/form/Switch';
import { FileUploadDropzone } from '@/shared/ui/overlay/FileUpload';
import { ScrollSpyNav, type ScrollSpyTab } from '@/shared/ui/form/ScrollSpyNav';
import { UploadIcon } from '@icons/UploadIcon';
import { InfoIcon } from '@icons/InfoIcon';
import { TagIcon } from '@icons/TagIcon';
import { WarehouseIcon } from '@icons/WarehouseIcon';
import { TruckIcon } from '@icons/TruckIcon';
import { LayersIcon } from '@icons/LayersIcon';
import { BoxIcon } from '@icons/BoxIcon';

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
    formId?: string;
}

const defaultVariant = (): ProductVariantFormData => ({
    id: null,
    sku: '',
    variant_name: null,
    variant_attributes: {},
    content_quantity: 1,
    sale_uom_id: null,
    unit_price: null,
    last_cost: null,
    barcode: null,
    barcode_type: 'CUSTOM',
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
            title: product.title ?? (product as any).name ?? '',
            handle: product.handle ?? (product as any).slug ?? '',
            description: product.description ?? null,
            attributes: ((product.attributes ?? (product as any).shared_attributes) as Record<string, unknown>) ?? {},
            options: (product.options ?? []) as Array<{ id: string; name: string; values: string[] }>,
            has_variants: product.has_variants ?? (variants.length > 1),

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
            default_unit_price: Number(product.default_unit_price ?? (product as any).default_base_price) || 0,
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
                    unit_price: v.unit_price != null ? Number(v.unit_price) : (v as any).base_price != null ? Number((v as any).base_price) : null,
                    last_cost: v.last_cost != null ? Number(v.last_cost) : null,
                    barcode: v.barcode ?? null,
                    barcode_type: (v.barcode_type as any) ?? 'CUSTOM',
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
        category_id: 0,
        brand_id: null,
        title: '',
        handle: '',
        description: null,
        attributes: {},
        options: [],
        has_variants: false,
        image_urls: [],
        components: [],
        uom_inventory_id: 0,
        has_dimensional_tracking: false,
        min_stock_alert: null,
        default_unit_price: 0,
        iva_rate_code: 4,
        is_active: true,
        variants: [defaultVariant()],
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

            // Auto-generate SKU for default variant if empty
            if (!formValue.variants[0]?.sku || formValue.variants[0].sku.trim() === '') {
                const genSku = await productsApi.generateSku(formValue.category_id || undefined, formValue.brand_id || undefined);
                formValue.variants[0].sku = genSku;
            }

            // Auto-generate handle if empty
            let handle = formValue.handle;
            if (!handle || handle.trim() === '') {
                handle = formValue.title
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '');
            }

            if (!formValue.has_dimensional_tracking) {
                formValue.variants = formValue.variants.map(v => ({ ...v, content_quantity: 1, std_length_cm: null, std_width_cm: null }));
            }

            const existingUrls = form.getFieldValue('image_urls') ?? [];
            const payload: ProductFormData = {
                ...formValue,
                handle,
                image_urls: existingUrls,
                attributes: (form.getFieldValue('attributes') as Record<string, unknown>) ?? {},
                options: (form.getFieldValue('options') as any) ?? [],
                has_variants: formValue.variants.length > 1,
                variants: formValue.variants.map((v, i) => ({
                    ...v,
                    is_default: i === 0 ? true : v.is_default,
                    barcode_type: v.barcode_type ?? 'CUSTOM',
                })),
            };

            try { await props.onSubmit(payload); }
            catch (err) {
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
    const attributesJson = form.useStore((s) => JSON.stringify(s.values.attributes ?? {}));
    const attributes = createMemo(() => JSON.parse(attributesJson()) as Record<string, unknown>);
    const variants = form.useStore((s) => s.values.variants);

    // Centralized category schema query
    const categorySchemaQuery = useCategoryFormSchema(() => categoryId() > 0 ? categoryId() : null);

    const categoryAttributes = createMemo(() => categorySchemaQuery.data?.attributes ?? []);
    const nameTemplate = createMemo(() => categorySchemaQuery.data?.category?.nameTemplate ?? null);
    const hasTemplate = createMemo(() => !!nameTemplate());

    // Pre-computed additional variants
    const additionalVariants = createMemo(() => (variants() as ProductVariantFormData[]).slice(1));

    // Multi-tab error indicators
    const tabErrors = useTabErrors(form, hasAttemptedSubmit, {
        general: { prefixes: ['title', 'category_id', 'variants[0].sku'], isDefault: true },
        ventas: { prefixes: ['default_unit_price', 'iva_rate_code', 'variants[0].sale_uom_id'] },
        compras: { prefixes: ['variants[0].last_cost'] },
        inventario: { prefixes: ['uom_inventory_id', 'min_stock_alert', 'has_dimensional_tracking', 'variants[0].content_quantity', 'variants[0].std_length_cm', 'variants[0].std_width_cm'] },
        variantes: { prefixes: ['variants'] },
        bom: { prefixes: ['components'] },
    });

    const navigationTabs = createMemo<ScrollSpyTab[]>(() => {
        const errs = tabErrors();
        const tabs: ScrollSpyTab[] = [
            { id: 'section-general', label: 'General', icon: InfoIcon, hasError: errs.general },
        ];
        if (props.mode.features.salesTab) {
            tabs.push({ id: 'section-sales', label: 'Ventas', icon: TagIcon, hasError: errs.ventas });
        }
        if (props.mode.features.inventoryTab) {
            tabs.push({ id: 'section-inventory', label: 'Inventario', icon: WarehouseIcon, hasError: errs.inventario });
        }
        if (props.mode.features.purchaseTab) {
            tabs.push({ id: 'section-purchase', label: 'Compras', icon: TruckIcon, hasError: errs.compras });
        }
        if (additionalVariants().length > 0) {
            tabs.push({
                id: 'section-variants',
                label: 'Variantes',
                icon: LayersIcon,
                badge: additionalVariants().length + 1,
                hasError: errs.variantes,
            });
        }
        if (productSubtype() === 'COMPUESTO' || productSubtype() === 'FABRICADO') {
            tabs.push({
                id: 'section-bom',
                label: 'Composición (BOM)',
                icon: BoxIcon,
                hasError: errs.bom,
            });
        }
        return tabs;
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

                {/* ═══ Continuous ScrollSpy Navigation Bar ═══ */}
                <ScrollSpyNav tabs={navigationTabs()} class="rounded-xl border border-border/50" />

                <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px] gap-6">

                    {/* ══════ LEFT: Continuous Scroll Sections ══════ */}
                    <div class="min-w-0 order-2 lg:order-1 flex flex-col gap-8">
                        {/* 1. General Section */}
                        <section id="section-general" class="scroll-mt-24 flex flex-col gap-5">
                            <ClassificationSection
                                form={form}
                                mode={props.mode}
                                hasAttemptedSubmit={hasAttemptedSubmit}
                            />

                            <Show when={categoryId() > 0}>
                                <DynamicAttributeFields
                                    attributes={categoryAttributes}
                                    nameTemplate={nameTemplate}
                                    values={() => (attributes() ?? {}) as Record<string, unknown>}
                                    onChange={(attrs) => untrack(() => form.setFieldValue('attributes', attrs))}
                                    onNameGenerated={(generated) => {
                                        if (!manualNameOverride()) {
                                            untrack(() => {
                                                if (form.getFieldValue('title') !== generated) {
                                                    form.setFieldValue('title', generated);
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
                        </section>

                        {/* 2. Sales Section */}
                        <Show when={props.mode.features.salesTab}>
                            <section id="section-sales" class="scroll-mt-24">
                                <SalesSection
                                    form={form}
                                    hasAttemptedSubmit={hasAttemptedSubmit}
                                    additionalVariants={additionalVariants}
                                />
                            </section>
                        </Show>

                        {/* 3. Inventory Section */}
                        <Show when={props.mode.features.inventoryTab}>
                            <section id="section-inventory" class="scroll-mt-24">
                                <InventorySection
                                    form={form}
                                    hasAttemptedSubmit={hasAttemptedSubmit}
                                />
                            </section>
                        </Show>

                        {/* 4. Purchase Section */}
                        <Show when={props.mode.features.purchaseTab}>
                            <section id="section-purchase" class="scroll-mt-24">
                                <PurchaseSection
                                    form={form}
                                    hasAttemptedSubmit={hasAttemptedSubmit}
                                    additionalVariants={additionalVariants}
                                />
                            </section>
                        </Show>

                        {/* 5. Variants Section */}
                        <section id="section-variants" class="scroll-mt-24">
                            <VariantsSection
                                form={form}
                                hasAttemptedSubmit={hasAttemptedSubmit}
                                categoryAttributes={categoryAttributes}
                            />
                        </section>

                        {/* 6. BOM Section (Conditional on COMPUESTO or FABRICADO) */}
                        <Show when={productSubtype() === 'COMPUESTO' || productSubtype() === 'FABRICADO'}>
                            <section id="section-bom" class="scroll-mt-24">
                                <BomSection form={form} currentProductId={props.product?.id} />
                            </section>
                        </Show>
                    </div>

                    {/* ══════ RIGHT: Images + Attributes (sticky sidebar) ══════ */}
                    <div class="order-1 lg:order-2 lg:sticky lg:top-16 lg:self-start flex flex-col gap-4">
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
                            values={() => (attributes() ?? {}) as Record<string, unknown>}
                            nameTemplate={nameTemplate}
                        />
                    </div>
                </div>
            </form>
        </FormSubmissionContext.Provider>
    );
};

export default CatalogForm;
