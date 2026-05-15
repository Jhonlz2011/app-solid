import { text, integer, boolean, timestamp, numeric, index } from 'drizzle-orm/pg-core';
import { pgTableV2, TZ } from '../utils';
import { posSessionStatusEnum, paymentMethodSriEnum } from '../enums';
import { warehouses, warehouseLocations } from './inventory';
import { authUsers } from './auth';
import { entities } from './entities';
import { electronicDocuments } from './documents';
import { productVariants } from './products';
import { companies } from './config';

// --- 10. POS (POINT OF SALE) ---

// Cash registers / POS terminals
export const cashRegisters = pgTableV2("cash_registers", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    name: text("name").notNull(), // "Caja 1", "Mostrador Principal"
    warehouse_id: integer("warehouse_id").references(() => warehouses.id), // From which warehouse it sells
    default_location_id: integer("default_location_id").references(() => warehouseLocations.id), // Ubicación predeterminada para descontar stock
    establishment: text("establishment").notNull(), // SRI establishment code
    emission_point: text("emission_point").notNull(), // SRI emission point
    is_active: boolean("is_active").default(true),
}, (t) => [
    index("idx_cash_registers_company").on(t.company_id),
]);

// POS Sessions (daily opening/closing)
export const posSessions = pgTableV2("pos_sessions", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    cash_register_id: integer("cash_register_id").references(() => cashRegisters.id).notNull(),

    opened_by: integer("opened_by").references(() => authUsers.id).notNull(),
    opened_at: timestamp("opened_at", TZ).defaultNow().notNull(),
    opening_balance: numeric("opening_balance", { precision: 12, scale: 2 }).default('0').notNull(),

    closed_by: integer("closed_by").references(() => authUsers.id),
    closed_at: timestamp("closed_at", TZ),
    closing_balance: numeric("closing_balance", { precision: 12, scale: 2 }),

    // Cash counted at closing
    cash_counted: numeric("cash_counted", { precision: 12, scale: 2 }),
    difference: numeric("difference", { precision: 12, scale: 2 }), // Expected vs Counted

    status: posSessionStatusEnum("status").default('OPEN').notNull(),
    notes: text("notes"),
}, (t) => [
    index("idx_pos_sessions_status").on(t.status),
    index("idx_pos_sessions_register").on(t.cash_register_id, t.status),
]);

// POS Sales (quick direct sales without work orders)
export const posSales = pgTableV2("pos_sales", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),

    session_id: integer("session_id").references(() => posSessions.id).notNull(),

    // Optional client (for "Consumidor Final" use null)
    client_id: integer("client_id").references(() => entities.id),

    // Link to electronic document when generated
    document_id: integer("document_id").references(() => electronicDocuments.id),

    // Totals
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default('0').notNull(),
    discount_total: numeric("discount_total", { precision: 12, scale: 2 }).default('0'),
    tax_total: numeric("tax_total", { precision: 12, scale: 2 }).default('0').notNull(),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),

    // Cambio entregado al cliente (calculado: SUM(payments.amount) - total)
    change_given: numeric("change_given", { precision: 12, scale: 2 }),

    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    created_by: integer("created_by").references(() => authUsers.id).notNull(),
}, (t) => [
    index("idx_pos_sales_session").on(t.session_id),
    index("idx_pos_sales_date").on(t.created_at),
    index("idx_pos_sales_client").on(t.client_id),
]);

// POS Sale Payments (supports multi-payment: $50 cash + $30 transfer)
export const posSalePayments = pgTableV2("pos_sale_payments", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    sale_id: integer("sale_id").references(() => posSales.id, { onDelete: 'cascade' }).notNull(),
    payment_method: paymentMethodSriEnum("payment_method").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    // Para transferencias/tarjetas
    transaction_reference: text("transaction_reference"),
}, (t) => [
    index("idx_pos_payments_sale").on(t.sale_id),
]);

// POS Sale Items — sell SPECIFIC variants
export const posSaleItems = pgTableV2("pos_sale_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    sale_id: integer("sale_id").references(() => posSales.id, { onDelete: 'cascade' }).notNull(),
    // Primary: the variant (= SKU) being sold
    variant_id: integer("variant_id").references(() => productVariants.id).notNull(),

    // Multi-location: de qué ubicación se descuenta este ítem
    location_id: integer("location_id").references(() => warehouseLocations.id),

    quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull(),
    unit_price: numeric("unit_price", { precision: 12, scale: 4 }).notNull(),
    discount: numeric("discount", { precision: 12, scale: 2 }).default('0'),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),

    iva_rate: numeric("iva_rate", { precision: 5, scale: 2 }).notNull(),
    iva_amount: numeric("iva_amount", { precision: 12, scale: 2 }).notNull(),
}, (t) => [
    index("idx_pos_items_sale").on(t.sale_id),
]);