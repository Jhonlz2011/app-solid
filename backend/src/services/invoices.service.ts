import { and, eq, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import {
    electronicDocuments,
    invoices,
    invoiceItems,
    invoicePayments,
    taxRetentions,
    documentSequences,
    entities,
    products,
} from '../schema';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/ws';

// ====== TYPES ======
type InvoiceDocType = 'INVOICE' | 'PURCHASE_LIQUIDATION';
type InvoiceStatus = 'DRAFT' | 'SIGNED' | 'SENDING' | 'AUTHORIZED' | 'ANNULLED' | 'REJECTED';

interface InvoicePayload {
    entityId: number;
    workOrderId?: number;
    type: InvoiceDocType;
    establishment: string;
    emissionPoint: string;
    issueDate: string;
    billedToName: string;
    billedToAddress: string;
    billedToRuc: string;
    establishmentAddress?: string;
    items: InvoiceItemPayload[];
}

interface InvoiceItemPayload {
    productId: number;
    quantity: number;
    unitPrice: number;
    discount?: number;
    ivaRate: number;
}

// ====== HELPERS ======
const toDecimal = (val: number): string => val.toFixed(2);

// ====== INVOICES ======

export async function listInvoices(filters: {
    type?: InvoiceDocType;
    status?: InvoiceStatus;
    entityId?: number;
    limit?: number;
    offset?: number;
}) {
    const { type, status, entityId, limit = 25, offset = 0 } = filters;
    const conditions = [];

    // Filter by type (INVOICE or PURCHASE_LIQUIDATION)
    if (type) {
        conditions.push(eq(electronicDocuments.type, type));
    } else {
        // Default: only show invoice types
        conditions.push(
            sql`${electronicDocuments.type} IN ('INVOICE', 'PURCHASE_LIQUIDATION')`
        );
    }

    if (status) conditions.push(eq(electronicDocuments.status, status));
    if (entityId) conditions.push(eq(electronicDocuments.entity_id, entityId));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const data = await db
        .select({
            id: electronicDocuments.id,
            type: electronicDocuments.type,
            status: electronicDocuments.status,
            establishment: electronicDocuments.establishment,
            emissionPoint: electronicDocuments.emission_point,
            sequential: electronicDocuments.sequential,
            issueDate: electronicDocuments.issue_date,
            entityId: electronicDocuments.entity_id,
            sriAccessKey: electronicDocuments.sri_access_key,
            createdAt: electronicDocuments.created_at,
            // Invoice-specific fields from child
            total: invoices.total,
            billedToName: invoices.billed_to_name,
            billedToRuc: invoices.billed_to_ruc,
        })
        .from(electronicDocuments)
        .innerJoin(invoices, eq(electronicDocuments.id, invoices.document_id))
        .where(whereClause)
        .orderBy(desc(electronicDocuments.created_at))
        .limit(limit)
        .offset(offset);

    const [{ count }] = await db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(electronicDocuments)
        .innerJoin(invoices, eq(electronicDocuments.id, invoices.document_id))
        .where(whereClause);

    return { data, meta: { total: count, limit, offset } };
}

export async function getInvoice(documentId: number) {
    // Get parent document
    const [doc] = await db
        .select()
        .from(electronicDocuments)
        .where(eq(electronicDocuments.id, documentId));
    if (!doc) throw new DomainError('Documento no encontrado', 404);

    // Get invoice child
    const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.document_id, documentId));
    if (!invoice) throw new DomainError('Factura no encontrada', 404);

    // Get entity info
    const [entity] = await db
        .select({ id: entities.id, businessName: entities.business_name, taxId: entities.tax_id })
        .from(entities)
        .where(eq(entities.id, doc.entity_id));

    // Get items with product info
    const items = await db
        .select({
            id: invoiceItems.id,
            productId: invoiceItems.product_id,
            quantity: invoiceItems.quantity,
            unitPrice: invoiceItems.unit_price,
            discount: invoiceItems.discount,
            subtotal: invoiceItems.subtotal,
            ivaRate: invoiceItems.iva_rate,
            ivaAmount: invoiceItems.iva_amount,
            productName: products.name,
            productSku: products.sku,
        })
        .from(invoiceItems)
        .leftJoin(products, eq(invoiceItems.product_id, products.id))
        .where(eq(invoiceItems.invoice_id, documentId));

    // Get payments
    const payments = await db
        .select()
        .from(invoicePayments)
        .where(eq(invoicePayments.invoice_id, documentId));

    // Get retentions
    const retentions = await db
        .select()
        .from(taxRetentions)
        .where(eq(taxRetentions.invoice_id, documentId));

    return { ...doc, ...invoice, entity, items, payments, retentions };
}

