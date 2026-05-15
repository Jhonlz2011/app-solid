import { text, integer, boolean, timestamp, numeric, date, index, unique, jsonb, bigint } from 'drizzle-orm/pg-core';
import { pgTableV2, TZ } from '../utils';
import { workOrderStatusEnum, productionStatusEnum, justificationTypeEnum, bomCalculationTypeEnum } from '../enums';
import { entities } from './entities';
import { quotations } from './visits';
import { products, productVariants } from './products';
import { uom, companies } from './config';
import { categories } from './catalogs';
import { authUsers } from './auth';
import { inventoryDimensionalItems } from './inventory';

// --- 6. MANUFACTURING ---
export const workOrders = pgTableV2("work_orders", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    code_sequence: integer("code_sequence"),
    client_id: integer("client_id").references(() => entities.id),
    quotation_id: integer("quotation_id").references(() => quotations.id),
    status: workOrderStatusEnum("status").default('DRAFT'),
    start_date: date("start_date"),
    delivery_date: date("delivery_date"),
    total_estimated: numeric("total_estimated", { precision: 12, scale: 2 }),
    total_actual: numeric("total_actual", { precision: 12, scale: 2 }),
    notes: text("notes"),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_wo_status").on(t.status),
    index("idx_wo_client").on(t.client_id),
    index("idx_wo_dates").on(t.start_date, t.delivery_date),
    index("idx_wo_company").on(t.company_id),
]);

// Define QUÉ se va a fabricar (conceptual — stays at product level)
// Specific variant resolution happens in manufacturing_orders
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
    requested_uom: integer("requested_uom").references(() => uom.id),
}, (t) => [
    index("idx_wo_items_order").on(t.work_order_id),
    index("idx_wo_items_product").on(t.product_id),
]);

// Manufacturing Orders — output is a SPECIFIC variant
export const manufacturingOrders = pgTableV2("manufacturing_orders", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    work_order_id: integer("work_order_id").references(() => workOrders.id).notNull(),

    // The specific variant being produced
    output_variant_id: integer("output_variant_id").references(() => productVariants.id).notNull(),

    target_quantity: numeric("target_quantity", { precision: 12, scale: 4 }).default('1'),
    status: productionStatusEnum("status").default('PLANNED'),

    // Planificación
    start_date: timestamp("start_date", TZ),
    end_date: timestamp("end_date", TZ),
    assigned_supervisor_id: integer("assigned_supervisor_id").references(() => entities.id),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_mfg_orders_wo").on(t.work_order_id),
    index("idx_mfg_orders_status").on(t.status),
    index("idx_mfg_orders_variant").on(t.output_variant_id),
]);

// Actual material consumption — references SPECIFIC variants
export const manufacturingOrderInputs = pgTableV2("manufacturing_order_inputs", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    manufacturing_order_id: integer("manufacturing_order_id").references(() => manufacturingOrders.id, { onDelete: 'cascade' }).notNull(),
    variant_id: integer("variant_id").references(() => productVariants.id).notNull(),

    planned_quantity: numeric("planned_quantity", { precision: 12, scale: 4 }).notNull(),

    is_additional: boolean("is_additional").default(false),
    added_by: integer("added_by").references(() => authUsers.id),
    reason: text("reason"),
    notes: text("notes"),
}, (t) => [
    index("idx_mfg_inputs_order").on(t.manufacturing_order_id),
]);

// Manufacturing log — actual consumption audit trail
export const manufacturingLog = pgTableV2("manufacturing_log", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    manufacturing_order_id: integer("manufacturing_order_id").references(() => manufacturingOrders.id).notNull(),
    variant_id: integer("variant_id").references(() => productVariants.id),
    quantity_consumed: numeric("quantity_consumed", { precision: 12, scale: 4 }),
    // Retazo generado (SET NULL si el retazo se consume después)
    scrap_item_id: integer("scrap_item_id").references(() => inventoryDimensionalItems.id, { onDelete: 'set null' }),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    created_by: integer("created_by").references(() => authUsers.id),
}, (t) => [
    index("idx_mfg_log_order").on(t.manufacturing_order_id),
    index("idx_mfg_log_variant").on(t.variant_id),
]);

