import {
  pgTableCreator,
  text,
  timestamp,
  integer,
  boolean,
  numeric,
  pgEnum,
  primaryKey,
  date,
  unique,
  foreignKey,
  jsonb,
  index,
  bigint,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// Definimos el creador de tablas
export const pgTableV2 = pgTableCreator((name) => name);

// --- ENUMS (OPTIMIZADOS) ---
export const quotationStatusEnum = pgEnum('quotation_status', ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CONVERTED_TO_WO']);
export const productionStatusEnum = pgEnum('production_status', ['PLANNED', 'IN_CUTTING', 'ASSEMBLY', 'COMPLETED', 'CANCELLED']);
export const requestDestinationEnum = pgEnum('request_destination', ['WORKSHOP', 'FIELD_SITE']);
export const materialRequestStatusEnum = pgEnum('material_request_status', ['PENDING', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED']);
export const documentTypeEnum = pgEnum('document_type', ['INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'REMISSION_GUIDE', 'PURCHASE_LIQUIDATION']);
export const taxIdTypeEnum = pgEnum('tax_id_type', ['RUC', 'CEDULA', 'PASAPORTE']);
export const personTypeEnum = pgEnum('person_type', ['NATURAL', 'JURIDICA']);
export const sriContributorTypeEnum = pgEnum('sri_contributor_type', ['RIMPE_POPULAR', 'RIMPE_EMPRENDEDOR', 'GENERAL', 'ESP_AGENT']);
export const inventoryStatusEnum = pgEnum('inventory_status', ['AVAILABLE', 'RESERVED', 'SCRAP', 'CONSUMED']);
export const conditionEnum = pgEnum('condition', ['GOOD', 'DAMAGED', 'UNUSABLE']);
export const workOrderStatusEnum = pgEnum('work_order_status', ['DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['DRAFT', 'SIGNED', 'SENDING', 'AUTHORIZED', 'ANNULLED', 'REJECTED']);
export const retentionTypeEnum = pgEnum('retention_type', ['IVA', 'RENTA', 'ISD']);
export const productClassEnum = pgEnum('product_class', ['MATERIAL', 'TOOL', 'EPP', 'ASSET', 'SERVICE', 'MANUFACTURED']); // Agregado SERVICE y MANUFACTURED
export const movementTypeEnum = pgEnum('movement_type', ['PURCHASE', 'SALE', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT', 'ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN']);
export const paymentMethodSriEnum = pgEnum('payment_method_sri', ['01', '16', '19', '20']);
export const bomCalculationTypeEnum = pgEnum('bom_calculation_type', ['FIXED', 'AREA', 'PERIMETER', 'VOLUMEN']);
export const technicalVisitStatusEnum = pgEnum('technical_visit_status', ['SCHEDULED', 'COMPLETED', 'CANCELLED']);
export const justificationTypeEnum = pgEnum('justification_type', ['LIBRE', 'FALTA', 'IESS', 'VACACIONES', 'FERIADO', 'SAB', 'DOM']);

// --- 1. ENTITIES (CORE) ---
export const entities = pgTableV2("entities", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  tax_id: text("tax_id").notNull().unique(),
  tax_id_type: taxIdTypeEnum("tax_id_type").notNull(),
  person_type: personTypeEnum("person_type").default('NATURAL').notNull(),
  business_name: text("business_name").notNull(),
  trade_name: text("trade_name"),
  email_billing: text("email_billing").notNull(),
  phone: text("phone"),
  address_fiscal: text("address_fiscal").notNull(),
  is_client: boolean("is_client").default(false),
  is_supplier: boolean("is_supplier").default(false),
  is_employee: boolean("is_employee").default(false),
  is_carrier: boolean("is_carrier").default(false),
  sri_contributor_type: sriContributorTypeEnum("sri_contributor_type"),
  obligado_contabilidad: boolean("obligado_contabilidad").default(false).notNull(),
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_entities_tax_id").on(t.tax_id),
  index("idx_entities_roles").on(t.is_client, t.is_supplier, t.is_employee, t.is_carrier),
  index("idx_entities_active").on(t.is_active),
]);

export const entityContacts = pgTableV2("entity_contacts", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  entity_id: integer("entity_id").references(() => entities.id, { onDelete: 'cascade' }).notNull(),
  name: text("name").notNull(),
  position: text("position"),
  email: text("email"),
  phone: text("phone"),
  is_primary: boolean("is_primary").default(false), // Para saber a quién enviar la factura
});

export const employeeDetails = pgTableV2("employee_details", {
  entity_id: integer("entity_id").primaryKey().references(() => entities.id, { onDelete: 'cascade' }),
  department: text("department"),
  job_title: text("job_title"),
  salary_base: numeric("salary_base", { precision: 10, scale: 2 }),
  hire_date: date("hire_date"),
  cost_per_hour: numeric("cost_per_hour", { precision: 10, scale: 2 }),
});

export const entityAddresses = pgTableV2("entity_addresses", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  entity_id: integer("entity_id").references(() => entities.id, { onDelete: 'cascade' }).notNull(),
  address_line: text("address_line").notNull(),
  city: text("city"),
  is_main: boolean("is_main").default(false),
});

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
  name_template: text("name_template"),
  is_active: boolean("is_active").default(true),
}, (t) => [
  foreignKey({ columns: [t.parent_id], foreignColumns: [t.id] }),
  index("idx_categories_parent").on(t.parent_id),
]);

export const categoryAttributes = pgTableV2("category_attributes", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  category_id: integer("category_id").references(() => categories.id).notNull(),
  attribute_def_id: integer("attribute_def_id").references(() => attributeDefinitions.id).notNull(),
  required: boolean("required").default(false),
  order: integer("order").default(0),
  specific_options: jsonb("specific_options"),
}, (t) => [unique("unq_cat_attr").on(t.category_id, t.attribute_def_id)]);

// --- 3. PRODUCTS ---
export const products = pgTableV2("products", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  product_class: productClassEnum("product_class").notNull(),

  category_id: integer("category_id").references(() => categories.id),
  brand_id: integer("brand_id").references(() => brands.id),

  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),

  specs: jsonb("specs").default({}),
  description: text("description"),

  // Imagenes optimizadas
  image_urls: text("image_urls").array().default(sql`ARRAY[]::text[]`),

  uom_inventory_code: text("uom_inventory_code").references(() => uom.code),
  uom_consumption_code: text("uom_consumption_code").references(() => uom.code),

  track_dimensional: boolean("track_dimensional").default(false),
  is_service: boolean("is_service").default(false),

  min_stock_alert: numeric("min_stock_alert", { precision: 12, scale: 4 }).default('0'),
  last_cost: numeric("last_cost", { precision: 12, scale: 4 }).default('0'),
  base_price: numeric("base_price", { precision: 12, scale: 4 }).default('0'),
  // Conversión de Unidades (ej. Clavos en Gramos -> Unidades)
  secondary_uom_code: text("secondary_uom_code").references(() => uom.code),
  conversion_factor_secondary: numeric("conversion_factor_secondary", { precision: 12, scale: 4 }).default('1'),
  iva_rate_code: integer("iva_rate_code").default(4).notNull(), // Código SRI (0, 2, 4)

  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_by: integer("updated_by").references(() => authUsers.id),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_products_sku").on(t.sku),
  index("idx_products_specs").using("gin", t.specs),
  index("idx_products_active").on(t.is_active),
]);

export const productDimensions = pgTableV2("product_dimensions", {
  product_id: integer("product_id").primaryKey().references(() => products.id),
  width: numeric("width", { precision: 10, scale: 4 }).default('0'),
  length: numeric("length", { precision: 10, scale: 4 }).default('0'),
  thickness: numeric("thickness", { precision: 10, scale: 4 }).default('0'),
  area: numeric("area", { precision: 12, scale: 4 }), // Calculado
});


export const supplierProducts = pgTableV2("supplier_products", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  supplier_id: integer("supplier_id").references(() => entities.id),
  product_id: integer("product_id").references(() => products.id),
  supplier_sku: text("supplier_sku"),
  supplier_product_name: text("supplier_product_name"),
  purchase_uom: text("purchase_uom").references(() => uom.code),
  conversion_to_inventory_factor: numeric("conversion_to_inventory_factor", { precision: 12, scale: 4 }).default('1'),
  agreed_price: numeric("agreed_price", { precision: 12, scale: 4 }),
  last_purchase_date: date("last_purchase_date"),
}, (t) => [unique("unq_supplier_product").on(t.supplier_id, t.product_id)]);

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
  quantity_on_hand: numeric("quantity_on_hand", { precision: 15, scale: 4 }).default('0'),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.warehouse_id, t.product_id] }),
  index("idx_inv_stock_wh").on(t.warehouse_id),
]);

