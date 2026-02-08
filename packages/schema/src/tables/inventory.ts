import { text, integer, boolean, numeric, timestamp, bigint, index, primaryKey, foreignKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pgTableV2 } from '../utils';
import { conditionEnum, inventoryStatusEnum, dimensionalSourceEnum, movementTypeEnum } from '../enums';
import { products, productVariants } from './products';
import { authUsers } from './auth';

// --- 4. INVENTORY ---
export const warehouses = pgTableV2("warehouses", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    name: text("name").notNull(),
    address: text("address"),
    is_mobile: boolean("is_mobile").default(false),
    is_active: boolean("is_active").default(true),
});

export const inventoryStock = pgTableV2("inventory_stock", {
    warehouse_id: integer("warehouse_id").references(() => warehouses.id, { onDelete: 'restrict' }).notNull(),
    product_id: integer("product_id").references(() => products.id, { onDelete: 'restrict' }).notNull(),
    // NEW: Track stock by condition (GOOD, DAMAGED, UNUSABLE)
    condition: conditionEnum("condition").default('GOOD').notNull(),

    quantity_on_hand: numeric("quantity_on_hand", { precision: 15, scale: 4 }).default('0'),
    // Secondary quantity for dual-unit tracking (e.g., units when primary is grams)
    quantity_secondary: numeric("quantity_secondary", { precision: 15, scale: 4 }).default('0'),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
    // PK now includes condition to track: "Clavos en Bodega1 GOOD: 500" vs "Clavos en Bodega1 DAMAGED: 20"
    primaryKey({ columns: [t.warehouse_id, t.product_id, t.condition] }),
    index("idx_inv_stock_wh").on(t.warehouse_id),
    index("idx_inv_stock_product").on(t.product_id),
    index("idx_inv_stock_condition").on(t.condition),
]);

export const inventoryDimensionalItems = pgTableV2("inventory_dimensional_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    warehouse_id: integer("warehouse_id").references(() => warehouses.id),
    product_id: integer("product_id").references(() => products.id),
    parent_item_id: integer("parent_item_id"), // Scrap came from this sheet
    variant_id: integer("variant_id").references(() => productVariants.id),
    quantity: numeric("quantity", { precision: 12, scale: 4 }).default('1').notNull(),

    // IMPROVED: Real dimensions of this item (e.g., scrap 50x50cm)
    length_cm: numeric("length_cm", { precision: 12, scale: 4 }),
    width_cm: numeric("width_cm", { precision: 12, scale: 4 }),
    thickness_cm: numeric("thickness_cm", { precision: 12, scale: 4 }),
    area_m2: numeric("area_m2", { precision: 12, scale: 4 }), // Calculated: (length*width)/10000

    // NEW: Equivalence in standard unit (e.g., 0.1667 UND of 122x244 sheet)
    equivalent_standard_units: numeric("equivalent_standard_units", { precision: 12, scale: 6 }),

    batch_number: text("batch_number"),
    status: inventoryStatusEnum("status").default('AVAILABLE'),
    location_rack: text("location_rack"),

    // NEW: Traceability for quality control
    source_type: dimensionalSourceEnum("source_type"), // 'PURCHASE', 'CUT', 'RETURN', etc.
    notes: text("notes"),

    created_at: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
    foreignKey({ columns: [t.parent_item_id], foreignColumns: [t.id] }),
    index("idx_dim_items_avail").on(t.product_id, t.length_cm, t.width_cm).where(sql`status = 'AVAILABLE'`),
    // Optimización: Búsqueda rápida por almacén y estado
    index("idx_dim_items_wh_status").on(t.warehouse_id, t.status),
    // NEW: Index for variant lookup
    index("idx_dim_items_variant").on(t.variant_id),
    index("idx_dim_items_parent").on(t.parent_item_id),
]);

export const inventoryMovements = pgTableV2("inventory_movements", {
    id: bigint("id", { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    warehouse_id: integer("warehouse_id").references(() => warehouses.id).notNull(),
    product_id: integer("product_id").references(() => products.id).notNull(),
    dimensional_item_id: integer("dimensional_item_id").references(() => inventoryDimensionalItems.id),

    type: movementTypeEnum("type").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull(),
    // For dual-unit tracking (e.g., units when primary is grams)
    quantity_secondary: numeric("quantity_secondary", { precision: 12, scale: 4 }),

    previous_stock: numeric("previous_stock", { precision: 12, scale: 4 }),
    new_stock: numeric("new_stock", { precision: 12, scale: 4 }),
    unit_cost: numeric("unit_cost", { precision: 12, scale: 4 }),

    reference_id: integer("reference_id"),
    reference_type: text("reference_type"),

    created_at: timestamp("created_at").defaultNow().notNull(),
    created_by: integer("created_by").references(() => authUsers.id),
}, (t) => [
    index("idx_movements_kardex").on(t.product_id, t.warehouse_id, t.created_at),
    // Optimización: Reportes por tipo de movimiento
    index("idx_movements_type").on(t.type),
]);