// HORARIOS DE EMPLEADOS
export const employeeWorkSchedules = pgTableV2("employee_work_schedules", {
    id: bigint("id", { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    employee_id: integer("employee_id").references(() => entities.id).notNull(),
    work_order_id: integer("work_order_id").references(() => workOrders.id),

    work_date: timestamp("work_date", TZ).notNull(),

    // Horas
    hours_normal: integer("hours_normal").default(0),
    hours_supplementary: integer("hours_supplementary").default(0),
    hours_extraordinary: integer("hours_extraordinary").default(0),
    hours_total: integer("hours_total").default(0),

    // Valores Monetarios / Factores
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

    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_schedule_date").on(t.work_date),
    index("idx_schedule_employee").on(t.employee_id),
    index("idx_schedule_wo").on(t.work_order_id),
]);

// BOM Templates for parametric products (variable dimensions)
// Stays at PRODUCT level — templates are generic recipes.
// Specific variant resolution happens at manufacturing time.
export const bomTemplates = pgTableV2("bom_templates", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    name: text("name").notNull(), // "Puerta Abatible Estándar"
    category_id: integer("category_id").references(() => categories.id),

    // Variables that user must input (e.g., ["width", "height", "thickness"])
    required_variables: jsonb("required_variables").$type<string[]>().default([]),

    // Validations (min/max for each variable)
    variable_constraints: jsonb("variable_constraints").$type<Record<string, { min?: number; max?: number; step?: number }>>().default({}),

    description: text("description"),
    is_active: boolean("is_active").default(true),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_bom_templates_category").on(t.category_id),
    index("idx_bom_templates_company").on(t.company_id),
]);

// BOM Template Details — components at PRODUCT level (generic)
export const bomTemplateDetails = pgTableV2("bom_template_details", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    template_id: integer("template_id").references(() => bomTemplates.id, { onDelete: 'cascade' }).notNull(),
    component_product_id: integer("component_product_id").references(() => products.id).notNull(),

    // Formula using variables: "$width * $height / 10000"
    quantity_formula: text("quantity_formula").notNull(),

    // Base calculation type (before applying formula)
    base_type: bomCalculationTypeEnum("base_type").default('FIXED'),

    wastage_percent: numeric("wastage_percent", { precision: 5, scale: 2 }).default('0'),
    sort_order: integer("sort_order").default(0),
    is_optional: boolean("is_optional").default(false),
    processing_notes: text("processing_notes"),
}, (t) => [
    index("idx_bom_tpl_details_template").on(t.template_id),
    index("idx_bom_tpl_details_component").on(t.component_product_id),
]);

// BOM Headers - stays at product level (recipe for a product concept)
export const bomHeaders = pgTableV2("bom_headers", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    product_id: integer("product_id").references(() => products.id).notNull(),
    name: text("name").notNull(),
    source_template_id: integer("source_template_id").references(() => bomTemplates.id),
    revision: integer("revision").default(1),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
});

// BOM Details - components at PRODUCT level (specific variant chosen at manufacturing)
export const bomDetails = pgTableV2("bom_details", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    bom_id: integer("bom_id").references(() => bomHeaders.id, { onDelete: 'cascade' }).notNull(),
    component_product_id: integer("component_product_id").references(() => products.id).notNull(),
    quantity_factor: numeric("quantity_factor", { precision: 12, scale: 4 }).notNull(),
    calculation_type: bomCalculationTypeEnum("calculation_type").default('FIXED').notNull(),
    wastage_percent: numeric("wastage_percent", { precision: 5, scale: 2 }).default('0'),

    // Custom formula for complex cases
    formula_expression: text("formula_expression"),

    // Processing order (important for sequential cuts)
    sort_order: integer("sort_order").default(0),

    // Notes for the operator
    processing_notes: text("processing_notes"),

    // If this component is optional
    is_optional: boolean("is_optional").default(false),
}, (t) => [
    index("idx_bom_details_bom_component").on(t.bom_id, t.component_product_id),
    index("idx_bom_details_component").on(t.component_product_id),
]);