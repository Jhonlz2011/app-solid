import { text, integer, boolean, numeric, date, index, unique } from 'drizzle-orm/pg-core';
import { pgTableV2 } from '../utils';
import { products } from './products';

// --- PRICING ---
// Price Lists (Mayorista, Minorista, VIP, etc.)
export const priceLists = pgTableV2("price_lists", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    name: text("name").notNull(), // "Mayorista", "Minorista", "VIP"
    description: text("description"),
    is_default: boolean("is_default").default(false),
    is_active: boolean("is_active").default(true),
});

// Prices per product and list (supports tiered pricing)
export const productPrices = pgTableV2("product_prices", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    product_id: integer("product_id").references(() => products.id, { onDelete: 'cascade' }).notNull(),
    price_list_id: integer("price_list_id").references(() => priceLists.id, { onDelete: 'cascade' }).notNull(),

    price: numeric("price", { precision: 12, scale: 4 }).notNull(),
    min_quantity: numeric("min_quantity", { precision: 12, scale: 4 }).default('1'), // Tiered pricing

    // Validity period (optional)
    valid_from: date("valid_from"),
    valid_until: date("valid_until"),

    is_active: boolean("is_active").default(true),
}, (t) => [
    unique("unq_product_price").on(t.product_id, t.price_list_id, t.min_quantity),
    index("idx_prices_product").on(t.product_id),
    index("idx_prices_list").on(t.price_list_id),
]);