export const inventoryDimensionalItems = pgTableV2("inventory_dimensional_items", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  warehouse_id: integer("warehouse_id").references(() => warehouses.id),
  product_id: integer("product_id").references(() => products.id),
  parent_item_id: integer("parent_item_id"),

  quantity: numeric("quantity", { precision: 12, scale: 4 }).default('1').notNull(),
  length: numeric("length_mm", { precision: 12, scale: 4 }),
  width: numeric("width_mm", { precision: 12, scale: 4 }),
  area: numeric("area_m2", { precision: 12, scale: 4 }),

  batch_number: text("batch_number"),
  status: inventoryStatusEnum("status").default('AVAILABLE'),
  location_rack: text("location_rack"),

  created_at: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  foreignKey({ columns: [t.parent_item_id], foreignColumns: [t.id] }),
  index("idx_dim_items_avail").on(t.product_id, t.length, t.width).where(sql`status = 'AVAILABLE'`),
  // Optimización: Búsqueda rápida por almacén y estado
  index("idx_dim_items_wh_status").on(t.warehouse_id, t.status),
]);

export const inventoryMovements = pgTableV2("inventory_movements", {
  id: bigint("id", { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  warehouse_id: integer("warehouse_id").references(() => warehouses.id).notNull(),
  product_id: integer("product_id").references(() => products.id).notNull(),
  dimensional_item_id: integer("dimensional_item_id").references(() => inventoryDimensionalItems.id),

  type: movementTypeEnum("type").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull(),

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

// --- 5.1 TECHNICAL VISITS & QUOTATIONS ---
export const technicalVisits = pgTableV2("technical_visits", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  client_id: integer("client_id").references(() => entities.id).notNull(),
  assigned_employee_id: integer("assigned_employee_id").references(() => entities.id),
  visit_date: timestamp("visit_date").notNull(),
  status: technicalVisitStatusEnum("status").default('SCHEDULED'),
  notes: text("notes"),
  evidence_files: text("evidence_files").array().default(sql`ARRAY[]::text[]`),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const quotations = pgTableV2("quotations", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  code_sequence: integer("code_sequence"), // Secuencial interno de cotización
  client_id: integer("client_id").references(() => entities.id).notNull(),
  technical_visit_id: integer("technical_visit_id").references(() => technicalVisits.id),

  status: quotationStatusEnum("status").default('DRAFT'),

  total_amount: numeric("total_amount", { precision: 12, scale: 2 }).default('0'),
  valid_until: date("valid_until"),

  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  created_by: integer("created_by").references(() => authUsers.id),
});

export const quotationItems = pgTableV2("quotation_items", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  quotation_id: integer("quotation_id").references(() => quotations.id, { onDelete: 'cascade' }).notNull(),
  product_id: integer("product_id").references(() => products.id), // Puede ser NULL si es un servicio ad-hoc
  description: text("description").notNull(), // Descripción libre o del producto
  quantity: numeric("quantity", { precision: 12, scale: 4 }).default('1'),
  unit_price: numeric("unit_price", { precision: 12, scale: 4 }).default('0'),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default('0'),
});

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
});

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

  notes: text("notes"), // "Cortar del retazo X"
});

