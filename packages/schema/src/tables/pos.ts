import { text, integer, boolean, timestamp, numeric, index } from 'drizzle-orm/pg-core';
import { pgTableV2 } from '../utils';
import { posSessionStatusEnum, saleOriginEnum, paymentMethodSriEnum } from '../enums';
import { warehouses, inventoryDimensionalItems } from './inventory';
import { authUsers } from './auth';
import { entities } from './entities';
import { electronicDocuments } from './documents';
import { products } from './products';

// --- 10. POS (POINT OF SALE) ---

// Cash registers / POS terminals
export const cashRegisters = pgTableV2("cash_registers", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    name: text("name").notNull(), // "Caja 1", "Mostrador Principal"
    warehouse_id: integer("warehouse_id").references(() => warehouses.id), // From which warehouse it sells
    establishment: text("establishment").notNull(), // SRI establishment code
    emission_point: text("emission_point").notNull(), // SRI emission point
    is_active: boolean("is_active").default(true),
});

// POS Sessions (daily opening/closing)
export const posSessions = pgTableV2("pos_sessions", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    cash_register_id: integer("cash_register_id").references(() => cashRegisters.id).notNull(),

    opened_by: integer("opened_by").references(() => authUsers.id).notNull(),
    opened_at: timestamp("opened_at").defaultNow().notNull(),
    opening_balance: numeric("opening_balance", { precision: 12, scale: 2 }).default('0').notNull(),

    closed_by: integer("closed_by").references(() => authUsers.id),
    closed_at: timestamp("closed_at"),
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

    sale_origin: saleOriginEnum("sale_origin").default('POS').notNull(),

    // Totals
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default('0').notNull(),
    discount_total: numeric("discount_total", { precision: 12, scale: 2 }).default('0'),
    tax_total: numeric("tax_total", { precision: 12, scale: 2 }).default('0').notNull(),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),

    // Payment info (simplified for POS)
    payment_method: paymentMethodSriEnum("payment_method").notNull(),
    amount_received: numeric("amount_received", { precision: 12, scale: 2 }),
    change_given: numeric("change_given", { precision: 12, scale: 2 }),

    created_at: timestamp("created_at").defaultNow().notNull(),
    created_by: integer("created_by").references(() => authUsers.id).notNull(),
}, (t) => [
    index("idx_pos_sales_session").on(t.session_id),
    index("idx_pos_sales_date").on(t.created_at),
    index("idx_pos_sales_client").on(t.client_id),
]);

// POS Sale Items
export const posSaleItems = pgTableV2("pos_sale_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    sale_id: integer("sale_id").references(() => posSales.id, { onDelete: 'cascade' }).notNull(),
    product_id: integer("product_id").references(() => products.id).notNull(),

    quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull(),
    unit_price: numeric("unit_price", { precision: 12, scale: 4 }).notNull(),
    discount: numeric("discount", { precision: 12, scale: 2 }).default('0'),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),

    iva_rate: numeric("iva_rate", { precision: 5, scale: 2 }).notNull(),
    iva_amount: numeric("iva_amount", { precision: 12, scale: 2 }).notNull(),

    // For dimensional products, track which item was sold
    dimensional_item_id: integer("dimensional_item_id").references(() => inventoryDimensionalItems.id),
}, (t) => [
    index("idx_pos_items_sale").on(t.sale_id),
]);
