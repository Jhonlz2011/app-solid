import { Type, type Static } from '@sinclair/typebox';

// ============================================================================
// INVOICING, ELECTRONIC DOCUMENTS & QUOTATIONS
// ============================================================================

export const DocumentTypeSchema = Type.Union([
    Type.Literal('INVOICE'),
    Type.Literal('CREDIT_NOTE'),
    Type.Literal('DEBIT_NOTE'),
    Type.Literal('REMISSION_GUIDE'),
    Type.Literal('PURCHASE_LIQUIDATION'),
    Type.Literal('WITHHOLDING'),
]);

export const InvoiceTypeSchema = Type.Union([
    Type.Literal('INVOICE'),
    Type.Literal('PURCHASE_LIQUIDATION'),
]);

export const InvoiceStatusSchema = Type.Union([
    Type.Literal('DRAFT'),
    Type.Literal('SIGNED'),
    Type.Literal('SENDING'),
    Type.Literal('AUTHORIZED'),
    Type.Literal('ANNULLED'),
    Type.Literal('REJECTED'),
]);

export const DocumentStatusSchema = InvoiceStatusSchema;

export const PaymentMethodSriSchema = Type.Union([
    Type.Literal('01'),
    Type.Literal('15'),
    Type.Literal('16'),
    Type.Literal('17'),
    Type.Literal('18'),
    Type.Literal('19'),
    Type.Literal('20'),
    Type.Literal('21'),
]);

export const RetentionTypeSchema = Type.Union([
    Type.Literal('IVA'),
    Type.Literal('RENTA'),
    Type.Literal('ISD'),
]);

export const InvoiceItemPayloadSchema = Type.Object({
    productId: Type.Number(),
    quantity: Type.Number({ minimum: 0.0001 }),
    unitPrice: Type.Number({ minimum: 0 }),
    discount: Type.Optional(Type.Number()),
    ivaRate: Type.Number(),
});

export const InvoiceCreateSchema = Type.Object({
    entityId: Type.Number(),
    workOrderId: Type.Optional(Type.Number()),
    type: InvoiceTypeSchema,
    establishment: Type.String({ minLength: 3, maxLength: 3 }),
    emissionPoint: Type.String({ minLength: 3, maxLength: 3 }),
    issueDate: Type.String(),
    billedToName: Type.String(),
    billedToAddress: Type.String(),
    billedToRuc: Type.String(),
    establishmentAddress: Type.Optional(Type.String()),
    items: Type.Array(InvoiceItemPayloadSchema),
});

export const InvoiceStatusUpdateSchema = Type.Object({
    status: InvoiceStatusSchema,
    xmlContent: Type.Optional(Type.String()),
    sriAccessKey: Type.Optional(Type.String()),
});

export const DocumentStatusUpdateSchema = Type.Object({
    status: DocumentStatusSchema,
    errorMessage: Type.Optional(Type.String()),
});

export const InvoicePaymentCreateSchema = Type.Object({
    amount: Type.Number({ minimum: 0.01 }),
    paymentDate: Type.String(),
    paymentMethodCode: PaymentMethodSriSchema,
    transactionReference: Type.Optional(Type.String()),
    notes: Type.Optional(Type.String()),
});

export const InvoiceRetentionCreateSchema = Type.Object({
    retentionType: RetentionTypeSchema,
    taxCode: Type.String(),
    baseAmount: Type.Number({ minimum: 0 }),
    percentage: Type.Number({ minimum: 0, maximum: 100 }),
});

export const InvoiceListQuerySchema = Type.Object({
    type: Type.Optional(Type.String()),
    status: Type.Optional(Type.String()),
    entityId: Type.Optional(Type.Number()),
    limit: Type.Optional(Type.Number()),
    offset: Type.Optional(Type.Number()),
});

export const DocumentListQuerySchema = Type.Object({
    type: Type.Optional(Type.String()),
    status: Type.Optional(Type.String()),
    entityId: Type.Optional(Type.Number()),
    fromDate: Type.Optional(Type.String()),
    toDate: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Number()),
    offset: Type.Optional(Type.Number()),
});

export type DocumentTypeType = Static<typeof DocumentTypeSchema>;
export type InvoiceTypeType = Static<typeof InvoiceTypeSchema>;
export type InvoiceStatusType = Static<typeof InvoiceStatusSchema>;
export type DocumentStatusType = Static<typeof DocumentStatusSchema>;
export type PaymentMethodSriType = Static<typeof PaymentMethodSriSchema>;
export type RetentionTypeType = Static<typeof RetentionTypeSchema>;
export type InvoiceItemPayloadType = Static<typeof InvoiceItemPayloadSchema>;
export type InvoiceCreateType = Static<typeof InvoiceCreateSchema>;
export type InvoiceStatusUpdateType = Static<typeof InvoiceStatusUpdateSchema>;
export type DocumentStatusUpdateType = Static<typeof DocumentStatusUpdateSchema>;
export type InvoicePaymentCreateType = Static<typeof InvoicePaymentCreateSchema>;
export type InvoiceRetentionCreateType = Static<typeof InvoiceRetentionCreateSchema>;
export type InvoiceListQueryType = Static<typeof InvoiceListQuerySchema>;
export type DocumentListQueryType = Static<typeof DocumentListQuerySchema>;

// Quotations
export const QuotationStatusSchema = Type.Union([
    Type.Literal('DRAFT'),
    Type.Literal('SENT'),
    Type.Literal('APPROVED'),
    Type.Literal('REJECTED'),
    Type.Literal('CONVERTED_TO_WO'),
]);

export const QuotationItemCreateSchema = Type.Object({
    product_id: Type.Optional(Type.Number()),
    description: Type.String(),
    quantity: Type.String(),
    unit_price: Type.String(),
    subtotal: Type.String(),
});

export const QuotationCreateSchema = Type.Object({
    client_id: Type.Number(),
    technical_visit_id: Type.Optional(Type.Number()),
    total_amount: Type.Optional(Type.String()),
    valid_until: Type.Optional(Type.String()),
    notes: Type.Optional(Type.String()),
    items: Type.Optional(Type.Array(QuotationItemCreateSchema)),
});

export const QuotationStatusUpdateSchema = Type.Object({
    status: Type.String(),
});

export type QuotationStatusType = Static<typeof QuotationStatusSchema>;
export type QuotationItemCreateType = Static<typeof QuotationItemCreateSchema>;
export type QuotationCreateType = Static<typeof QuotationCreateSchema>;
export type QuotationStatusUpdateType = Static<typeof QuotationStatusUpdateSchema>;