export const manufacturingLog = pgTableV2("manufacturing_log", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  manufacturing_order_id: integer("manufacturing_order_id").references(() => manufacturingOrders.id),

  product_id: integer("product_id").references(() => products.id), // Insumo usado

  quantity_consumed: numeric("quantity_consumed", { precision: 12, scale: 4 }), // Ej: 1 Plancha

  // Si sobró material útil (Retazo)
  scrap_generated: boolean("scrap_generated").default(false),
  scrap_quantity: numeric("scrap_quantity", { precision: 12, scale: 4 }),
});

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

// PLANTILLAS (Kits)
export const requestTemplates = pgTableV2("request_templates", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  name: text("name").notNull(), // "Kit Instalación Básica"
  description: text("description"),
});

export const requestTemplateItems = pgTableV2("request_template_items", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  template_id: integer("template_id").references(() => requestTemplates.id, { onDelete: 'cascade' }),
  product_id: integer("product_id").references(() => products.id),
  default_quantity: numeric("default_quantity", { precision: 12, scale: 4 }),
});

export const bomHeaders = pgTableV2("bom_headers", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  product_id: integer("product_id").references(() => products.id),
  name: text("name"),
  revision: integer("revision").default(1),
});

export const bomDetails = pgTableV2("bom_details", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  bom_id: integer("bom_id").references(() => bomHeaders.id, { onDelete: 'cascade' }),
  component_product_id: integer("component_product_id").references(() => products.id),
  quantity_factor: numeric("quantity_factor", { precision: 12, scale: 4 }).notNull(),
  calculation_type: bomCalculationTypeEnum("calculation_type").default('FIXED').notNull(),
  wastage_percent: numeric("wastage_percent", { precision: 5, scale: 2 }).default('0'),
}, (t) => [unique("unq_bom_component").on(t.bom_id, t.component_product_id)]);


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

