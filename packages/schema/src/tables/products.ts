import { text, integer, boolean, timestamp, numeric, jsonb, index, unique, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pgTableV2, TZ } from '../utils';
import { productTypeEnum, productSubtypeEnum, priceChangeTypeEnum, priceChangeSourceEnum } from '../enums';
import { uom, companies } from './config';
import { categories, brands } from './catalogs';
import { authUsers } from './auth';

// =============================================================================
// 3. PRODUCTS — Parent merchandising entity
// =============================================================================

/**
 * The PRODUCT is a merchandising concept — "Cable de Acero", "Pintura Cóndor", "Tornillo BCP".
 * It does NOT have a transactional SKU. The SKU lives in product_variants.
 *
 * shared_attributes holds data common to ALL variants (e.g., material, norma, specs).
 * extra_specs holds unstructured manufacturer notes, links, etc.
 */
export const products = pgTableV2("products", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    // Main type (PRODUCTO or SERVICIO)
    product_type: productTypeEnum("product_type").notNull(),

    // Subtype (only for PRODUCTO: SIMPLE, COMPUESTO, FABRICADO)
    // NULL for SERVICIO
    product_subtype: productSubtypeEnum("product_subtype"),

    // Category handles: MATERIALES, HERRAMIENTAS, EPP, etc.
    // Subcategories: TALADROS -> ELECTRICO/BATERIA
    category_id: integer("category_id").references(() => categories.id).notNull(),
    brand_id: integer("brand_id").references(() => brands.id),
    // Human-readable slug (NOT the transactional SKU — that's on variants)
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    // Attributes SHARED by all variants (replaces EAV for parent-level data)
    // Ej: { "material": "Acero Inoxidable", "norma": "ASTM A36" }
    shared_attributes: jsonb("shared_attributes")
        .$type<Record<string, unknown>>()
        .default(sql`'{}'::jsonb`) // <-- Directo en el motor DB
        .notNull(),
    // ONLY for non-structured data (manufacturer notes, technical links, etc.)
    extra_specs: jsonb("extra_specs").$type<Record<string, unknown>>().default(sql`'{}'::jsonb`),
    description: text("description"),
    // Imagenes optimizadas (inherited by variants unless overridden)
    image_urls: text("image_urls").array().default(sql`ARRAY[]::text[]`),

    uom_inventory_id: integer("uom_inventory_id").references(() => uom.id).notNull(),

    // true = este producto tiene ítems dimensionales individuales
    // (planchas con largo/ancho, rollos de cable con metraje remanente)
    is_stockable: boolean("is_stockable").default(true).notNull(),
    has_dimensional_tracking: boolean("has_dimensional_tracking").default(false),

    min_stock_alert: numeric("min_stock_alert", { precision: 12, scale: 4 }).default('0'),

    // Default price — variants inherit unless they override
    default_base_price: numeric("default_base_price", { precision: 12, scale: 4 }).default('0'),
    iva_rate_code: integer("iva_rate_code").default(4).notNull(), // Código SRI (0, 2, 3, 4, 6, 7)
    is_active: boolean("is_active").default(true),
    created_by: integer("created_by").references(() => authUsers.id),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    updated_by: integer("updated_by").references(() => authUsers.id),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    unique("unq_product_slug_company").on(t.company_id, t.slug),
    index("idx_products_company").on(t.company_id),
    index("idx_products_shared_attrs").using("gin", t.shared_attributes),
    index("idx_products_category").on(t.category_id),
    index("idx_products_brand").on(t.brand_id),
    index("idx_products_cat_active").on(t.category_id, t.is_active),
    check("chk_iva_rate_code", sql`iva_rate_code IN (0, 2, 3, 4, 6, 7)`),
]);

// =============================================================================
// 3.1 PRODUCT VARIANTS — The transactional SKU entity (UNIFIED)
// =============================================================================

