import { text, integer, boolean, timestamp, numeric, date, index, unique, jsonb, bigint } from 'drizzle-orm/pg-core';
import { pgTableV2 } from '../utils';
import { workOrderStatusEnum, productionStatusEnum, justificationTypeEnum, bomCalculationTypeEnum } from '../enums';
import { entities } from './entities';
import { quotations } from './visits';
import { products } from './products';
import { uom, categories } from './config';
import { authUsers } from './auth';
import { inventoryDimensionalItems } from './inventory';

// --- 6. MANUFACTURING ---
export const workOrders = pgTableV2("work_orders", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    code_sequence: integer("code_sequence"),
    client_id: integer("client_id").references(() => entities.id),
    quotation_id: integer("quotation_id").references(() => quotations.id),
    status: workOrderStatusEnum("status").default('DRAFT'),
    start_date: date("start_date"),
    delivery_date: date("delivery_date"),
    total_estimated: numeric("total_estimated", { precision: 12, scale: 2 }),
    notes: text("notes"),
    created_at: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
    index("idx_wo_status").on(t.status),
    index("idx_wo_client").on(t.client_id),
    index("idx_wo_dates").on(t.start_date, t.delivery_date),
]);

// Define QUÉ se va a fabricar específicamente
export const workOrderItems = pgTableV2("work_order_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    work_order_id: integer("work_order_id").references(() => workOrders.id, { onDelete: 'cascade' }).notNull(),

    product_id: integer("product_id").references(() => products.id).notNull(), // El producto a fabricar (ej. Mesa)
    quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull(),

    // --- LAS VARIABLES DEL CLIENTE (Paramétricas) ---
    // El cliente pide una mesa de 1.50m x 0.80m
    custom_width: numeric("custom_width", { precision: 10, scale: 4 }),
    custom_length: numeric("custom_length", { precision: 10, scale: 4 }),
    custom_thickness: numeric("custom_thickness", { precision: 10, scale: 4 }),

    // Unidad en la que pidió el cliente (ej. "PZA" o "METRO")
    requested_uom: text("requested_uom").references(() => uom.code),
}, (t) => [
    index("idx_wo_items_order").on(t.work_order_id),
]);

export const manufacturingOrders = pgTableV2("manufacturing_orders", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    work_order_id: integer("work_order_id").references(() => workOrders.id).notNull(),

    output_product_id: integer("output_product_id").references(() => products.id),

    // MEDIDAS DINÁMICAS PARA ESTA ORDEN
    custom_width: numeric("custom_width", { precision: 10, scale: 2 }),
    custom_height: numeric("custom_height", { precision: 10, scale: 2 }),
    custom_thickness: numeric("custom_thickness", { precision: 10, scale: 2 }),

    target_quantity: numeric("target_quantity", { precision: 12, scale: 4 }).default('1'),
    status: productionStatusEnum("status").default('PLANNED'),

    // Planificación
    start_date: timestamp("start_date"),
    end_date: timestamp("end_date"),
    assigned_supervisor_id: integer("assigned_supervisor_id").references(() => entities.id),
});

// NUEVO: Insumos PLANIFICADOS para la orden (Receta dinámica)
export const manufacturingOrderInputs = pgTableV2("manufacturing_order_inputs", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    manufacturing_order_id: integer("manufacturing_order_id").references(() => manufacturingOrders.id, { onDelete: 'cascade' }).notNull(),
    product_id: integer("product_id").references(() => products.id).notNull(),

    planned_quantity: numeric("planned_quantity", { precision: 12, scale: 4 }).notNull(),

    // Si es un retazo específico reservado
    reserved_dimensional_item_id: integer("reserved_dimensional_item_id").references(() => inventoryDimensionalItems.id),

    // NEW: TRUE if manually added by supervisor (not from BOM)
    is_additional: boolean("is_additional").default(false),
    added_by: integer("added_by").references(() => authUsers.id),
    reason: text("reason"), // "Se necesita refuerzo adicional"

    notes: text("notes"), // "Cortar del retazo X"
}, (t) => [
    index("idx_mfg_inputs_order").on(t.manufacturing_order_id),
]);

export const manufacturingLog = pgTableV2("manufacturing_log", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    manufacturing_order_id: integer("manufacturing_order_id").references(() => manufacturingOrders.id).notNull(),

    product_id: integer("product_id").references(() => products.id), // Insumo usado

    // IMPROVED: Specific dimensional item consumed (for traceability)
    dimensional_item_id: integer("dimensional_item_id").references(() => inventoryDimensionalItems.id),

    quantity_consumed: numeric("quantity_consumed", { precision: 12, scale: 4 }), // Ej: 1 Plancha
    area_consumed_m2: numeric("area_consumed_m2", { precision: 12, scale: 4 }), // Para items dimensionales

    // Si sobró material útil (Retazo)
    scrap_generated: boolean("scrap_generated").default(false),
    scrap_quantity: numeric("scrap_quantity", { precision: 12, scale: 4 }),
    // IMPROVED: Reference to the new scrap item created in inventory
    scrap_item_id: integer("scrap_item_id").references(() => inventoryDimensionalItems.id),

    created_at: timestamp("created_at").defaultNow().notNull(),
    created_by: integer("created_by").references(() => authUsers.id),
}, (t) => [
    index("idx_mfg_log_order").on(t.manufacturing_order_id),
    index("idx_mfg_log_product").on(t.product_id),
]);