// --- 7. ELECTRONIC DOCUMENTS (PADRE) ---
// Centraliza todos los docs SRI para consultas globales
export const electronicDocuments = pgTableV2("electronic_documents", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  type: documentTypeEnum("type").notNull(),
  // Datos SRI
  sri_access_key: text("sri_access_key").unique(),
  sri_authorization_date: timestamp("sri_authorization_date"),
  establishment: text("establishment").notNull(),
  emission_point: text("emission_point").notNull(),
  sequential: integer("sequential").notNull(),

  issue_date: date("issue_date").notNull(),

  // Entidad relacionada (Cliente para factura, Transportista para guía, etc)
  entity_id: integer("entity_id").references(() => entities.id).notNull(),
  work_order_id: integer("work_order_id").references(() => workOrders.id),

  status: invoiceStatusEnum("status").default('DRAFT'),
  sri_error_message: text("sri_error_message"), // Para debugging

  created_at: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  unique("unq_document_identity").on(t.establishment, t.emission_point, t.sequential, t.type),
  index("idx_docs_access_key").on(t.sri_access_key),
  index("idx_docs_type_date").on(t.type, t.issue_date),
]);

// --- HIJO: INVOICES (Facturas & Liquidaciones) ---
export const invoices = pgTableV2("invoices", {
  // PK es FK al padre
  document_id: integer("document_id").primaryKey().references(() => electronicDocuments.id, { onDelete: 'cascade' }),

  // Totales SRI (Renombrados para claridad)
  subtotal_vat: numeric("subtotal_vat", { precision: 12, scale: 2 }).default('0'),
  subtotal_no_vat: numeric("subtotal_no_vat", { precision: 12, scale: 2 }).default('0'),
  subtotal_exempt: numeric("subtotal_exempt", { precision: 12, scale: 2 }).default('0'),
  subtotal_no_obj: numeric("subtotal_no_obj", { precision: 12, scale: 2 }).default('0'),

  discount_total: numeric("discount_total", { precision: 12, scale: 2 }).default('0'),
  tax_vat_amount: numeric("tax_vat_amount", { precision: 12, scale: 2 }).default('0'),
  tip_amount: numeric("tip_amount", { precision: 12, scale: 2 }).default('0'),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),

  // Snapshot del Cliente
  billed_to_name: text("billed_to_name").notNull(),
  billed_to_address: text("billed_to_address").notNull(),
  billed_to_ruc: text("billed_to_ruc").notNull(),

  establishment_address: text("establishment_address"), // Dirección de tu sucursal

  xml_content: text("xml_content"),
  digital_files: text("digital_files").array().default(sql`ARRAY[]::text[]`),
}, (t) => [
  index("idx_invoices_ruc").on(t.billed_to_ruc),
]);

