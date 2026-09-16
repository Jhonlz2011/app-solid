import { text, integer, boolean, timestamp, numeric, jsonb, index, unique, check, foreignKey, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pgTableV2, TZ, tenantPolicy } from '../utils';
import { productTypeEnum, productSubtypeEnum, priceChangeTypeEnum, priceChangeSourceEnum } from '../enums';
import { companies } from './config';
import { uom, categories, brands } from './catalogs';
import { authUsers } from './auth';

// =============================================================================
// 1. PRODUCTS — Entidad Mercantil Padre
// =============================================================================

/**
 * The PRODUCT is a merchandising concept — "Cable de Acero", "Pintura Cóndor", "Tornillo BCP".
 * It does NOT have a transactional SKU. The SKU lives in product_variants.
 *
 * attributes holds technical data common to the product (e.g., material, voltage, specs).
 * options defines variant option axes (e.g. [{ name: "Color", values: ["Rojo", "Azul"] }]).
 */
export const products = pgTableV2("products", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),

    // Main type (PRODUCTO or SERVICIO)
    product_type: productTypeEnum("product_type").notNull(),

    // Subtype (only for PRODUCTO: SIMPLE, COMPUESTO, FABRICADO; NULL for SERVICIO)
    product_subtype: productSubtypeEnum("product_subtype"),

    // Category handles: MATERIALES, HERRAMIENTAS, EPP, etc.
    category_id: integer("category_id").references(() => categories.id).notNull(),
    brand_id: integer("brand_id").references(() => brands.id),

    // Denominación Principal
    title: text("title").notNull(),
    description: text("description"),
    handle: text("handle"), // Slug opcional auto-generado de title

    // Especificaciones Técnicas / Metacampos del Producto
    attributes: jsonb("attributes")
        .$type<Record<string, unknown>>()
        .default(sql`'{}'::jsonb`).notNull(),

    // Definición de Opciones de Variante (Shopify Pattern)
    options: jsonb("options")
        .$type<Array<{ id: string; name: string; values: string[] }>>()
        .default(sql`'[]'::jsonb`).notNull(),

    has_variants: boolean("has_variants").default(false).notNull(),

    // Imagenes optimizadas (inherited by variants unless overridden)
    image_urls: text("image_urls").array().default(sql`ARRAY[]::text[]`),

    uom_inventory_id: integer("uom_inventory_id").references(() => uom.id).notNull(),

    // true = este producto tiene ítems dimensionales individuales
    has_dimensional_tracking: boolean("has_dimensional_tracking").default(false),
    min_stock_alert: numeric("min_stock_alert", { precision: 12, scale: 4 }).default('0'),

    // Comercial & Facturación SRI
    default_unit_price: numeric("default_unit_price", { precision: 12, scale: 4 }).default('0').notNull(),
    iva_rate_code: integer("iva_rate_code").default(4).notNull(), // Código SRI (0, 2, 3, 4, 6, 7)

    is_active: boolean("is_active").default(true),
    created_by: uuid("created_by").references(() => authUsers.id),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    updated_by: uuid("updated_by").references(() => authUsers.id),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    unique("unq_product_id_company").on(t.id, t.company_id),
    index("idx_products_company").on(t.company_id),
    index("idx_products_company_cat_active").on(t.company_id, t.category_id, t.is_active),
    index("idx_products_company_brand").on(t.company_id, t.brand_id),
    index("idx_products_attributes").using("gin", t.attributes),
    check("chk_iva_rate_code", sql`iva_rate_code IN (0, 2, 3, 4, 6, 7)`),
    tenantPolicy(),
]).enableRLS();

// =============================================================================
// 2. PRODUCT VARIANTS — SKU Transaccional Unificado
// =============================================================================

/**
 * Each variant is ONE buyable/sellable/stockable item with its own unique SKU.
 */
