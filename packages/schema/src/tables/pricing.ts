import { text, integer, boolean, timestamp, numeric, index, unique, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pgTableV2, TZ, tenantPolicy } from '../utils';
import { companies } from './config';
import { products, productVariants } from './products';

export const priceLists = pgTableV2("price_lists", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    name: text("name").notNull(),
    currency: text("currency").default('USD').notNull(),
    valid_from: timestamp("valid_from", TZ),
    valid_to: timestamp("valid_to", TZ),
    is_active: boolean("is_active").default(true),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    unique("unq_price_list_name_company").on(t.company_id, t.name),
    unique("unq_price_list_id_company").on(t.id, t.company_id),
    index("idx_price_lists_company").on(t.company_id),
    tenantPolicy(),
]).enableRLS();

export const priceListItems = pgTableV2("price_list_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    price_list_id: integer("price_list_id").references(() => priceLists.id, { onDelete: 'cascade' }).notNull(),
    
    // Can apply to a specific variant, or to all variants of a product
    product_id: integer("product_id").references(() => products.id, { onDelete: 'cascade' }),
    variant_id: integer("variant_id").references(() => productVariants.id, { onDelete: 'cascade' }),
    
    price: numeric("price", { precision: 12, scale: 4 }).notNull(),
    min_quantity: numeric("min_quantity", { precision: 12, scale: 4 }).default('1').notNull(),
    
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_price_list_items_list").on(t.price_list_id),
    index("idx_price_list_items_product").on(t.product_id),
    index("idx_price_list_items_variant").on(t.variant_id),
    check("chk_price_list_target", sql`num_nonnulls(product_id, variant_id) = 1`),
]);
