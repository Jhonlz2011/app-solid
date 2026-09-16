// packages/schema/src/tables/taxonomy.ts
import { text, integer, boolean, jsonb, index, customType } from 'drizzle-orm/pg-core';
import { pgTableV2 } from '../utils';
import { ltree } from './config';

const customTsVector = customType<{ data: string }>({
    dataType() { return 'tsvector'; },
});

// =============================================================================
// 1. Categorías Estándar de Shopify (Diccionario Global en referenceDb)
// =============================================================================
export const taxonomyCategories = pgTableV2("taxonomy_categories", {
    id: integer("id").primaryKey(),                  // 1, 2, 3... (4 bytes numérico)
    code: text("code").notNull().unique(),           // 'ap-2-48-5' (código jerárquico Shopify original)
    name: text("name").notNull(),                    // 'Computadoras de sobremesa'
    full_path: text("full_path").notNull(),          // 'Electrónica > Computadoras > Computadoras de sobremesa'
    parent_id: integer("parent_id"),                // Clave foránea numérica
    depth: integer("depth").default(0).notNull(),
    path_ltree: ltree("path_ltree"),                 // '1.15.240.1084' (ruta ltree numérica ultra-compacta)
    vector_busqueda: customTsVector("vector_busqueda"),
}, (t) => [
    index("idx_tax_cat_parent").on(t.parent_id),
    index("idx_tax_cat_code").on(t.code),
    index("idx_tax_cat_vector").using("gin", t.vector_busqueda),
]);

// =============================================================================
// 2. Atributos Estándar / Metacampos Shopify
// =============================================================================
export const taxonomyAttributes = pgTableV2("taxonomy_attributes", {
    id: integer("id").primaryKey(),                  // 1 (Color), 4 (Material), 5398...
    name: text("name").notNull(),                    // 'Color'
    handle: text("handle").notNull(),                // 'color'
    data_type: text("data_type").notNull(),          // 'SELECT' | 'COLOR' | 'TEXT' | 'NUMBER'
});

// =============================================================================
// 3. Valores Canónicos y Metaobjetos (ej. Colores con Hex)
// =============================================================================
export const taxonomyAttributeValues = pgTableV2("taxonomy_attribute_values", {
    id: integer("id").primaryKey(),                  // 31771, 50818...
    attribute_id: integer("attribute_id")            // FK numérica
        .references(() => taxonomyAttributes.id, { onDelete: 'cascade' }).notNull(),
    name: text("name").notNull(),                    // 'Amarillo'
    handle: text("handle").notNull(),                // 'amarillo'
    metadata: jsonb("metadata").$type<{ hex?: string; icon?: string }>(),
}, (t) => [
    index("idx_tax_val_attr").on(t.attribute_id),
]);

// =============================================================================
// 4. Puente Categoría ↔ Atributos Recomendados (4B + 4B = 8B)
// =============================================================================
export const taxonomyCategoryAttributes = pgTableV2("taxonomy_category_attributes", {
    category_id: integer("category_id")
        .references(() => taxonomyCategories.id, { onDelete: 'cascade' }).notNull(),
    attribute_id: integer("attribute_id")
        .references(() => taxonomyAttributes.id, { onDelete: 'cascade' }).notNull(),
    is_recommended: boolean("is_recommended").default(true),
}, (t) => [
    index("idx_tax_cat_attr").on(t.category_id, t.attribute_id),
]);
