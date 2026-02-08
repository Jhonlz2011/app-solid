// Product Form Schemas - Valibot validation for TanStack Form
import { object, optional, array, number, string } from 'valibot';
import { ProductInsert } from '@app/schema/frontend';

// ============================================
// Product Form Schema
// ============================================
// Extend generated schema with UI-specific fields if needed
export const ProductFormSchema = object({
    ...ProductInsert.entries,
    // Add extra fields not in DB table but needed for UI/Logic
    components: optional(array(object({
        componentId: number(),
        quantity: number(),
        wastagePercent: optional(number())
    }))),
    dimensions: optional(object({
        width: optional(number()),
        length: optional(number()),
        thickness: optional(number())
    })),
    imageUrls: optional(array(string()))
});

// ============================================
// Helper to get default form values
// ============================================
export const getDefaultProductFormValues = () => ({
    sku: '',
    name: '',
    description: '',
    product_type: 'PRODUCTO', // Matches DB enum
    product_subtype: 'SIMPLE', // Matches DB enum
    category_id: undefined,
    brand_id: undefined,
    uom_inventory_code: 'UND',
    uom_consumption_code: '',
    track_dimensional: false,
    is_active: true,
    min_stock_alert: 0,
    last_cost: 0,
    base_price: 0,
    iva_rate_code: 4,
    specs: {},
    image_urls: [],
    components: [],
    dimensions: {},
});
