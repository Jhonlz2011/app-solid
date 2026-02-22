import { text, integer, boolean, timestamp, numeric, date, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pgTableV2 } from '../utils';
import { taxIdTypeEnum, personTypeEnum, sriContributorTypeEnum } from '../enums';

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
    // Partial index for active suppliers (most common query)
    index("idx_active_suppliers").on(t.id).where(sql`${t.is_supplier} = true AND ${t.is_active} = true`),
    // Composite indexes for sorted pagination (column + id tiebreaker)
    index("idx_entities_business_name_id").on(t.business_name, t.id),
    index("idx_entities_created_at_id").on(t.created_at, t.id),
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