// --- HIJO: REMISSION GUIDES ---
export const remissionGuides = pgTableV2("remission_guides", {
  document_id: integer("document_id").primaryKey().references(() => electronicDocuments.id, { onDelete: 'cascade' }),

  // CONEXIÓN DIRECTA CON EL PEDIDO DE MATERIAL
  // Si destination_type = 'FIELD_SITE', el backend debe crear este registro y llenarlo.
  origin_material_request_id: integer("origin_material_request_id").references(() => materialRequests.id),

  // Documento de venta relacionado (Opcional, a veces trasladas sin haber facturado aun)
  related_invoice_id: integer("related_invoice_id").references(() => electronicDocuments.id),

  carrier_id: integer("carrier_id").references(() => entities.id),
  vehicle_plate: text("vehicle_plate").notNull(),

  start_date: date("start_date").notNull(),
  end_date: date("end_date").notNull(),
  route_origin: text("route_origin").notNull(),
  route_destination: text("route_destination").notNull(), // Se debe pre-llenar con materialRequests.location_detail
  reason: text("reason"),

  evidence_files: text("evidence_files").array().default(sql`ARRAY[]::text[]`),
});

// --- HIJO: CREDIT NOTES ---
export const creditNotes = pgTableV2("credit_notes", {
  document_id: integer("document_id").primaryKey().references(() => electronicDocuments.id, { onDelete: 'cascade' }),
  modified_document_id: integer("modified_document_id").references(() => electronicDocuments.id).notNull(),
  modification_reason: text("modification_reason").notNull(),
  total_modification: numeric("total_modification", { precision: 12, scale: 2 }).notNull(),
});

// --- DETALLES ---
export const invoiceItems = pgTableV2("invoice_items", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  // Referencia a INVOICE (Hijo), no al Documento Genérico
  invoice_id: integer("invoice_id").references(() => invoices.document_id, { onDelete: 'cascade' }).notNull(),
  product_id: integer("product_id").references(() => products.id).notNull(),

  quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull(),
  unit_price: numeric("unit_price", { precision: 12, scale: 4 }).notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).default('0'),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  iva_rate: numeric("iva_rate", { precision: 5, scale: 2 }).notNull(),
  iva_amount: numeric("iva_amount", { precision: 12, scale: 2 }).notNull(),
});

export const invoicePayments = pgTableV2("invoice_payments", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  invoice_id: integer("invoice_id").references(() => invoices.document_id).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  payment_date: date("payment_date").notNull(),
  payment_method_code: paymentMethodSriEnum("payment_method_code").notNull(),
  transaction_reference: text("transaction_reference"),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  created_by: integer("created_by").references(() => authUsers.id),
});

export const taxRetentions = pgTableV2("tax_retentions", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  invoice_id: integer("invoice_id").references(() => invoices.document_id, { onDelete: 'cascade' }),
  retention_type: retentionTypeEnum("retention_type"),
  tax_code: text("tax_code"),
  base_amount: numeric("base_amount", { precision: 12, scale: 2 }),
  percentage: numeric("percentage", { precision: 5, scale: 2 }),
  retained_value: numeric("retained_value", { precision: 12, scale: 2 }),
});

export const documentSequences = pgTableV2("document_sequences", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  establishment: text("establishment").notNull(),
  emission_point: text("emission_point").notNull(),
  document_type: text("document_type").notNull(),
  current_value: integer("current_value").default(0).notNull(),
}, (t) => [unique("unq_seq").on(t.establishment, t.emission_point, t.document_type)]);

// --- 8. AUTH ---
export const authUsers = pgTableV2("auth_users", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  entity_id: integer("entity_id").references(() => entities.id),
  username: text("username").unique().notNull(),
  email: text("email").unique().notNull(),
  password_hash: text("password_hash").notNull(),
  is_active: boolean("is_active").default(true),
  last_login: timestamp("last_login"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const refreshTokens = pgTableV2("refresh_tokens", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  user_id: integer("user_id").references(() => authUsers.id, { onDelete: 'cascade' }).notNull(),
  selector: text("selector").notNull().unique(),
  token_hash: text("token_hash").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  expires_at: timestamp("expires_at").notNull(),
  revoked: boolean("revoked").default(false),
  replaced_by: integer("replaced_by"),
  user_agent: text("user_agent"),
  ip_address: text("ip_address"),
});

export const authRoles = pgTableV2("auth_roles", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  name: text("name").unique().notNull(),
  description: text("description"),
});

