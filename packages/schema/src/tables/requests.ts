import { text, integer, boolean, timestamp, numeric, date, index } from 'drizzle-orm/pg-core';
import { pgTableV2 } from '../utils';
import { requestDestinationEnum, materialRequestStatusEnum, conditionEnum } from '../enums';
import { workOrders } from './manufacturing';
import { entities } from './entities';
import { products } from './products';
import { inventoryDimensionalItems } from './inventory';

export const requestTemplates = pgTableV2("request_templates", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    name: text("name").notNull(), // "Kit Instalación Básica"
    description: text("description"),
    is_active: boolean("is_active").default(true),
});

export const requestTemplateItems = pgTableV2("request_template_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    template_id: integer("template_id").references(() => requestTemplates.id, { onDelete: 'cascade' }),
    product_id: integer("product_id").references(() => products.id),
    default_quantity: numeric("default_quantity", { precision: 12, scale: 4 }),
});

export const materialRequests = pgTableV2("material_requests", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    work_order_id: integer("work_order_id").references(() => workOrders.id),
    requester_id: integer("requester_id").references(() => entities.id),

    destination_type: requestDestinationEnum("destination_type").default('WORKSHOP').notNull(),
    location_detail: text("location_detail"), // Dirección exacta si es FIELD_SITE

    status: materialRequestStatusEnum("status").default('PENDING'),

    // Fechas logísticas
    dispatch_date: timestamp("dispatch_date"),
    expected_return_date: date("expected_return_date"),
    created_at: timestamp("created_at").defaultNow().notNull(),
});

export const materialRequestItems = pgTableV2("material_request_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    request_id: integer("request_id").references(() => materialRequests.id, { onDelete: 'cascade' }),
    product_id: integer("product_id").references(() => products.id),

    quantity_requested: numeric("quantity_requested", { precision: 12, scale: 4 }),
    quantity_dispatched: numeric("quantity_dispatched", { precision: 12, scale: 4 }).default('0'),

    // LA CLAVE DE LA UNIFICACIÓN:
    // Si despachas una herramienta específica (con serie), guardas su ID de inventario aquí.
    // Esto reemplaza a `dispatched_tool_id`.
    inventory_item_id: integer("inventory_item_id").references(() => inventoryDimensionalItems.id),

    quantity_returned: numeric("quantity_returned", { precision: 12, scale: 4 }).default('0'),
});

export const requestReturns = pgTableV2("request_returns", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    request_id: integer("request_id").references(() => materialRequests.id),
    return_date: timestamp("return_date").defaultNow(),
    received_by: integer("received_by").references(() => entities.id),
    notes: text("notes"),
});

// Detalle de lo que regresó
export const requestReturnItems = pgTableV2("request_return_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    return_id: integer("return_id").references(() => requestReturns.id, { onDelete: 'cascade' }),

    // Saber qué item del pedido original es
    original_request_item_id: integer("original_request_item_id").references(() => materialRequestItems.id),

    quantity_returned: numeric("quantity_returned", { precision: 12, scale: 4 }).notNull(),

    // Estado en el que vuelve (Crítico para Herramientas)
    returned_condition: conditionEnum("returned_condition"),

    // Si es material sobrante, ¿creamos un nuevo retazo?
    is_scrap_reusable: boolean("is_scrap_reusable").default(true),
});
