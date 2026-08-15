import { pipe, string, minLength, minValue, object, picklist, boolean, array, number, optional, nullable, record, unknown, type InferInput } from 'valibot';
import { PRODUCT_TYPES, PRODUCT_SUBTYPES } from '../enums';
import type { ProductPayload } from '../dto/products.dto';

// --- PRODUCT FORM SCHEMAS (Valibot) ---

export const ProductVariantFormSchema = object({
    id: optional(nullable(number())),
    sku: pipe(string(), minLength(1, 'SKU es requerido')),
    variant_name: optional(nullable(string())),
    variant_attributes: optional(record(string(), unknown())),
    content_quantity: number('Cantidad de contenido requerida'),
    sale_uom_id: optional(nullable(number())),
    base_price: optional(nullable(number())),
    last_cost: optional(nullable(number())),
    barcode: optional(nullable(string())),
    image_urls: optional(nullable(array(string()))),
    std_length_cm: optional(nullable(number())),
    std_width_cm: optional(nullable(number())),
    is_default: boolean(),
    is_active: boolean(),
    sort_order: optional(number()),
});

export const ProductComponentFormSchema = object({
    id: optional(nullable(number())),
    component_product_id: number('Producto componente es requerido'),
    quantity_per_parent: number('Cantidad es requerida'),
    is_reversible: optional(boolean()),
    notes: optional(nullable(string())),
});

export const ProductFormSchema = object({
    product_type: picklist(PRODUCT_TYPES, 'Tipo de producto requerido'),
    product_subtype: optional(nullable(picklist(PRODUCT_SUBTYPES))),
    category_id: pipe(number('Categoría es requerida'), minValue(1, 'Selecciona una categoría')),
    brand_id: optional(nullable(number())),
    slug: string(),
    name: pipe(string(), minLength(1, 'Nombre es requerido')),
    description: optional(nullable(string())),
    shared_attributes: optional(record(string(), unknown())),
    image_urls: optional(array(string())),
    uom_inventory_id: number('UOM de inventario es requerida'),
    has_dimensional_tracking: boolean(),
    min_stock_alert: optional(nullable(number())),
    default_base_price: number('Precio base requerido'),
    iva_rate_code: number(),
    is_active: boolean(),
    variants: array(ProductVariantFormSchema),
    components: optional(array(ProductComponentFormSchema)),
});

export type ProductFormData = InferInput<typeof ProductFormSchema>;
export type ProductVariantFormData = InferInput<typeof ProductVariantFormSchema>;
export type ProductComponentFormData = InferInput<typeof ProductComponentFormSchema>;

// Compile-Time Assertion: Ensures Valibot schema matches exactly the E2E contract interface
type AssertProductValibot<T extends ProductPayload> = T;
const _checkProductFormData: AssertProductValibot<ProductFormData> = {} as any as ProductFormData;
void _checkProductFormData;