export const authPermissions = pgTableV2("auth_permissions", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  slug: text("slug").unique().notNull(),
  description: text("description"),
});

export const authRolePermissions = pgTableV2("auth_role_permissions", {
  role_id: integer("role_id").references(() => authRoles.id, { onDelete: 'cascade' }).notNull(),
  permission_id: integer("permission_id").references(() => authPermissions.id, { onDelete: 'cascade' }).notNull(),
}, (t) => [primaryKey({ columns: [t.role_id, t.permission_id] })]);

export const authUserRoles = pgTableV2("auth_user_roles", {
  user_id: integer("user_id").references(() => authUsers.id, { onDelete: 'cascade' }).notNull(),
  role_id: integer("role_id").references(() => authRoles.id, { onDelete: 'cascade' }).notNull(),
}, (t) => [primaryKey({ columns: [t.user_id, t.role_id] })]);

// --- RELATIONS (CORREGIDAS Y COMPLETAS) ---

// 1. Entities & Contacts
export const entitiesRelations = relations(entities, ({ one, many }) => ({
  employeeDetails: one(employeeDetails, {
    fields: [entities.id],
    references: [employeeDetails.entity_id],
  }),
  addresses: many(entityAddresses),
  contacts: many(entityContacts),
  workSchedules: many(employeeWorkSchedules),
}));

export const entityContactsRelations = relations(entityContacts, ({ one }) => ({
  entity: one(entities, {
    fields: [entityContacts.entity_id],
    references: [entities.id],
  }),
}));

export const employeeWorkSchedulesRelations = relations(employeeWorkSchedules, ({ one }) => ({
  employee: one(entities, { fields: [employeeWorkSchedules.employee_id], references: [entities.id] }),
  workOrder: one(workOrders, { fields: [employeeWorkSchedules.work_order_id], references: [workOrders.id] }),
}));

// 2. Auth & Roles
export const authUserRolesRelations = relations(authUserRoles, ({ one }) => ({
  user: one(authUsers, { fields: [authUserRoles.user_id], references: [authUsers.id] }),
  role: one(authRoles, { fields: [authUserRoles.role_id], references: [authRoles.id] }),
}));

export const authRolesRelations = relations(authRoles, ({ many }) => ({
  permissions: many(authRolePermissions),
  users: many(authUserRoles),
}));

export const authPermissionsRelations = relations(authPermissions, ({ many }) => ({
  roles: many(authRolePermissions),
}));

export const authRolePermissionsRelations = relations(authRolePermissions, ({ one }) => ({
  role: one(authRoles, { fields: [authRolePermissions.role_id], references: [authRoles.id] }),
  permission: one(authPermissions, { fields: [authRolePermissions.permission_id], references: [authPermissions.id] }),
}));

export const authUsersRelations = relations(authUsers, ({ many }) => ({
  roles: many(authUserRoles),
}));

// 3. Products
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.category_id], references: [categories.id] }),
  brand: one(brands, { fields: [products.brand_id], references: [brands.id] }),

  // NUEVO: Relación 1 a 1 con dimensiones
  dimensions: one(productDimensions, {
    fields: [products.id],
    references: [productDimensions.product_id]
  }),

  supplierProducts: many(supplierProducts),
  inventoryStock: many(inventoryStock),
  dimensionalItems: many(inventoryDimensionalItems),
  movements: many(inventoryMovements),
  workOrderItems: many(workOrderItems),
}));

export const productDimensionsRelations = relations(productDimensions, ({ one }) => ({
  product: one(products, {
    fields: [productDimensions.product_id],
    references: [products.id],
  }),
}));

// 4. Inventory
export const warehousesRelations = relations(warehouses, ({ many }) => ({
  movements: many(inventoryMovements),
}));

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  warehouse: one(warehouses, { fields: [inventoryMovements.warehouse_id], references: [warehouses.id] }),
  product: one(products, { fields: [inventoryMovements.product_id], references: [products.id] }),
  dimensionalItem: one(inventoryDimensionalItems, { fields: [inventoryMovements.dimensional_item_id], references: [inventoryDimensionalItems.id] }),
  user: one(authUsers, { fields: [inventoryMovements.created_by], references: [authUsers.id] }),
}));

