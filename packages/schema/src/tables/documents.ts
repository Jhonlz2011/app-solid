import { text, integer, timestamp, numeric, date, index, unique, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pgTableV2, TZ, tenantPolicy } from '../utils';
import { documentTypeEnum, invoiceStatusEnum, paymentMethodSriEnum, retentionTypeEnum, paymentStatusEnum } from '../enums';
import { entities } from './entities';
import { workOrders } from './manufacturing';
import { materialRequests } from './requests';
import { products, productVariants } from './products';
import { authUsers } from './auth';
import { companies } from './config';

// --- 7. ELECTRONIC DOCUMENTS (PADRE) ---
// Centraliza todos los docs SRI para consultas globales
export const electronicDocuments = pgTableV2("electronic_documents", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    type: documentTypeEnum("type").notNull(),
    // Datos SRI
    sri_access_key: text("sri_access_key").unique(),
    sri_authorization_date: timestamp("sri_authorization_date", TZ),
    establishment: text("establishment").notNull(),
    emission_point: text("emission_point").notNull(),
    sequential: integer("sequential").notNull(),

    issue_date: date("issue_date").notNull(),

    // Entidad relacionada (Cliente para factura, Transportista para guía, etc)
    entity_id: integer("entity_id").references(() => entities.id, { onDelete: 'cascade' }).notNull(),
    work_order_id: integer("work_order_id").references(() => workOrders.id),

    status: invoiceStatusEnum("status").default('DRAFT'),
    sri_error_message: text("sri_error_message"), // Para debugging

    // SRI Environment (1=Pruebas, 2=Producción)
    sri_environment: text("sri_environment").default('2').notNull(),

    // XML version
    xml_version: text("xml_version").default('1.0.0'),

    // Hash of signed document
    signature_hash: text("signature_hash"),

    // Authorization deadline (for contingency)
    sri_deadline: timestamp("sri_deadline", TZ),

    // Number of send attempts
    retry_count: integer("retry_count").default(0),

    // Emission code (1=Normal, 2=Contingencia)
    emission_type: text("emission_type").default('1'),

    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
    updated_at: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    unique("unq_document_identity").on(t.company_id, t.establishment, t.emission_point, t.sequential, t.type),
    index("idx_docs_access_key").on(t.sri_access_key),
    index("idx_docs_type_date").on(t.type, t.issue_date),
    index("idx_docs_status").on(t.status),
    index("idx_docs_company").on(t.company_id),
    index("idx_docs_company_type").on(t.company_id, t.type, t.issue_date),
    tenantPolicy(),
]).enableRLS();

// --- HIJO: INVOICES (Facturas & Liquidaciones) ---
export const invoices = pgTableV2("invoices", {
    // PK es FK al padre
    document_id: integer("document_id").primaryKey().references(() => electronicDocuments.id, { onDelete: 'cascade' }),

    // Totales SRI
    subtotal_vat: numeric("subtotal_vat", { precision: 12, scale: 2 }).default('0'),
    subtotal_no_vat: numeric("subtotal_no_vat", { precision: 12, scale: 2 }).default('0'),
    subtotal_exempt: numeric("subtotal_exempt", { precision: 12, scale: 2 }).default('0'),
    subtotal_no_obj: numeric("subtotal_no_obj", { precision: 12, scale: 2 }).default('0'),

    discount_total: numeric("discount_total", { precision: 12, scale: 2 }).default('0'),
    tax_vat_amount: numeric("tax_vat_amount", { precision: 12, scale: 2 }).default('0'),
    tip_amount: numeric("tip_amount", { precision: 12, scale: 2 }).default('0'),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),

    // Payment tracking
    payment_status: paymentStatusEnum("payment_status").default('PENDING'),

    // Snapshot del Cliente
    billed_to_name: text("billed_to_name").notNull(),
    billed_to_address: text("billed_to_address").notNull(),
    billed_to_ruc: text("billed_to_ruc").notNull(),

    establishment_address: text("establishment_address"),

    // Currency (always USD for Ecuador but required by XML)
    currency: text("currency").default('DOLAR').notNull(),

    // Additional info (free fields in voucher)
    additional_info: jsonb("additional_info"),

    xml_content: text("xml_content"),
    digital_files: text("digital_files").array().default(sql`ARRAY[]::text[]`),
}, (t) => [
    index("idx_invoices_ruc").on(t.billed_to_ruc),
    index("idx_invoices_payment_status").on(t.payment_status),
]);

// --- HIJO: REMISSION GUIDES ---
export const remissionGuides = pgTableV2("remission_guides", {
    document_id: integer("document_id").primaryKey().references(() => electronicDocuments.id, { onDelete: 'cascade' }),

    // CONEXIÓN DIRECTA CON EL PEDIDO DE MATERIAL
    origin_material_request_id: integer("origin_material_request_id").references(() => materialRequests.id),

    // Documento de venta relacionado
    related_invoice_id: integer("related_invoice_id").references(() => electronicDocuments.id),

    carrier_id: integer("carrier_id").references(() => entities.id),
    vehicle_plate: text("vehicle_plate").notNull(),

    start_date: date("start_date").notNull(),
    end_date: date("end_date").notNull(),
    route_origin: text("route_origin").notNull(),
    route_destination: text("route_destination").notNull(),
    reason: text("reason"),

    // Supporting document for transport
    supporting_doc_type: text("supporting_doc_type"),
    supporting_doc_number: text("supporting_doc_number"),

    evidence_files: text("evidence_files").array().default(sql`ARRAY[]::text[]`),
});

