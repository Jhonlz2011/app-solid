import { text, integer, boolean, timestamp, numeric, date, index, unique } from 'drizzle-orm/pg-core';
import { pgTableV2, TZ, tenantPolicy } from '../utils';
import { paymentStatusEnum, purchaseQuoteStatusEnum } from '../enums';
import { companies } from './config';
import { entities } from './entities';
import { electronicDocuments } from './documents';
import { purchaseOrders } from './suppliers';
import { productVariants } from './products';
import { authUsers } from './auth';
import { uom } from './config';

// =============================================================================
// ACCOUNTS RECEIVABLE — Cuentas por Cobrar
// =============================================================================

/**
 * Each row = one receivable linked to an electronic document (invoice).
 * Tracks total, amount paid, and balance for aging reports and collection management.
 */
export const accountsReceivable = pgTableV2("accounts_receivable", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    document_id: integer("document_id").references(() => electronicDocuments.id).notNull(),
    entity_id: integer("entity_id").references(() => entities.id).notNull(),  // Client

    total_amount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    amount_paid: numeric("amount_paid", { precision: 12, scale: 2 }).default('0').notNull(),
    balance: numeric("balance", { precision: 12, scale: 2 }).notNull(),

    due_date: date("due_date").notNull(),
    status: paymentStatusEnum("status").default('PENDING').notNull(),

    notes: text("notes"),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_ar_company").on(t.company_id),
    index("idx_ar_entity").on(t.entity_id),
    index("idx_ar_status").on(t.company_id, t.status),
    index("idx_ar_due_date").on(t.company_id, t.due_date),
    index("idx_ar_document").on(t.document_id),
    tenantPolicy(),
]).enableRLS();

// =============================================================================
// ACCOUNTS PAYABLE — Cuentas por Pagar
// =============================================================================

export const accountsPayable = pgTableV2("accounts_payable", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    purchase_order_id: integer("purchase_order_id").references(() => purchaseOrders.id),
    // Supplier invoice reference (external document)
    supplier_invoice_number: text("supplier_invoice_number"),
    supplier_invoice_date: date("supplier_invoice_date"),
    entity_id: integer("entity_id").references(() => entities.id).notNull(),  // Supplier

    total_amount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    amount_paid: numeric("amount_paid", { precision: 12, scale: 2 }).default('0').notNull(),
    balance: numeric("balance", { precision: 12, scale: 2 }).notNull(),

    due_date: date("due_date").notNull(),
    status: paymentStatusEnum("status").default('PENDING').notNull(),

    notes: text("notes"),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_ap_company").on(t.company_id),
    index("idx_ap_entity").on(t.entity_id),
    index("idx_ap_status").on(t.company_id, t.status),
    index("idx_ap_due_date").on(t.company_id, t.due_date),
    index("idx_ap_po").on(t.purchase_order_id),
    tenantPolicy(),
]).enableRLS();

// =============================================================================
// FISCAL PERIODS — Control de cierres mensuales
// =============================================================================

export const fiscalPeriods = pgTableV2("fiscal_periods", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    is_closed: boolean("is_closed").default(false).notNull(),
    closed_by: integer("closed_by").references(() => authUsers.id),
    closed_at: timestamp("closed_at", TZ),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    unique("unq_fiscal_period").on(t.company_id, t.year, t.month),
    index("idx_fiscal_company").on(t.company_id),
    tenantPolicy(),
]).enableRLS();

// =============================================================================
// PURCHASE QUOTES — Cotización de Compra
// =============================================================================

export const purchaseQuotes = pgTableV2("purchase_quotes", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    code_sequence: integer("code_sequence"),
    supplier_id: integer("supplier_id").references(() => entities.id).notNull(),
    status: purchaseQuoteStatusEnum("status").default('DRAFT').notNull(),

    // Totals
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default('0'),
    tax_total: numeric("tax_total", { precision: 12, scale: 2 }).default('0'),
    total: numeric("total", { precision: 12, scale: 2 }).default('0'),

    valid_until: date("valid_until"),
    notes: text("notes"),

    // If converted, link to PO
    converted_po_id: integer("converted_po_id").references(() => purchaseOrders.id),

    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    created_by: integer("created_by").references(() => authUsers.id),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_pq_company").on(t.company_id),
    index("idx_pq_supplier").on(t.supplier_id),
    index("idx_pq_status").on(t.status),
    tenantPolicy(),
]).enableRLS();

export const purchaseQuoteItems = pgTableV2("purchase_quote_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    quote_id: integer("quote_id").references(() => purchaseQuotes.id, { onDelete: 'cascade' }).notNull(),
    variant_id: integer("variant_id").references(() => productVariants.id).notNull(),
    description: text("description"),
    quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull(),
    unit_price: numeric("unit_price", { precision: 12, scale: 4 }).notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    iva_rate: numeric("iva_rate", { precision: 5, scale: 2 }).default('0'),
    iva_amount: numeric("iva_amount", { precision: 12, scale: 2 }).default('0'),
    purchase_uom: integer("purchase_uom").references(() => uom.id),
}, (t) => [
    index("idx_pqi_quote").on(t.quote_id),
    index("idx_pqi_variant").on(t.variant_id),
]);