export const inventoryDimensionalItemsRelations = relations(inventoryDimensionalItems, ({ one, many }) => ({
  product: one(products, { fields: [inventoryDimensionalItems.product_id], references: [products.id] }),
  warehouse: one(warehouses, { fields: [inventoryDimensionalItems.warehouse_id], references: [warehouses.id] }),
  // Un item físico puede haber estado en muchos movimientos
  movements: many(inventoryMovements),
}));

// 5. Electronic Documents (Polimorfismo)
export const electronicDocumentsRelations = relations(electronicDocuments, ({ one }) => ({
  // Relaciones "hacia abajo" (Herencia)
  invoiceDetails: one(invoices, { fields: [electronicDocuments.id], references: [invoices.document_id] }),
  creditNoteDetails: one(creditNotes, { fields: [electronicDocuments.id], references: [creditNotes.document_id] }),
  remissionDetails: one(remissionGuides, { fields: [electronicDocuments.id], references: [remissionGuides.document_id] }),

  // Relación "hacia arriba" (Quien emite/recibe)
  entity: one(entities, { fields: [electronicDocuments.entity_id], references: [entities.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  header: one(electronicDocuments, { fields: [invoices.document_id], references: [electronicDocuments.id] }),
  items: many(invoiceItems),
  payments: many(invoicePayments),
  retentions: many(taxRetentions),
}));

export const remissionGuidesRelations = relations(remissionGuides, ({ one }) => ({
  header: one(electronicDocuments, { fields: [remissionGuides.document_id], references: [electronicDocuments.id] }),
  // La nueva relación vital
  materialRequest: one(materialRequests, {
    fields: [remissionGuides.origin_material_request_id],
    references: [materialRequests.id],
    relationName: 'request_guide'
  }),
  carrier: one(entities, { fields: [remissionGuides.carrier_id], references: [entities.id] }),
}));

export const creditNotesRelations = relations(creditNotes, ({ one }) => ({
  header: one(electronicDocuments, { fields: [creditNotes.document_id], references: [electronicDocuments.id] }),
  originalDoc: one(electronicDocuments, { fields: [creditNotes.modified_document_id], references: [electronicDocuments.id] }),
}));

// 6. Details
export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoice_id], references: [invoices.document_id] }),
  product: one(products, { fields: [invoiceItems.product_id], references: [products.id] }),
}));

export const invoicePaymentsRelations = relations(invoicePayments, ({ one }) => ({
  invoice: one(invoices, { fields: [invoicePayments.invoice_id], references: [invoices.document_id] }),
  registrar: one(authUsers, { fields: [invoicePayments.created_by], references: [authUsers.id] }),
}));

export const taxRetentionsRelations = relations(taxRetentions, ({ one }) => ({
  invoice: one(invoices, { fields: [taxRetentions.invoice_id], references: [invoices.document_id] }),
}));

// 7. Manufacturing & Categories
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, { fields: [categories.parent_id], references: [categories.id], relationName: 'parent_child_cat' }),
  children: many(categories, { relationName: 'parent_child_cat' }),
  products: many(products),
  attributes: many(categoryAttributes),
}));

export const categoryAttributesRelations = relations(categoryAttributes, ({ one }) => ({
  category: one(categories, { fields: [categoryAttributes.category_id], references: [categories.id] }),
  definition: one(attributeDefinitions, { fields: [categoryAttributes.attribute_def_id], references: [attributeDefinitions.id] }),
}));

export const workOrdersRelations = relations(workOrders, ({ one, many }) => ({
  client: one(entities, { fields: [workOrders.client_id], references: [entities.id] }),
  materialRequests: many(materialRequests),
  items: many(workOrderItems),
  workSchedules: many(employeeWorkSchedules),
}));

export const workOrderItemsRelations = relations(workOrderItems, ({ one }) => ({
  workOrder: one(workOrders, { fields: [workOrderItems.work_order_id], references: [workOrders.id] }),
  product: one(products, { fields: [workOrderItems.product_id], references: [products.id] }),
}));