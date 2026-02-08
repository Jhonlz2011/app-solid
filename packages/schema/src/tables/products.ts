import { text, integer, boolean, timestamp, numeric, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pgTableV2 } from '../utils';
import { productTypeEnum, productSubtypeEnum } from '../enums';
import { categories, brands, uom } from './config';
import { authUsers } from './auth';

// --- 3. PRODUCTS ---
export const products = pgTableV2("products", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),

    // RESTRUCTURED: Main type (PRODUCTO or SERVICIO)
    product_type: productTypeEnum("product_type").notNull(),

    // RESTRUCTURED: Subtype (only for PRODUCTO: SIMPLE, COMPUESTO, FABRICADO)
    // NULL for SERVICIO
    product_subtype: productSubtypeEnum("product_subtype"),

    // Category handles: MATERIALES, HERRAMIENTAS, EPP, etc.
    // Subcategories: TALADROS -> ELECTRICO/BATERIA
    category_id: integer("category_id").references(() => categories.id),
    brand_id: integer("brand_id").references(() => brands.id),

    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),

    specs: jsonb("specs").default({}),
    description: text("description"),

    // Imagenes optimizadas
    image_urls: text("image_urls").array().default(sql`ARRAY[]::text[]`),

    uom_inventory_code: text("uom_inventory_code").references(() => uom.code),
    uom_consumption_code: text("uom_consumption_code").references(() => uom.code),

    // Only for PRODUCTO type
    track_dimensional: boolean("track_dimensional").default(false),

    min_stock_alert: numeric("min_stock_alert", { precision: 12, scale: 4 }).default('0'),
    last_cost: numeric("last_cost", { precision: 12, scale: 4 }).default('0'),
    base_price: numeric("base_price", { precision: 12, scale: 4 }).default('0'),

    // Conversión de Unidades (ej. Clavos en Gramos -> Unidades)
    secondary_uom_code: text("secondary_uom_code").references(() => uom.code),
    conversion_factor_secondary: numeric("conversion_factor_secondary", { precision: 12, scale: 4 }).default('1'),
    iva_rate_code: integer("iva_rate_code").default(4).notNull(), // Código SRI (0, 2, 4)

    is_active: boolean("is_active").default(true),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_by: integer("updated_by").references(() => authUsers.id),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
    index("idx_products_sku").on(t.sku),
    index("idx_products_specs").using("gin", t.specs),
    index("idx_products_active").on(t.is_active),
    // Optimization: FK indexes for common queries
    index("idx_products_category").on(t.category_id),
    index("idx_products_brand").on(t.brand_id),
    // NEW: Indexes for product type/subtype
    index("idx_products_type").on(t.product_type),
    index("idx_products_subtype").on(t.product_subtype),
    // Composite for filtering by category + active
    index("idx_products_cat_active").on(t.category_id, t.is_active),
    // Composite for type + subtype queries
    index("idx_products_type_subtype").on(t.product_type, t.product_subtype),
]);

export const productDimensions = pgTableV2("product_dimensions", {
    product_id: integer("product_id").primaryKey().references(() => products.id),
    width: numeric("width", { precision: 10, scale: 4 }).default('0'),
    length: numeric("length", { precision: 10, scale: 4 }).default('0'),
    thickness: numeric("thickness", { precision: 10, scale: 4 }).default('0'),
    area: numeric("area", { precision: 12, scale: 4 }), // Calculado
});

// NEW: Product Variants (e.g., Tube 3m vs Tube 6m)
export const productVariants = pgTableV2("product_variants", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    product_id: integer("product_id").references(() => products.id, { onDelete: 'cascade' }).notNull(),
    variant_name: text("variant_name").notNull(), // "Tubo 3m", "Tubo 6m"
    sku_suffix: text("sku_suffix"), // "-3M", "-6M"
    // Dimensions for this variant
    length: numeric("length", { precision: 10, scale: 4 }),
    width: numeric("width", { precision: 10, scale: 4 }),
    thickness: numeric("thickness", { precision: 10, scale: 4 }),
    area: numeric("area", { precision: 12, scale: 4 }),

    // Conversion factor (e.g., 3m = 3.0, 6m = 6.0)
    uom_conversion_factor: numeric("uom_conversion_factor", { precision: 12, scale: 4 }).notNull(),

    is_default: boolean("is_default").default(false),
    is_active: boolean("is_active").default(true),
}, (t) => [
    index("idx_variants_product").on(t.product_id),
]);

// NEW: Product Components (for divisible products like "Bloque de Cierre Central" = 3 parts)
export const productComponents = pgTableV2("product_components", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    parent_product_id: integer("parent_product_id").references(() => products.id, { onDelete: 'cascade' }).notNull(),
    component_product_id: integer("component_product_id").references(() => products.id).notNull(),
    quantity_per_parent: numeric("quantity_per_parent", { precision: 6, scale: 2 }).notNull(), // 3 parts
    is_reversible: boolean("is_reversible").default(true), // Can be reconstituted
    notes: text("notes"),
}, (t) => [
    unique("unq_prod_component").on(t.parent_product_id, t.component_product_id),
]);

// NEW: Product-specific UOM Conversions (e.g., Nails: 1 UND = 50 GRAMOS)
export const productUomConversions = pgTableV2("product_uom_conversions", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    product_id: integer("product_id").references(() => products.id, { onDelete: 'cascade' }).notNull(),

    from_uom: text("from_uom").references(() => uom.code).notNull(),
    to_uom: text("to_uom").references(() => uom.code).notNull(),
    conversion_factor: numeric("conversion_factor", { precision: 15, scale: 8 }).notNull(),

    is_exact: boolean("is_exact").default(true), // False if approximate (e.g., nails)
    notes: text("notes"),
}, (t) => [
    unique("unq_prod_uom_conv").on(t.product_id, t.from_uom, t.to_uom),
]);