/**
 * Each variant is ONE buyable/sellable/stockable item with its own unique SKU.
 * Combines what was previously split between "variants" (attributes) and
 * "presentations" (packaging) into a single flat entity.
 *
 * Examples:
 *   Product "Cable de Acero" →
 *     "1/4 - Rollo 100m"  (SKU: CAB-014-R100,  content: 100, attrs: {diametro: "1/4"})
 *     "1/4 - Metro suelto" (SKU: CAB-014-M,    content: 1,   attrs: {diametro: "1/4"})
 *     "3/8 - Rollo 50m"   (SKU: CAB-038-R50,  content: 50,  attrs: {diametro: "3/8"})
 *
 *   Product "Pintura Cóndor" →
 *     "Blanco - 1L"  (SKU: PIN-CON-BLA-1L,  content: 1,     attrs: {color: "Blanco"})
 *     "Blanco - 3L"  (SKU: PIN-CON-BLA-3L,  content: 3,     attrs: {color: "Blanco"})
 *     "Azul - 1GL"   (SKU: PIN-CON-AZU-1GL, content: 3.785, attrs: {color: "Azul"})
 *
 *   Product "Martillo Stanley" →
 *     (default)       (SKU: MAR-STA-001,    content: 1,     attrs: {})
 */
export const productVariants = pgTableV2("product_variants", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    product_id: integer("product_id")
        .references(() => products.id, { onDelete: 'cascade' }).notNull(),

    // === IDENTIFICATION ===
    // SKU REAL — the unique transactional identifier
    sku: text("sku").notNull().unique(),

    // Display name of this variant (e.g., "1/4 - Rollo 100m", "Blanco - 3L")
    // NULL → inherits products.name
    variant_name: text("variant_name"),

    // === DIFFERENTIATING ATTRIBUTES (JSONB) ===
    // Indexed with GIN for efficient filtering
    // Ej: { "diametro": "1/4", "diametro_num": 0.25 }
    // Ej: { "color": "Rojo", "acabado": "Mate" }
    variant_attributes: jsonb("variant_attributes")
        .$type<Record<string, unknown>>()
        .default(sql`'{}'::jsonb`).notNull(),
    // === PACKAGING / CONTENT ===
    // How much of the product's base UOM this variant contains.
    // Cable Rollo 100m → 100, Pintura 3L → 3, Unidad simple → 1
    content_quantity: numeric("content_quantity", { precision: 12, scale: 4 })
        .default('1').notNull(),

    // Sale UOM (may differ from product's uom_inventory_id)
    // NULL = uses product's base UOM
    sale_uom_id: integer("sale_uom_id").references(() => uom.id),

    // === PRICING ===
    // NULL = inherits products.default_base_price
    base_price: numeric("base_price", { precision: 12, scale: 4 }),
    last_cost: numeric("last_cost", { precision: 12, scale: 4 }).default('0'),
    // === IDENTIFICATION ===
    barcode: text("barcode"),
    // Image override (NULL = inherits from parent product)
    image_urls: text("image_urls").array(),
    // === DIMENSIONAL TRACKING ===
    // Standard dimensions (for has_dimensional_tracking = true)
    // Plancha Acero "122×244" → std_length_cm: 244, std_width_cm: 122
    std_length_cm: numeric("std_length_cm", { precision: 12, scale: 4 }),
    std_width_cm: numeric("std_width_cm", { precision: 12, scale: 4 }),


    // === FLAGS ===
    // Default variant for search results and display
    is_default: boolean("is_default").default(false),
    is_active: boolean("is_active").default(true),

    sort_order: integer("sort_order").default(0),
}, (t) => [
    index("idx_variants_product").on(t.product_id),
    index("idx_variants_barcode").on(t.barcode),
    // GIN index for filtering by variant attributes
    index("idx_variants_attrs").using("gin", t.variant_attributes),
    // NOTE: Partial unique for is_default needs raw migration:
    // CREATE UNIQUE INDEX unq_variant_default ON product_variants (product_id) WHERE is_default = true;
]);

// =============================================================================
// 3.2 PRODUCT COMPONENTS — For composite products (BOM-like)
// =============================================================================

