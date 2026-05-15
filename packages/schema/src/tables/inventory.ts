import { text, integer, boolean, numeric, timestamp, bigint, index, primaryKey, unique } from 'drizzle-orm/pg-core';
import { pgTableV2, TZ } from '../utils';
import { movementTypeEnum, movementReferenceTypeEnum, locationTypeEnum } from '../enums';
import { entities } from './entities';
import { products, productVariants } from './products';
import { authUsers } from './auth';
import { ltree, companies } from './config';

// --- 4. INVENTORY ---
export const warehouses = pgTableV2("warehouses", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    code: text("code").notNull(), // "BOD-001", para reportes y búsquedas rápidas
    name: text("name").notNull(),
    address: text("address"),
    is_mobile: boolean("is_mobile").default(false),
    // Responsable de la bodega (para aprobaciones de despacho)
    manager_id: integer("manager_id").references(() => entities.id),
    is_active: boolean("is_active").default(true),
}, (t) => [
    unique("unq_warehouse_code_company").on(t.company_id, t.code),
    index("idx_warehouses_company").on(t.company_id),
]);

// Ubicaciones jerárquicas dentro de una bodega (y ubicaciones virtuales)
// Dual tracking: parent_id para tree rendering (frontend), ltree para queries jerárquicas (backend)
export const warehouseLocations = pgTableV2("warehouse_locations", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    // Nullable para ubicaciones virtuales (como Proveedores o Clientes) que no pertenecen a una bodega física
    warehouse_id: integer("warehouse_id").references(() => warehouses.id),
    // Self-reference para árbol jerárquico (FK via migración SQL: fk_location_parent)
    parent_id: integer("parent_id"),
    name: text("name").notNull(), // "Estante A1", "Scrap Zone", "Vendor X"
    
    // ltree path: "bodega_principal.zona_a.pasillo_3"
    path: ltree("path").notNull(),
    
    barcode: text("barcode").unique(),
    type: locationTypeEnum("type").default('INTERNAL').notNull(),
    
    // Depth in tree (0 = root)
    depth: integer("depth").default(0).notNull(),
    is_active: boolean("is_active").default(true),
}, (t) => [
    index("idx_locations_warehouse").on(t.warehouse_id),
    index("idx_locations_parent").on(t.parent_id),
    index("idx_locations_path_gist").using("gist", t.path),
    index("idx_locations_barcode").on(t.barcode),
]);

// Stock agrupado por UBICACIÓN + VARIANTE (la unidad transaccional)
export const inventoryStock = pgTableV2("inventory_stock", {
    location_id: integer("location_id").references(() => warehouseLocations.id, { onDelete: 'restrict' }).notNull(),
    variant_id: integer("variant_id").references(() => productVariants.id, { onDelete: 'restrict' }).notNull(),
    quantity_on_hand: numeric("quantity_on_hand", { precision: 15, scale: 4 }).default('0').notNull(),
    // Quantity reserved by sales orders, manufacturing orders, etc.
    // Available = on_hand - reserved
    quantity_reserved: numeric("quantity_reserved", { precision: 15, scale: 4 }).default('0').notNull(),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    primaryKey({ columns: [t.location_id, t.variant_id] }),
    index("idx_inv_stock_variant").on(t.variant_id),
]);

// Ítems dimensionales — piezas con medidas específicas
// Para UOM=M2 (paneles): TODAS las piezas van aquí, stock = SUM(áreas)
// Para UOM=UND (planchas): Solo RETAZOS (piezas cortadas no estándar)
// Piezas con mismas dimensiones se agrupan con quantity
export const inventoryDimensionalItems = pgTableV2("inventory_dimensional_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    location_id: integer("location_id").references(() => warehouseLocations.id).notNull(),
    variant_id: integer("variant_id").references(() => productVariants.id).notNull(),

    // Dimensiones de esta pieza/retazo
    length_cm: numeric("length_cm", { precision: 12, scale: 4 }).notNull(),
    width_cm: numeric("width_cm", { precision: 12, scale: 4 }).notNull(),

    // Cuántas piezas IDÉNTICAS de estas dimensiones
    quantity: integer("quantity").default(1).notNull(),

    // Equivalencia en UND de CADA pieza (solo productos con UOM=UND)
    unit_equivalent: numeric("unit_equivalent", { precision: 12, scale: 4 }),

    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_dim_items_variant").on(t.variant_id, t.location_id),
    // Agrupar: misma ubicación + variante + dimensiones = 1 fila
    unique("unq_dim_item_dims").on(t.location_id, t.variant_id, t.length_cm, t.width_cm),
]);

// Movimientos de inventario (Double-Entry Audit Trail)
export const inventoryMovements = pgTableV2("inventory_movements", {
    id: bigint("id", { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    
    // Double entry locations (nullable for external operations: purchase/sale)
    source_location_id: integer("source_location_id").references(() => warehouseLocations.id),
    destination_location_id: integer("destination_location_id").references(() => warehouseLocations.id),
    
    variant_id: integer("variant_id").references(() => productVariants.id).notNull(),
    // Denormalized product_id for fast reporting without JOINs
    product_id: integer("product_id").references(() => products.id),
    // SET NULL cuando el dimensional item se elimina tras consumo
    dimensional_item_id: integer("dimensional_item_id").references(() => inventoryDimensionalItems.id, { onDelete: 'set null' }),

    type: movementTypeEnum("type").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull(),

    // Snapshots of stock at the moment of movement for both locations
    source_previous_stock: numeric("source_previous_stock", { precision: 12, scale: 4 }),
    source_new_stock: numeric("source_new_stock", { precision: 12, scale: 4 }),
    dest_previous_stock: numeric("dest_previous_stock", { precision: 12, scale: 4 }),
    dest_new_stock: numeric("dest_new_stock", { precision: 12, scale: 4 }),
    
    unit_cost: numeric("unit_cost", { precision: 12, scale: 4 }),

    reference_id: integer("reference_id"),
    reference_type: movementReferenceTypeEnum("reference_type"),

    created_by: integer("created_by").references(() => authUsers.id),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_movements_src_loc").on(t.source_location_id, t.variant_id, t.created_at),
    index("idx_movements_dest_loc").on(t.destination_location_id, t.variant_id, t.created_at),
    index("idx_movements_type_date").on(t.type, t.created_at),
    index("idx_movements_ref").on(t.reference_type, t.reference_id),
    index("idx_movements_product").on(t.product_id),
]);