export async function createInvoice(payload: InvoicePayload, userId: number) {
    return db.transaction(async (tx) => {
        // Calculate totals
        let subtotalVat = 0;
        let subtotalNoVat = 0;
        let taxIva = 0;

        const processedItems = payload.items.map((item) => {
            const discount = item.discount ?? 0;
            const subtotal = item.quantity * item.unitPrice - discount;
            const ivaAmount = subtotal * (item.ivaRate / 100);

            if (item.ivaRate === 0) {
                subtotalNoVat += subtotal;
            } else {
                subtotalVat += subtotal;
                taxIva += ivaAmount;
            }

            return { ...item, subtotal, ivaAmount };
        });

        const total = subtotalNoVat + subtotalVat + taxIva;

        // Get next sequential
        const docType = payload.type === 'INVOICE' ? 'FACTURA' : 'LIQ_COMPRA';
        const [seq] = await tx
            .select()
            .from(documentSequences)
            .where(
                and(
                    eq(documentSequences.establishment, payload.establishment),
                    eq(documentSequences.emission_point, payload.emissionPoint),
                    eq(documentSequences.document_type, docType)
                )
            );

        let sequential: number;
        if (seq) {
            sequential = seq.current_value + 1;
            await tx
                .update(documentSequences)
                .set({ current_value: sequential })
                .where(eq(documentSequences.id, seq.id));
        } else {
            sequential = 1;
            await tx.insert(documentSequences).values({
                establishment: payload.establishment,
                emission_point: payload.emissionPoint,
                document_type: docType,
                current_value: 1,
            });
        }

        // Create parent document
        const [doc] = await tx
            .insert(electronicDocuments)
            .values({
                type: payload.type,
                establishment: payload.establishment,
                emission_point: payload.emissionPoint,
                sequential,
                issue_date: payload.issueDate,
                entity_id: payload.entityId,
                work_order_id: payload.workOrderId,
                status: 'DRAFT',
                created_by: userId,
            })
            .returning();

        // Create invoice child
        await tx.insert(invoices).values({
            document_id: doc.id,
            subtotal_vat: toDecimal(subtotalVat),
            subtotal_no_vat: toDecimal(subtotalNoVat),
            tax_vat_amount: toDecimal(taxIva),
            total: toDecimal(total),
            billed_to_name: payload.billedToName,
            billed_to_address: payload.billedToAddress,
            billed_to_ruc: payload.billedToRuc,
            establishment_address: payload.establishmentAddress,
        });

        // Create items
        await tx.insert(invoiceItems).values(
            processedItems.map((item) => ({
                invoice_id: doc.id,
                product_id: item.productId,
                quantity: item.quantity.toString(),
                unit_price: item.unitPrice.toString(),
                discount: (item.discount ?? 0).toString(),
                subtotal: toDecimal(item.subtotal),
                iva_rate: item.ivaRate.toString(),
                iva_amount: toDecimal(item.ivaAmount),
            }))
        );

        cacheService.invalidate('invoices:*');
        cacheService.invalidate('docs:*');
        broadcast('invoice:created', { id: doc.id }, 'invoices');

        return { ...doc, total: toDecimal(total) };
    });
}

export async function updateInvoiceStatus(
    documentId: number,
    status: InvoiceStatus,
    xmlContent?: string,
    sriAccessKey?: string
) {
    const [updated] = await db
        .update(electronicDocuments)
        .set({
            status,
            sri_access_key: sriAccessKey,
            sri_authorization_date: status === 'AUTHORIZED' ? new Date() : undefined,
        })
        .where(eq(electronicDocuments.id, documentId))
        .returning();

    if (!updated) throw new DomainError('Documento no encontrado', 404);

    // Update XML in invoice child if provided
    if (xmlContent) {
        await db
            .update(invoices)
            .set({ xml_content: xmlContent })
            .where(eq(invoices.document_id, documentId));
    }

    cacheService.invalidate('invoices:*');
    cacheService.invalidate('docs:*');
    broadcast('invoice:status', { id: documentId, status }, 'invoices');

    return updated;
}

// ====== PAYMENTS ======

interface PaymentPayload {
    amount: number;
    paymentDate: string;
    paymentMethodCode: '01' | '16' | '19' | '20';
    transactionReference?: string;
    notes?: string;
}

export async function addPayment(invoiceDocId: number, payload: PaymentPayload, userId: number) {
    const [payment] = await db
        .insert(invoicePayments)
        .values({
            invoice_id: invoiceDocId,
            amount: toDecimal(payload.amount),
            payment_date: payload.paymentDate,
            payment_method_code: payload.paymentMethodCode,
            transaction_reference: payload.transactionReference,
            notes: payload.notes,
            created_by: userId,
        })
        .returning();

    broadcast('invoice:payment', { invoiceId: invoiceDocId, payment }, 'invoices');
    return payment;
}

export async function listPayments(invoiceDocId: number) {
    return db.select().from(invoicePayments).where(eq(invoicePayments.invoice_id, invoiceDocId));
}

// ====== RETENTIONS ======

interface RetentionPayload {
    retentionType: 'IVA' | 'RENTA' | 'ISD';
    taxCode: string;
    baseAmount: number;
    percentage: number;
}

export async function addRetention(invoiceDocId: number, payload: RetentionPayload) {
    const retainedValue = payload.baseAmount * (payload.percentage / 100);

    const [retention] = await db
        .insert(taxRetentions)
        .values({
            invoice_id: invoiceDocId,
            retention_type: payload.retentionType,
            tax_code: payload.taxCode,
            base_amount: toDecimal(payload.baseAmount),
            percentage: toDecimal(payload.percentage),
            retained_value: toDecimal(retainedValue),
        })
        .returning();

    return retention;
}