// NUEVO: Horarios de Empleados (Mapeo de tblhorario)
export const employeeWorkSchedules = pgTableV2("employee_work_schedules", {
    id: bigint("id", { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    employee_id: integer("employee_id").references(() => entities.id).notNull(),
    work_order_id: integer("work_order_id").references(() => workOrders.id),

    work_date: timestamp("work_date").notNull(),

    // Horas (Smallint en SQL original)
    hours_normal: integer("hours_normal").default(0),
    hours_supplementary: integer("hours_supplementary").default(0),
    hours_extraordinary: integer("hours_extraordinary").default(0),
    hours_total: integer("hours_total").default(0),

    // Valores Monetarios / Factores (Numeric 6,2)
    val_gm: numeric("val_gm", { precision: 6, scale: 2 }).default('0'),
    val_gt: numeric("val_gt", { precision: 6, scale: 2 }).default('0'),
    val_gc: numeric("val_gc", { precision: 6, scale: 2 }).default('0'),
    val_gh: numeric("val_gh", { precision: 6, scale: 2 }).default('0'),
    val_gg: numeric("val_gg", { precision: 6, scale: 2 }).default('0'),
    val_ga: numeric("val_ga", { precision: 6, scale: 2 }).default('0'),

    // Valores Calculados de Horas
    value_normal_hours: numeric("value_normal_hours", { precision: 6, scale: 2 }).default('0'),
    value_supplementary_hours: numeric("value_supplementary_hours", { precision: 6, scale: 2 }).default('0'),
    value_extraordinary_hours: numeric("value_extraordinary_hours", { precision: 6, scale: 2 }).default('0'),
    value_total_hours: numeric("value_total_hours", { precision: 6, scale: 2 }).default('0'),

    // Beneficios Sociales
    additional_1215: numeric("additional_1215", { precision: 6, scale: 2 }).default('0'),
    thirteenth_salary: numeric("thirteenth_salary", { precision: 6, scale: 2 }).default('0'),
    fourteenth_salary: numeric("fourteenth_salary", { precision: 6, scale: 2 }).default('0'),
    vacations: numeric("vacations", { precision: 6, scale: 2 }).default('0'),
    reserve_fund: numeric("reserve_fund", { precision: 6, scale: 2 }).default('0'),

    // Costos Finales
    labor_cost: numeric("labor_cost", { precision: 12, scale: 2 }).default('0'),
    project_expense: numeric("project_expense", { precision: 12, scale: 2 }).default('0'),

    // Generated Always as (labor_cost + project_expense)
    total_cost: numeric("total_cost", { precision: 12, scale: 2 }),

    justification: justificationTypeEnum("justification"),

    created_at: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
    index("idx_schedule_date").on(t.work_date),
    index("idx_schedule_employee").on(t.employee_id),
    index("idx_schedule_wo").on(t.work_order_id),
]);

export const bomHeaders = pgTableV2("bom_headers", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    product_id: integer("product_id").references(() => products.id),
    name: text("name"),
    revision: integer("revision").default(1),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const bomDetails = pgTableV2("bom_details", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    bom_id: integer("bom_id").references(() => bomHeaders.id, { onDelete: 'cascade' }),
    component_product_id: integer("component_product_id").references(() => products.id),
    quantity_factor: numeric("quantity_factor", { precision: 12, scale: 4 }).notNull(),
    calculation_type: bomCalculationTypeEnum("calculation_type").default('FIXED').notNull(),
    wastage_percent: numeric("wastage_percent", { precision: 5, scale: 2 }).default('0'),

    // NEW: Custom formula for complex cases
    // e.g., "$width * $length / 10000 * 1.05" (area + 5% waste)
    formula_expression: text("formula_expression"),

    // NEW: Processing order (important for sequential cuts)
    sort_order: integer("sort_order").default(0),

    // NEW: Notes for the operator
    processing_notes: text("processing_notes"),

    // NEW: If this component is optional
    is_optional: boolean("is_optional").default(false),
}, (t) => [unique("unq_bom_component").on(t.bom_id, t.component_product_id)]);

// NEW: BOM Templates for parametric products (variable dimensions)
export const bomTemplates = pgTableV2("bom_templates", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    name: text("name").notNull(), // "Puerta Abatible Estándar"
    category_id: integer("category_id").references(() => categories.id),

    // Variables that user must input (e.g., ["width", "height", "thickness"])
    required_variables: jsonb("required_variables").default([]),

    // Validations (min/max for each variable)
    variable_constraints: jsonb("variable_constraints").default({}),

    description: text("description"),
    is_active: boolean("is_active").default(true),
    created_at: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
    index("idx_bom_templates_category").on(t.category_id),
]);

export const bomTemplateDetails = pgTableV2("bom_template_details", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    template_id: integer("template_id").references(() => bomTemplates.id, { onDelete: 'cascade' }).notNull(),
    component_product_id: integer("component_product_id").references(() => products.id),

    // Formula using variables: "$width * $height / 10000"
    quantity_formula: text("quantity_formula").notNull(),

    // Base calculation type (before applying formula)
    base_type: bomCalculationTypeEnum("base_type").default('FIXED'),

    wastage_percent: numeric("wastage_percent", { precision: 5, scale: 2 }).default('0'),
    sort_order: integer("sort_order").default(0),
    is_optional: boolean("is_optional").default(false),
    processing_notes: text("processing_notes"),
});