export const productVariants = pgTableV2("product_variants", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    product_id: integer("product_id")
        .references(() => products.id, { onDelete: 'cascade' }).notNull(),

    // === IDENTIFICATION ===
    sku: text("sku").notNull(),
    variant_name: text("variant_name"), // e.g. "Rojo / M"

    // === DIFFERENTIATING ATTRIBUTES (JSONB) ===
    variant_attributes: jsonb("variant_attributes")
        .$type<Record<string, unknown>>()
        .default(sql`'{}'::jsonb`).notNull(),

    // === PACKAGING / CONTENT ===
    content_quantity: numeric("content_quantity", { precision: 12, scale: 4 })
        .default('1').notNull(),

    // Sale UOM (may differ from product's uom_inventory_id)
    sale_uom_id: integer("sale_uom_id").references(() => uom.id),

    // === PRICING ===
    unit_price: numeric("unit_price", { precision: 12, scale: 4 }),
    last_cost: numeric("last_cost", { precision: 12, scale: 4 }).default('0'),

    // === BARCODE & TRACKING ===
    barcode: text("barcode"),
    barcode_type: text("barcode_type").default('CUSTOM').notNull(), // GTIN, UPC, EAN, ISBN, ASIN, CUSTOM

    image_urls: text("image_urls").array(),
    std_length_cm: numeric("std_length_cm", { precision: 12, scale: 4 }),
    std_width_cm: numeric("std_width_cm", { precision: 12, scale: 4 }),

    // === FLAGS ===
    is_default: boolean("is_default").default(false),
    is_active: boolean("is_active").default(true),
    sort_order: integer("sort_order").default(0),
}, (t) => [
    unique("unq_variant_sku_company").on(t.company_id, t.sku),
    unique("unq_variant_id_company").on(t.id, t.company_id),
    uniqueIndex("unq_variant_default").on(t.product_id).where(sql`is_default = true`),
    foreignKey({
        name: "fk_variant_product_tenant",
        columns: [t.product_id, t.company_id],
        foreignColumns: [products.id, products.company_id],
    }),
    index("idx_variants_product").on(t.product_id),
    index("idx_variants_company").on(t.company_id),
    index("idx_variants_barcode").on(t.barcode),
    index("idx_variants_attrs").using("gin", t.variant_attributes),
    tenantPolicy(),
]).enableRLS();

// =============================================================================
// 3. PRODUCT COMPONENTS — Lista de Materiales / BOM (Para Compuesto y Fabricado)
// =============================================================================

export const productComponents = pgTableV2("product_components", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    parent_product_id: integer("parent_product_id").references(() => products.id, { onDelete: 'cascade' }).notNull(),
    component_product_id: integer("component_product_id").references(() => products.id).notNull(),
    quantity_per_parent: numeric("quantity_per_parent", { precision: 12, scale: 4 }).notNull(),
    is_reversible: boolean("is_reversible").default(true),
    notes: text("notes"),
}, (t) => [
    unique("unq_prod_component").on(t.parent_product_id, t.component_product_id),
    index("idx_prod_components_company").on(t.company_id),
    tenantPolicy(),
]).enableRLS();

// =============================================================================
// 4. PRODUCT UOM CONVERSIONS — Conversiones de Unidad por Producto
// =============================================================================

export const productUomConversions = pgTableV2("product_uom_conversions", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    product_id: integer("product_id").references(() => products.id, { onDelete: 'cascade' }).notNull(),

    from_uom: integer("from_uom").references(() => uom.id).notNull(),
    to_uom: integer("to_uom").references(() => uom.id).notNull(),
    conversion_factor: numeric("conversion_factor", { precision: 15, scale: 8 }).notNull(),

    is_exact: boolean("is_exact").default(true),
    notes: text("notes"),
}, (t) => [
    unique("unq_prod_uom_conv").on(t.product_id, t.from_uom, t.to_uom),
    index("idx_prod_uom_conv_company").on(t.company_id),
    tenantPolicy(),
]).enableRLS();

// =============================================================================
// 5. VARIANT PRICE HISTORY — Historial de Auditoría de Precios
// =============================================================================

export const variantPriceHistory = pgTableV2("variant_price_history", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    variant_id: integer("variant_id").references(() => productVariants.id, { onDelete: 'cascade' }).notNull(),
    price_type: priceChangeTypeEnum("price_type").notNull(),   // COST | SALE
    old_price: numeric("old_price", { precision: 12, scale: 4 }),
    new_price: numeric("new_price", { precision: 12, scale: 4 }).notNull(),
    reference_type: priceChangeSourceEnum("reference_type"),   // PURCHASE_ORDER, GOODS_RECEIPT, MANUAL
    reference_id: integer("reference_id"),
    changed_by: uuid("changed_by").references(() => authUsers.id),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_vph_variant").on(t.variant_id),
    index("idx_vph_variant_type").on(t.variant_id, t.price_type, t.created_at),
    index("idx_vph_date").on(t.created_at),
    index("idx_vph_company").on(t.company_id),
    tenantPolicy(),
]).enableRLS();
