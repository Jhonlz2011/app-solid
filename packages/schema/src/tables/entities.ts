import { text, integer, boolean, timestamp, numeric, date, index, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { pgTableV2, TZ, tenantPolicy } from '../utils';
import { taxIdTypeEnum, personTypeEnum, taxRegimeTypeEnum, contractTypeEnum, workModalityEnum, bankAccountTypeEnum, bloodTypeEnum } from '../enums';
import { companies } from './config';
import { priceLists } from './pricing';

// --- 1. ENTITIES (CORE) ---
export const entities = pgTableV2("entities", {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    tax_id: text("tax_id").notNull(),
    tax_id_type: taxIdTypeEnum("tax_id_type").notNull(),
    person_type: personTypeEnum("person_type").default('NATURAL').notNull(),
    business_name: text("business_name").notNull(),
    trade_name: text("trade_name"),
    email_billing: text("email_billing"),
    phone: text("phone"),
    is_client: boolean("is_client").default(false),
    is_supplier: boolean("is_supplier").default(false),
    is_employee: boolean("is_employee").default(false),
    is_carrier: boolean("is_carrier").default(false),
    is_system: boolean("is_system").default(false),
    tax_regime_type: taxRegimeTypeEnum("tax_regime_type").default('GENERAL'),
    is_retention_agent: boolean("is_retention_agent").default(false),
    is_special_contributor: boolean("is_special_contributor").default(false),
    obligado_contabilidad: boolean("obligado_contabilidad").default(false).notNull(),
    default_price_list_id: integer("default_price_list_id").references(() => priceLists.id),
    is_active: boolean("is_active").default(true),
    updated_at: timestamp("updated_at", TZ)
        .defaultNow()
        .$onUpdate(() => new Date()) // Drizzle actualiza esto automáticamente al hacer un UPDATE
        .notNull(),
    // Soft-delete audit trail
    deleted_at: timestamp("deleted_at", TZ),            // null = active; populated = soft-deleted
    deleted_by: integer("deleted_by"),              // auth user id who triggered the delete
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    uniqueIndex("idx_entities_company_tax_id").on(t.company_id, t.tax_id),
    index("idx_entities_company").on(t.company_id),
    index("idx_entities_roles").on(t.is_client, t.is_supplier, t.is_employee, t.is_carrier),
    index("idx_entities_active").on(t.is_active),
    // Partial index for active suppliers (most common query)
    index("idx_active_suppliers").on(t.company_id, t.id).where(sql`${t.is_supplier} = true AND ${t.is_active} = true`),
    // Composite indexes for sorted pagination (column + id tiebreaker)
    index("idx_entities_business_name_id").on(t.business_name, t.id),
    index("idx_entities_created_at_id").on(t.created_at, t.id),
    tenantPolicy(),
]).enableRLS();

export const entityContacts = pgTableV2("entity_contacts", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    entity_id: uuid("entity_id").references(() => entities.id, { onDelete: 'cascade' }).notNull(),
    name: text("name").notNull(),
    position: text("position"),
    email: text("email"),
    phone: text("phone"),
    is_primary: boolean("is_primary").default(false), // Para saber a quién enviar la factura
}, (t) => [
    index("idx_entity_contacts_entity_id").on(t.entity_id),
]);

// --- 2. DEPARTMENTS & JOB TITLES (CATALOGS) ---
export const departments = pgTableV2("departments", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    name: text("name").notNull(),
    code: text("code"),
    is_active: boolean("is_active").default(true).notNull(),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    uniqueIndex("idx_departments_company_name").on(t.company_id, t.name),
    index("idx_departments_company").on(t.company_id),
    tenantPolicy(),
]).enableRLS();

export const jobTitles = pgTableV2("job_titles", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    department_id: integer("department_id").references(() => departments.id, { onDelete: 'set null' }),
    name: text("name").notNull(),
    is_active: boolean("is_active").default(true).notNull(),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    uniqueIndex("idx_job_titles_company_name").on(t.company_id, t.name),
    index("idx_job_titles_company").on(t.company_id),
    index("idx_job_titles_department").on(t.department_id),
    tenantPolicy(),
]).enableRLS();

