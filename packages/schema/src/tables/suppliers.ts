import { text, integer, boolean, numeric, date, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pgTableV2, TZ, tenantPolicy } from '../utils';
import { purchaseOrderStatusEnum } from '../enums';
import { entities } from './entities';
import { products, productVariants } from './products';
import { uom, companies } from './config';
import { workOrders } from './manufacturing';
import { warehouses } from './inventory';
import { authUsers } from './auth';

// --- SUPPLIER PRODUCTS (Catálogo de lo que vende cada proveedor por variante) ---
// A supplier sells specific VARIANTS (which already encode packaging info)

export const supplierProducts = pgTableV2("supplier_products", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    supplier_id: integer("supplier_id").references(() => entities.id).notNull(),
    // Primary: which variant (= SKU) does this supplier sell
    variant_id: integer("variant_id").references(() => productVariants.id).notNull(),
    supplier_sku: text("supplier_sku"),
    supplier_product_name: text("supplier_product_name"),
    purchase_uom: integer("purchase_uom").references(() => uom.id),
    // Factor de conversión a UOM de inventario (dinámico por variante)
    conversion_to_inventory_factor: numeric("conversion_to_inventory_factor", { precision: 12, scale: 4 }).default('1'),
    agreed_price: numeric("agreed_price", { precision: 12, scale: 4 }),
    last_purchase_date: date("last_purchase_date"),

    lead_time_days: integer("lead_time_days"),
    min_order_quantity: numeric("min_order_quantity", { precision: 12, scale: 4 }),
    is_preferred: boolean("is_preferred").default(false),
    is_active: boolean("is_active").default(true),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    unique("unq_supplier_variant").on(t.supplier_id, t.variant_id),
    index("idx_supplier_products_variant").on(t.variant_id),
    // Partial index: active products by supplier (most common query)
    index("idx_sp_supplier_active").on(t.supplier_id).where(sql`${t.is_active} = true`),
]);

// --- PURCHASE ORDERS ---

export const purchaseOrders = pgTableV2("purchase_orders", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    code_sequence: integer("code_sequence"),
    supplier_id: integer("supplier_id").references(() => entities.id).notNull(),
    // Opcional: vinculada a una orden de trabajo
    work_order_id: integer("work_order_id").references(() => workOrders.id),
    status: purchaseOrderStatusEnum("status").default('DRAFT'),

    // Bodega destino al recibir
    destination_warehouse_id: integer("destination_warehouse_id")
        .references(() => warehouses.id).notNull(),

    // Totales
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default('0'),
    tax_total: numeric("tax_total", { precision: 12, scale: 2 }).default('0'),
    total: numeric("total", { precision: 12, scale: 2 }).default('0'),

    expected_delivery_date: date("expected_delivery_date"),
    actual_delivery_date: date("actual_delivery_date"),
    notes: text("notes"),

    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    created_by: integer("created_by").references(() => authUsers.id),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_po_supplier").on(t.supplier_id),
    index("idx_po_status").on(t.status),
    index("idx_po_wo").on(t.work_order_id),
    index("idx_po_company").on(t.company_id),
    tenantPolicy(),
]).enableRLS();

// Purchase order items — buy SPECIFIC variants (= SKUs)
export const purchaseOrderItems = pgTableV2("purchase_order_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    purchase_order_id: integer("purchase_order_id")
        .references(() => purchaseOrders.id, { onDelete: 'cascade' }).notNull(),
    // Referencia directa al catálogo del proveedor
    supplier_product_id: integer("supplier_product_id")
        .references(() => supplierProducts.id).notNull(),
    // Primary: which variant (= SKU) are we buying
    variant_id: integer("variant_id").references(() => productVariants.id).notNull(),

    quantity_ordered: numeric("quantity_ordered", { precision: 12, scale: 4 }).notNull(),
    quantity_received: numeric("quantity_received", { precision: 12, scale: 4 }).default('0'),

    unit_price: numeric("unit_price", { precision: 12, scale: 4 }).notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),

    iva_rate: numeric("iva_rate", { precision: 5, scale: 2 }).default('0'),
    iva_amount: numeric("iva_amount", { precision: 12, scale: 2 }).default('0'),
}, (t) => [
    index("idx_poi_order").on(t.purchase_order_id),
    index("idx_poi_variant").on(t.variant_id),
    index("idx_poi_supplier_product").on(t.supplier_product_id),
]);

// --- GOODS RECEIPTS (Actas de recepción de mercadería) ---

export const goodsReceipts = pgTableV2("goods_receipts", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    purchase_order_id: integer("purchase_order_id").references(() => purchaseOrders.id),
    warehouse_id: integer("warehouse_id").references(() => warehouses.id).notNull(),

    received_by: integer("received_by").references(() => authUsers.id).notNull(),
    received_at: timestamp("received_at", TZ).defaultNow().notNull(),

    // Referencia a factura del proveedor
    supplier_invoice_number: text("supplier_invoice_number"),
    supplier_invoice_date: date("supplier_invoice_date"),

    notes: text("notes"),
}, (t) => [
    index("idx_gr_po").on(t.purchase_order_id),
    index("idx_gr_date").on(t.received_at),
]);

// Goods receipt items — receive SPECIFIC variants (= SKUs)
export const goodsReceiptItems = pgTableV2("goods_receipt_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    receipt_id: integer("receipt_id").references(() => goodsReceipts.id, { onDelete: 'cascade' }).notNull(),
    purchase_order_item_id: integer("purchase_order_item_id").references(() => purchaseOrderItems.id),
    // Primary: which variant (= SKU) was received
    variant_id: integer("variant_id").references(() => productVariants.id).notNull(),

    quantity_received: numeric("quantity_received", { precision: 12, scale: 4 }).notNull(),
    quantity_rejected: numeric("quantity_rejected", { precision: 12, scale: 4 }).default('0'),

    // Costo real (puede diferir del PO si hubo negociación)
    unit_cost_actual: numeric("unit_cost_actual", { precision: 12, scale: 4 }).notNull(),
}, (t) => [
    index("idx_gri_receipt").on(t.receipt_id),
    index("idx_gri_variant").on(t.variant_id),
]);
