import { text, integer, boolean, numeric, date, index, unique } from 'drizzle-orm/pg-core';
import { pgTableV2 } from '../utils';
import { entities } from './entities';
import { products } from './products';
import { uom } from './config';

// --- SUPPLIERS ---
export const supplierProducts = pgTableV2("supplier_products", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    supplier_id: integer("supplier_id").references(() => entities.id).notNull(),
    product_id: integer("product_id").references(() => products.id).notNull(),
    supplier_sku: text("supplier_sku"),
    supplier_product_name: text("supplier_product_name"),
    purchase_uom: text("purchase_uom").references(() => uom.code),
    conversion_to_inventory_factor: numeric("conversion_to_inventory_factor", { precision: 12, scale: 4 }).default('1'),
    agreed_price: numeric("agreed_price", { precision: 12, scale: 4 }),
    last_purchase_date: date("last_purchase_date"),

    // IMPROVED: Additional useful fields
    lead_time_days: integer("lead_time_days"), // Delivery time in days
    min_order_quantity: numeric("min_order_quantity", { precision: 12, scale: 4 }), // Minimum order
    is_preferred: boolean("is_preferred").default(false), // Preferred supplier for this product
    is_active: boolean("is_active").default(true),
}, (t) => [
    unique("unq_supplier_product").on(t.supplier_id, t.product_id),
    index("idx_supplier_products_product").on(t.product_id),
]);