export const employeeDetails = pgTableV2("employee_details", {
    entity_id: uuid("entity_id").primaryKey().references(() => entities.id, { onDelete: 'cascade' }),
    department_id: integer("department_id").references(() => departments.id, { onDelete: 'set null' }),
    job_title_id: integer("job_title_id").references(() => jobTitles.id, { onDelete: 'set null' }),
    reports_to: uuid("reports_to").references(() => entities.id, { onDelete: 'set null' }),

    // --- Contratación y Modalidad ---
    hire_date: date("hire_date"),
    termination_date: date("termination_date"),
    contract_type: contractTypeEnum("contract_type").default('INDEFINIDO'),
    work_modality: workModalityEnum("work_modality").default('PRESENCIAL'),

    // --- Compensación y Nómina ---
    salary_base: numeric("salary_base", { precision: 10, scale: 2 }),
    cost_per_hour: numeric("cost_per_hour", { precision: 10, scale: 2 }),

    // --- Nómina & IESS / SRI (Ecuador) ---
    accumulate_thirteenth: boolean("accumulate_thirteenth").default(true).notNull(),
    accumulate_fourteenth: boolean("accumulate_fourteenth").default(true).notNull(),
    accumulate_reserve_funds: boolean("accumulate_reserve_funds").default(true).notNull(),
    iess_code: text("iess_code"),
    dependents_count: integer("dependents_count").default(0).notNull(),

    // --- Datos Bancarios (Cash Management) ---
    bank_name: text("bank_name"),
    bank_account_type: bankAccountTypeEnum("bank_account_type"),
    bank_account_number: text("bank_account_number"),

    // --- Salud ---
    blood_type: bloodTypeEnum("blood_type"),

    // --- Observaciones / Notas Laborales ---
    notes: text("notes"),
}, (t) => [
    index("idx_employee_details_department").on(t.department_id),
    index("idx_employee_details_job_title").on(t.job_title_id),
    index("idx_employee_details_reports_to").on(t.reports_to),
]);

export const entityAddresses = pgTableV2("entity_addresses", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    entity_id: uuid("entity_id").references(() => entities.id, { onDelete: 'cascade' }).notNull(),
    address_line: text("address_line").notNull(),
    country: text("country").default('Ecuador').notNull(),
    country_code: text("country_code").default('EC'),
    state: text("state"), // Provincia (Ecuador) o Estado (Exterior)
    city: text("city"),   // Cantón (Ecuador) o Ciudad (Exterior)
    parish: text("parish"), // Parroquia (Ecuador - muy usado para envíos)
    postal_code: text("postal_code"),
    is_main: boolean("is_main").default(false),
});

// --- 2. VEHÍCULOS DEL TRANSPORTISTA Y FLOTA DE LA EMPRESA (Para la Guía de Remisión) ---
export const carrierVehicles = pgTableV2("carrier_vehicles", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    // NULL = Vehículo de la Flota Propia de la Empresa
    // NOT NULL = Vehículo de un Transportista / Proveedor externo
    carrier_id: uuid("carrier_id").references(() => entities.id, { onDelete: 'cascade' }),
    // OBLIGATORIO PARA SRI: Etiqueta <placa> en el XML de la Guía de Remisión
    license_plate: text("license_plate").notNull(), 
    // Útil para UI del ERP ("Seleccione el camión Hino 500")
    description: text("description"),  
    is_active: boolean("is_active").default(true).notNull(),
}, (t) => [
    index("idx_carrier_vehicles_company_id").on(t.company_id),
    index("idx_carrier_vehicles_carrier_id").on(t.carrier_id),
    // Índice parcial para buscar rápidamente por placa vehículos activos
    index("idx_active_vehicles_plate").on(t.license_plate).where(sql`${t.is_active} = true`),
    tenantPolicy(),
]).enableRLS();

export const carrierDrivers = pgTableV2("carrier_drivers", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    carrier_id: uuid("carrier_id").references(() => entities.id, { onDelete: 'cascade' }).notNull(),
    // SRI y Control Policial: Cédula o pasaporte del conductor real
    identification_number: text("identification_number").notNull(),
    full_name: text("full_name").notNull(),
    // Control interno del ERP
    phone: text("phone"), // Teléfono del chofer para rastreo de ruta
    is_active: boolean("is_active").default(true).notNull(),
}, (t) => [
    index("idx_carrier_drivers_carrier_id").on(t.carrier_id),
]);