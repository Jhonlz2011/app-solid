import { text, integer, boolean, jsonb, foreignKey, index, unique } from 'drizzle-orm/pg-core';
import { pgTableV2 } from '../utils';

// --- 2. CONFIG & CATALOGS ---
export const uom = pgTableV2("uom", {
    code: text("code").primaryKey(),
    name: text("name").notNull(),
    is_active: boolean("is_active").default(true),
});

export const brands = pgTableV2("brands", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    name: text("name").notNull().unique(),
    website: text("website"),
    is_active: boolean("is_active").default(true),
});

export const attributeDefinitions = pgTableV2("attribute_definitions", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    key: text("key").notNull().unique(),
    label: text("label").notNull(),
    type: text("type").notNull(),
    default_options: jsonb("default_options"),
    is_active: boolean("is_active").default(true),
});

export const categories = pgTableV2("categories", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    name: text("name").notNull(),
    parent_id: integer("parent_id"),

    description: text("description"),
    icon: text("icon"), // For UI display (SVG path or icon name)
    name_template: text("name_template"), // Template for product naming

    // Sort order for UI display
    sort_order: integer("sort_order").default(0),

    is_active: boolean("is_active").default(true),
}, (t) => [
    foreignKey({ columns: [t.parent_id], foreignColumns: [t.id] }),
    index("idx_categories_parent").on(t.parent_id),
    index("idx_categories_active").on(t.is_active),
]);

export const categoryAttributes = pgTableV2("category_attributes", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    category_id: integer("category_id").references(() => categories.id).notNull(),
    attribute_def_id: integer("attribute_def_id").references(() => attributeDefinitions.id).notNull(),
    required: boolean("required").default(false),
    order: integer("order").default(0),
    specific_options: jsonb("specific_options"),
}, (t) => [unique("unq_cat_attr").on(t.category_id, t.attribute_def_id)]);