/**
 * Defines structural composition at the PRODUCT level.
 * "Bloque de Cierre Central" = 3 parts.
 * Specific variant resolution happens at manufacturing time via manufacturing_order_inputs.
 */
export const productComponents = pgTableV2("product_components", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    parent_product_id: integer("parent_product_id").references(() => products.id, { onDelete: 'cascade' }).notNull(),
    component_product_id: integer("component_product_id").references(() => products.id).notNull(),
    quantity_per_parent: numeric("quantity_per_parent", { precision: 6, scale: 2 }).notNull(),
    is_reversible: boolean("is_reversible").default(true),
    notes: text("notes"),
}, (t) => [
    unique("unq_prod_component").on(t.parent_product_id, t.component_product_id),
]);

// =============================================================================
// 3.3 PRODUCT UOM CONVERSIONS — Per-product unit conversions
// =============================================================================

/**
 * Stays at product level — UOM conversions apply to all variants of the same product.
 * e.g., Nails: 1 UND = 50 GRAMOS (same for all variants of nails)
 */
export const productUomConversions = pgTableV2("product_uom_conversions", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    product_id: integer("product_id").references(() => products.id, { onDelete: 'cascade' }).notNull(),

    from_uom: integer("from_uom").references(() => uom.id).notNull(),
    to_uom: integer("to_uom").references(() => uom.id).notNull(),
    conversion_factor: numeric("conversion_factor", { precision: 15, scale: 8 }).notNull(),

    is_exact: boolean("is_exact").default(true), // False if approximate (e.g., nails)
    notes: text("notes"),
}, (t) => [
    unique("unq_prod_uom_conv").on(t.product_id, t.from_uom, t.to_uom),
]);

// =============================================================================
// 3.4 VARIANT PRICE HISTORY — Audit trail for price changes
// =============================================================================

/**
 * Tracks every price change on a variant (both cost and sale price).
 * Best practice: Define as Drizzle table + PostgreSQL trigger on product_variants
 * AFTER UPDATE that auto-inserts when last_cost or base_price changes.
 *
 * Trigger (apply via raw migration):
 *   CREATE OR REPLACE FUNCTION fn_log_variant_price_change() RETURNS TRIGGER AS $$
 *   BEGIN
 *     IF OLD.last_cost IS DISTINCT FROM NEW.last_cost THEN
 *       INSERT INTO variant_price_history(variant_id, price_type, old_price, new_price, created_at)
 *       VALUES (NEW.id, 'COST', OLD.last_cost, NEW.last_cost, NOW());
 *     END IF;
 *     IF OLD.base_price IS DISTINCT FROM NEW.base_price THEN
 *       INSERT INTO variant_price_history(variant_id, price_type, old_price, new_price, created_at)
 *       VALUES (NEW.id, 'SALE', OLD.base_price, NEW.base_price, NOW());
 *     END IF;
 *     RETURN NEW;
 *   END;
 *   $$ LANGUAGE plpgsql;
 *
 *   CREATE TRIGGER trg_variant_price_history
 *   AFTER UPDATE ON product_variants
 *   FOR EACH ROW EXECUTE FUNCTION fn_log_variant_price_change();
 */
export const variantPriceHistory = pgTableV2("variant_price_history", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    variant_id: integer("variant_id").references(() => productVariants.id, { onDelete: 'cascade' }).notNull(),
    price_type: priceChangeTypeEnum("price_type").notNull(),   // COST | SALE
    old_price: numeric("old_price", { precision: 12, scale: 4 }),
    new_price: numeric("new_price", { precision: 12, scale: 4 }).notNull(),
    // Optional: what triggered this change
    reference_type: priceChangeSourceEnum("reference_type"),   // PURCHASE_ORDER, GOODS_RECEIPT, MANUAL
    reference_id: integer("reference_id"),
    changed_by: integer("changed_by").references(() => authUsers.id),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_vph_variant").on(t.variant_id),
    index("idx_vph_variant_type").on(t.variant_id, t.price_type, t.created_at),
    index("idx_vph_date").on(t.created_at),
]);
