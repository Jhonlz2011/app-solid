import { text, integer, boolean, jsonb, foreignKey, index, unique, timestamp } from 'drizzle-orm/pg-core';
import { pgTableV2, TZ } from '../utils';
import { attributeDataTypeEnum } from '../enums';
import { companies, ltree } from './config';

// =============================================================================
// BRANDS
// =============================================================================

export const brands = pgTableV2("brands", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    name: text("name").notNull(),
    website: text("website"),
    is_active: boolean("is_active").default(true),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    unique("unq_brand_name_company").on(t.company_id, t.name),
    index("idx_brands_company").on(t.company_id),
]);

// =============================================================================
// ATTRIBUTE DEFINITIONS
// =============================================================================

export const attributeDefinitions = pgTableV2("attribute_definitions", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    type: attributeDataTypeEnum("type").notNull(),
    default_options: jsonb("default_options").$type<string[] | null>(),
    is_active: boolean("is_active").default(true),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    unique("unq_attr_key_company").on(t.company_id, t.key),
    index("idx_attr_defs_company").on(t.company_id),
]);

// =============================================================================
// CATEGORIES — Hierarchical (ltree)
// =============================================================================

export const categories = pgTableV2("categories", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    name: text("name").notNull(),
    parent_id: integer("parent_id"),

    description: text("description"),
    icon: text("icon"), // For UI display (SVG path or icon name)
    name_template: text("name_template"), // Template for product naming

    // ltree path: "materiales.ferreteria.tornillos"
    // Enables native operators:
    //   path <@ 'materiales.ferreteria'  → all descendants
    //   path @> 'materiales.ferreteria.tornillos'  → all ancestors
    //   path ~ 'materiales.*{1}'  → direct children only
    path: ltree("path").notNull(),

    // Depth in tree (0 = root). Computed by application on insert/move.
    depth: integer("depth").default(0).notNull(),

    // Sort order for UI display
    sort_order: integer("sort_order").default(0),

    // Herramientas → true (deben retornarse), Materiales → false
    requires_return: boolean("requires_return").default(false),

    is_active: boolean("is_active").default(true),
}, (t) => [
    foreignKey({ columns: [t.parent_id], foreignColumns: [t.id] }),
    index("idx_categories_parent").on(t.parent_id),
    index("idx_categories_active").on(t.is_active),
    index("idx_categories_company").on(t.company_id),
    // GiST index for ltree operators (sub-tree, ancestor, descendant queries)
    index("idx_categories_path_gist").using("gist", t.path),
    // Prevent duplicate category names at the same hierarchy level within a company
    unique("unq_category_name_parent").on(t.company_id, t.name, t.parent_id),
]);

// Category ↔ Attribute bridge (what attributes to show for products in this category)
// Stays as metadata catalog for form rendering — no longer referenced by transactional tables
export const categoryAttributes = pgTableV2("category_attributes", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    category_id: integer("category_id").references(() => categories.id).notNull(),
    attribute_def_id: integer("attribute_def_id").references(() => attributeDefinitions.id).notNull(),
    required: boolean("required").default(false),
    order: integer("order").default(0),
    specific_options: jsonb("specific_options").$type<string[] | null>(),
}, (t) => [unique("unq_cat_attr").on(t.category_id, t.attribute_def_id)]);

// =============================================================================
// PRODUCT FAMILIES — Intercambiables
// =============================================================================

// Familias de productos intercambiables (para material requests genéricos)
// "Cemento de Contacto" agrupa Africano, Mega — cualquier marca sirve
// Cruza marcas: Cemento Africano y Cemento Mega son intercambiables
export const productFamilies = pgTableV2("product_families", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    name: text("name").notNull(),
    category_id: integer("category_id").references(() => categories.id),
    description: text("description"),
    is_active: boolean("is_active").default(true),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    unique("unq_family_name_company").on(t.company_id, t.name),
    index("idx_families_company").on(t.company_id),
]);
