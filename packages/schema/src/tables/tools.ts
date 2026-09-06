import { text, integer, boolean, timestamp, numeric, date, index, unique, uuid } from 'drizzle-orm/pg-core';
import { pgTableV2, TZ, tenantPolicy } from '../utils';
import { toolLoanStatusEnum, toolItemStatusEnum, conditionEnum, requestDestinationEnum } from '../enums';
import { companies } from './config';
import { entities } from './entities';
import { productVariants } from './products';
import { warehouseLocations } from './inventory';
import { workOrders } from './manufacturing';

// =============================================================================
// TOOL CRIB / EQUIPMENT CUSTODY MANAGEMENT (Odoo Standard)
// =============================================================================

/**
 * 1. TOOL ITEMS (Physical serialized instances of tools / equipment)
 * For high-value assets requiring unit-level tracking (e.g., Rotary hammers, laser levels, generators).
 */
export const toolItems = pgTableV2("tool_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    variant_id: integer("variant_id").references(() => productVariants.id).notNull(),

    // Identification
    serial_number: text("serial_number"),
    internal_code: text("internal_code").notNull(), // e.g., "TAL-001", "AMOL-003"
    
    // Status and Condition
    status: toolItemStatusEnum("status").default('AVAILABLE').notNull(),
    condition: conditionEnum("condition").default('GOOD').notNull(),

    // Current Home / Storage Location
    location_id: integer("location_id").references(() => warehouseLocations.id),

    notes: text("notes"),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    unique("unq_tool_item_code_company").on(t.company_id, t.internal_code),
    index("idx_tool_items_variant").on(t.variant_id),
    index("idx_tool_items_status").on(t.company_id, t.status),
    index("idx_tool_items_company").on(t.company_id),
    tenantPolicy(),
]).enableRLS();

/**
 * 2. TOOL LOANS (Loan / Custody voucher header)
 * Tracks the custody hand-off from warehouse to an employee.
 */
export const toolLoans = pgTableV2("tool_loans", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    code: text("code").notNull(), // e.g. "PRE-0001", "PRE-2026-001"

    // Parties
    borrower_id: uuid("borrower_id").references(() => entities.id).notNull(), // Custodian (Employee)
    dispatched_by: uuid("dispatched_by").references(() => entities.id).notNull(), // Warehouse clerk who dispatched

    // Operational Context
    work_order_id: integer("work_order_id").references(() => workOrders.id), // Optional link to a work order
    destination_type: requestDestinationEnum("destination_type").default('WORKSHOP').notNull(),
    location_detail: text("location_detail"), // Job site address if FIELD_SITE

    // Dates
    loan_date: timestamp("loan_date", TZ).defaultNow().notNull(),
    expected_return_date: date("expected_return_date").notNull(),
    actual_return_date: timestamp("actual_return_date", TZ),

    status: toolLoanStatusEnum("status").default('DISPATCHED').notNull(),
    notes: text("notes"),

    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    unique("unq_tool_loan_code_company").on(t.company_id, t.code),
    index("idx_tool_loans_borrower").on(t.borrower_id, t.status),
    index("idx_tool_loans_status").on(t.company_id, t.status),
    index("idx_tool_loans_wo").on(t.work_order_id),
    index("idx_tool_loans_dates").on(t.expected_return_date, t.status),
    index("idx_tool_loans_company").on(t.company_id),
    tenantPolicy(),
]).enableRLS();

/**
 * 3. TOOL LOAN ITEMS (Line items of the loan voucher)
 * Supports both quantity-based tools and serialized tool items.
 */
export const toolLoanItems = pgTableV2("tool_loan_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    loan_id: integer("loan_id").references(() => toolLoans.id, { onDelete: 'cascade' }).notNull(),
    variant_id: integer("variant_id").references(() => productVariants.id).notNull(),
    tool_item_id: integer("tool_item_id").references(() => toolItems.id), // Nullable if not serialized

    quantity_loaned: numeric("quantity_loaned", { precision: 12, scale: 4 }).notNull(),
    quantity_returned: numeric("quantity_returned", { precision: 12, scale: 4 }).default('0').notNull(),

    notes: text("notes"),
}, (t) => [
    index("idx_tli_loan").on(t.loan_id),
    index("idx_tli_variant").on(t.variant_id),
    index("idx_tli_tool_item").on(t.tool_item_id),
]);

/**
 * 4. TOOL RETURNS (Return receipt header)
 */
export const toolReturns = pgTableV2("tool_returns", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    loan_id: integer("loan_id").references(() => toolLoans.id, { onDelete: 'cascade' }).notNull(),
    return_date: timestamp("return_date", TZ).defaultNow().notNull(),
    received_by: uuid("received_by").references(() => entities.id).notNull(), // Warehouse clerk who received
    notes: text("notes"),
}, (t) => [
    index("idx_tool_returns_loan").on(t.loan_id),
]);

/**
 * 5. TOOL RETURN ITEMS (Return inspection detail)
 */
export const toolReturnItems = pgTableV2("tool_return_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    return_id: integer("return_id").references(() => toolReturns.id, { onDelete: 'cascade' }).notNull(),
    loan_item_id: integer("loan_item_id").references(() => toolLoanItems.id).notNull(),

    quantity_returned: numeric("quantity_returned", { precision: 12, scale: 4 }).notNull(),
    condition: conditionEnum("condition").default('GOOD').notNull(),
    damage_notes: text("damage_notes"),
    requires_maintenance: boolean("requires_maintenance").default(false).notNull(),
}, (t) => [
    index("idx_tri_return").on(t.return_id),
    index("idx_tri_loan_item").on(t.loan_item_id),
]);