// --- HIJO: CREDIT NOTES ---
export const creditNotes = pgTableV2("credit_notes", {
    document_id: integer("document_id").primaryKey().references(() => electronicDocuments.id, { onDelete: 'cascade' }),
    modified_document_id: integer("modified_document_id").references(() => electronicDocuments.id).notNull(),
    modification_reason: text("modification_reason").notNull(),
    total_modification: numeric("total_modification", { precision: 12, scale: 2 }).notNull(),
});

// --- HIJO: DEBIT NOTES (Notas de Débito) ---
export const debitNotes = pgTableV2("debit_notes", {
    document_id: integer("document_id").primaryKey().references(() => electronicDocuments.id, { onDelete: 'cascade' }),
    modified_document_id: integer("modified_document_id").references(() => electronicDocuments.id).notNull(),
    modification_reason: text("modification_reason").notNull(),
    // SRI totals
    subtotal_vat: numeric("subtotal_vat", { precision: 12, scale: 2 }).default('0'),
    subtotal_no_vat: numeric("subtotal_no_vat", { precision: 12, scale: 2 }).default('0'),
    tax_vat_amount: numeric("tax_vat_amount", { precision: 12, scale: 2 }).default('0'),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
});

// --- HIJO: PURCHASE LIQUIDATIONS (Liquidaciones de Compra) ---
// Required when purchasing from individuals without RUC (artisans, informal suppliers)
export const purchaseLiquidations = pgTableV2("purchase_liquidations", {
    document_id: integer("document_id").primaryKey().references(() => electronicDocuments.id, { onDelete: 'cascade' }),
    // Supplier snapshot (may not be in entities if informal)
    supplier_name: text("supplier_name").notNull(),
    supplier_identification: text("supplier_identification").notNull(),
    supplier_identification_type: text("supplier_identification_type").notNull(), // CEDULA, PASAPORTE
    supplier_address: text("supplier_address"),
    // Totals
    subtotal_vat: numeric("subtotal_vat", { precision: 12, scale: 2 }).default('0'),
    subtotal_no_vat: numeric("subtotal_no_vat", { precision: 12, scale: 2 }).default('0'),
    tax_vat_amount: numeric("tax_vat_amount", { precision: 12, scale: 2 }).default('0'),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
});

// --- HIJO: WITHHOLDING RECEIPTS (Comprobantes de Retención) ---
// Emitted when YOUR company (as withholding agent) retains taxes from purchase invoices
export const withholdingReceipts = pgTableV2("withholding_receipts", {
    document_id: integer("document_id").primaryKey().references(() => electronicDocuments.id, { onDelete: 'cascade' }),
    // The purchase invoice being retained against
    supplier_invoice_number: text("supplier_invoice_number").notNull(),
    supplier_invoice_date: date("supplier_invoice_date").notNull(),
    supplier_id: integer("supplier_id").references(() => entities.id).notNull(),
    fiscal_period: text("fiscal_period").notNull(), // "2026-04"
    total_retained: numeric("total_retained", { precision: 12, scale: 2 }).notNull(),
}, (t) => [
    index("idx_wh_receipts_supplier").on(t.supplier_id),
    index("idx_wh_receipts_period").on(t.fiscal_period),
]);

// Withholding receipt line items (IVA, Renta, ISD details)
export const withholdingReceiptDetails = pgTableV2("withholding_receipt_details", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    receipt_document_id: integer("receipt_document_id").references(() => withholdingReceipts.document_id, { onDelete: 'cascade' }).notNull(),
    tax_type: retentionTypeEnum("tax_type").notNull(),     // IVA, RENTA, ISD
    tax_code: text("tax_code").notNull(),                  // SRI tax code (e.g., "303", "312")
    base_amount: numeric("base_amount", { precision: 12, scale: 2 }).notNull(),
    percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
    retained_value: numeric("retained_value", { precision: 12, scale: 2 }).notNull(),
}, (t) => [
    index("idx_wh_details_receipt").on(t.receipt_document_id),
]);

// --- DETALLES ---
// Invoice items sell SPECIFIC variants
export const invoiceItems = pgTableV2("invoice_items", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    invoice_id: integer("invoice_id").references(() => invoices.document_id, { onDelete: 'cascade' }).notNull(),
    // Primary: the variant (= SKU) being invoiced
    variant_id: integer("variant_id").references(() => productVariants.id).notNull(),

    // Override del nombre del producto para el XML SRI (si difiere)
    // NULL = usa variant display name
    description: text("description"),

    quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull(),
    unit_price: numeric("unit_price", { precision: 12, scale: 4 }).notNull(),
    discount: numeric("discount", { precision: 12, scale: 2 }).default('0'),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    iva_rate: numeric("iva_rate", { precision: 5, scale: 2 }).notNull(),
    iva_amount: numeric("iva_amount", { precision: 12, scale: 2 }).notNull(),
}, (t) => [
    index("idx_invoice_items_invoice").on(t.invoice_id),
]);

export const invoicePayments = pgTableV2("invoice_payments", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    invoice_id: integer("invoice_id").references(() => invoices.document_id).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    payment_date: date("payment_date").notNull(),
    payment_method_code: paymentMethodSriEnum("payment_method_code").notNull(),
    transaction_reference: text("transaction_reference"),
    notes: text("notes"),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
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
    company_id: integer("company_id").references(() => companies.id).notNull(),
    establishment: text("establishment").notNull(),
    emission_point: text("emission_point").notNull(),
    document_type: text("document_type").notNull(),
    current_value: integer("current_value").default(0).notNull(),
}, (t) => [
    unique("unq_seq").on(t.company_id, t.establishment, t.emission_point, t.document_type),
    tenantPolicy(),
]).enableRLS();
