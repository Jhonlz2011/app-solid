import { text, integer, timestamp, numeric, date, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pgTableV2, TZ } from '../utils';
import { technicalVisitStatusEnum, quotationStatusEnum } from '../enums';
import { entities } from './entities';
import { authUsers } from './auth';
import { productVariants } from './products';

// --- 5.1 TECHNICAL VISITS & QUOTATIONS ---
export const technicalVisits = pgTableV2("technical_visits", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    client_id: integer("client_id").references(() => entities.id).notNull(),
    assigned_employee_id: integer("assigned_employee_id").references(() => entities.id),
    visit_date: timestamp("visit_date", TZ).notNull(),
    status: technicalVisitStatusEnum("status").default('SCHEDULED'),
    notes: text("notes"),
    evidence_files: text("evidence_files").array().default(sql`ARRAY[]::text[]`),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_visits_client").on(t.client_id),
    index("idx_visits_date").on(t.visit_date),
]);

export const quotations = pgTableV2("quotations", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    code_sequence: integer("code_sequence"), // Secuencial interno de cotización
    client_id: integer("client_id").references(() => entities.id).notNull(),
    technical_visit_id: integer("technical_visit_id").references(() => technicalVisits.id),

    status: quotationStatusEnum("status").default('DRAFT'),

    total_amount: numeric("total_amount", { precision: 12, scale: 2 }).default('0'),
    valid_until: date("valid_until"),

    notes: text("notes"),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    created_by: integer("created_by").references(() => authUsers.id),
}, (t) => [
    index("idx_quotations_client").on(t.client_id),
    index("idx_quotations_status").on(t.status),
    index("idx_quotations_date").on(t.created_at),
]);

export const quotationItems = pgTableV2("quotation_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    quotation_id: integer("quotation_id").references(() => quotations.id, { onDelete: 'cascade' }).notNull(),
    variant_id: integer("variant_id").references(() => productVariants.id),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 4 }).default('1'),
    unit_price: numeric("unit_price", { precision: 12, scale: 4 }).default('0'),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default('0'),
    iva_rate: numeric("iva_rate", { precision: 5, scale: 2 }).default('0'),
    iva_amount: numeric("iva_amount", { precision: 12, scale: 2 }).default('0'),
}, (t) => [
    index("idx_quotation_items_quotation").on(t.quotation_id),
]);
