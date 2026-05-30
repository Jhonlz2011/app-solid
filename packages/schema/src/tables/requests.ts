import { text, integer, boolean, timestamp, numeric, date, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pgTableV2, TZ } from '../utils';
import { requestDestinationEnum, materialRequestStatusEnum, conditionEnum } from '../enums';
import { workOrders } from './manufacturing';
import { entities } from './entities';
import { products, productVariants } from './products';

import { warehouses, warehouseLocations, inventoryDimensionalItems } from './inventory';

// --- REQUEST TEMPLATES (Kits preestablecidos) ---
// Templates stay at PRODUCT level — they define generic material lists

export const requestTemplates = pgTableV2("request_templates", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    name: text("name").notNull(), // "Kit Instalación Básica"
    description: text("description"),
    is_active: boolean("is_active").default(true),
});

export const requestTemplateItems = pgTableV2("request_template_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    template_id: integer("template_id").references(() => requestTemplates.id, { onDelete: 'cascade' }).notNull(),
    product_id: integer("product_id").references(() => products.id).notNull(),
    default_quantity: numeric("default_quantity", { precision: 12, scale: 4 }).notNull(),
});

// --- MATERIAL REQUESTS (Solicitudes de material/herramientas) ---

export const materialRequests = pgTableV2("material_requests", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    work_order_id: integer("work_order_id").references(() => workOrders.id).notNull(),
    requester_id: integer("requester_id").references(() => entities.id).notNull(),
    destination_type: requestDestinationEnum("destination_type").default('WORKSHOP').notNull(),
    location_detail: text("location_detail"), // Dirección exacta si es FIELD_SITE
    status: materialRequestStatusEnum("status").default('PENDING'),
    // Fechas logísticas
    expected_return_date: date("expected_return_date"),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_mr_work_order").on(t.work_order_id, t.status),
    index("idx_mr_requester").on(t.requester_id),
]);

export const materialRequestItems = pgTableV2("material_request_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    request_id: integer("request_id").references(() => materialRequests.id, { onDelete: 'cascade' }).notNull(),
    // Request ESPECÍFICO: variante exacta (con marca + atributos)
    variant_id: integer("variant_id").references(() => productVariants.id).notNull(),

    quantity_requested: numeric("quantity_requested", { precision: 12, scale: 4 }).notNull(),

    // Se auto-hereda de categories.requires_return pero es overrideable
    requires_return: boolean("requires_return").default(false),
}, (t) => [
    index("idx_mri_request").on(t.request_id),
    index("idx_mri_variant").on(t.variant_id),
]);

// --- DESPACHOS PARCIALES (quién, cuánto, cuándo, desde dónde) ---
// Dispatches are ALWAYS specific — you dispatch a real variant

export const materialRequestDispatches = pgTableV2("material_request_dispatches", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    request_item_id: integer("request_item_id")
        .references(() => materialRequestItems.id, { onDelete: 'cascade' }).notNull(),

    // Qué variante se despachó realmente (obligatorio — el despacho siempre es específico)
    variant_id: integer("variant_id").references(() => productVariants.id).notNull(),

    quantity_dispatched: numeric("quantity_dispatched", { precision: 12, scale: 4 }).notNull(),

    // Trazabilidad del despacho
    dispatched_from_location_id: integer("dispatched_from_location_id")
        .references(() => warehouseLocations.id).notNull(),
    dispatched_by: integer("dispatched_by")
        .references(() => entities.id).notNull(),
    dispatched_at: timestamp("dispatched_at", TZ).defaultNow().notNull(),

    notes: text("notes"),
}, (t) => [
    index("idx_dispatches_item").on(t.request_item_id),
    index("idx_dispatches_location").on(t.dispatched_from_location_id),
    index("idx_dispatches_variant").on(t.variant_id),
]);

// --- DEVOLUCIONES ---

export const requestReturns = pgTableV2("request_returns", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    request_id: integer("request_id").references(() => materialRequests.id).notNull(),
    return_date: timestamp("return_date", TZ).defaultNow(),
    received_by: integer("received_by").references(() => entities.id).notNull(),
    notes: text("notes"),
}, (t) => [
    index("idx_returns_request").on(t.request_id),
]);

// Detalle de lo que regresó — returns are ALWAYS specific variants
export const requestReturnItems = pgTableV2("request_return_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    return_id: integer("return_id").references(() => requestReturns.id, { onDelete: 'cascade' }).notNull(),

    // Saber qué item del pedido original es
    original_request_item_id: integer("original_request_item_id").references(() => materialRequestItems.id).notNull(),

    // Denormalizado para queries directos sin JOINs extras
    variant_id: integer("variant_id").references(() => productVariants.id).notNull(),

    quantity_returned: numeric("quantity_returned", { precision: 12, scale: 4 }).notNull(),

    // Estado en el que vuelve (Crítico para Herramientas)
    returned_condition: conditionEnum("returned_condition"),

    // Si devolvió material reutilizable, referencia al dimensional item creado
    scrap_dimensional_item_id: integer("scrap_dimensional_item_id")
        .references(() => inventoryDimensionalItems.id, { onDelete: 'set null' }),
}, (t) => [
    index("idx_rri_return").on(t.return_id),
    index("idx_rri_variant").on(t.variant_id),
]);
