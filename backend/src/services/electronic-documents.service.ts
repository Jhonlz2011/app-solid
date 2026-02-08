import { and, desc, eq, sql } from '@app/schema';
import { db } from '../db';
import {
    electronicDocuments,
    invoices,
    invoiceItems,
    invoicePayments,
    remissionGuides,
    creditNotes,
    entities,
    documentSequences,
} from '@app/schema/tables';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/ws';

type DocumentType = 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'REMISSION_GUIDE' | 'PURCHASE_LIQUIDATION';
type DocumentStatus = 'DRAFT' | 'SIGNED' | 'SENDING' | 'AUTHORIZED' | 'ANNULLED' | 'REJECTED';

interface DocumentFilters {
    type?: DocumentType;
    status?: DocumentStatus;
    entityId?: number;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
}

interface PaymentPayload {
    amount: number;
    paymentDate: string;
    paymentMethodCode: '01' | '16' | '19' | '20';
    transactionReference?: string;
    notes?: string;
}

// Helper
const toDecimal = (val?: number | null): string | undefined =>
    val !== undefined && val !== null ? val.toString() : undefined;

/**
 * Get next sequential for document type
 */
export async function getNextSequential(establishment: string, emissionPoint: string, docType: string) {
    return db.transaction(async (tx) => {
        const [seq] = await tx
            .select()
            .from(documentSequences)
            .where(
                and(
                    eq(documentSequences.establishment, establishment),
                    eq(documentSequences.emission_point, emissionPoint),
                    eq(documentSequences.document_type, docType)
                )
            );

        if (!seq) {
            // Create new sequence
            const [created] = await tx
                .insert(documentSequences)
                .values({
                    establishment,
                    emission_point: emissionPoint,
                    document_type: docType,
                    current_value: 1,
                })
                .returning();
            return created.current_value;
        }

        // Increment
        const [updated] = await tx
            .update(documentSequences)
            .set({ current_value: seq.current_value + 1 })
            .where(eq(documentSequences.id, seq.id))
            .returning();

        return updated.current_value;
    });
}

/**
 * List electronic documents with filters
 */
export async function listDocuments(filters: DocumentFilters) {
    const cacheKey = `docs:list:${JSON.stringify(filters)}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const { type, status, entityId, fromDate, toDate, limit = 25, offset = 0 } = filters;
        const conditions = [];

        if (type) conditions.push(eq(electronicDocuments.type, type));
        if (status) conditions.push(eq(electronicDocuments.status, status));
        if (entityId) conditions.push(eq(electronicDocuments.entity_id, entityId));
        if (fromDate) conditions.push(sql`${electronicDocuments.issue_date} >= ${fromDate}`);
        if (toDate) conditions.push(sql`${electronicDocuments.issue_date} <= ${toDate}`);

        const whereClause = conditions.length ? and(...conditions) : undefined;

        const data = await db
            .select({
                id: electronicDocuments.id,
                type: electronicDocuments.type,
                status: electronicDocuments.status,
                sriAccessKey: electronicDocuments.sri_access_key,
                establishment: electronicDocuments.establishment,
                emissionPoint: electronicDocuments.emission_point,
                sequential: electronicDocuments.sequential,
                issueDate: electronicDocuments.issue_date,
                entityId: electronicDocuments.entity_id,
                createdAt: electronicDocuments.created_at,
            })
            .from(electronicDocuments)
            .where(whereClause)
            .limit(limit)
            .offset(offset)
            .orderBy(desc(electronicDocuments.created_at));

        const [{ count }] = await db
            .select({ count: sql<number>`count(*)`.mapWith(Number) })
            .from(electronicDocuments)
            .where(whereClause);

        return { data, meta: { total: count, limit, offset } };
    }, 120);
}

/**
 * Get document by ID with details based on type
 */
export async function getDocument(id: number) {
    const cacheKey = `docs:${id}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const [doc] = await db
            .select()
            .from(electronicDocuments)
            .where(eq(electronicDocuments.id, id));

        if (!doc) throw new DomainError('Documento no encontrado', 404);

        // Get entity info
        const [entity] = await db
            .select({
                id: entities.id,
                businessName: entities.business_name,
                taxId: entities.tax_id,
            })
            .from(entities)
            .where(eq(entities.id, doc.entity_id));

        let details: any = null;

        switch (doc.type) {
            case 'INVOICE':
            case 'PURCHASE_LIQUIDATION': {
                const [inv] = await db.select().from(invoices).where(eq(invoices.document_id, id));
                if (inv) {
                    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoice_id, id));
                    const payments = await db.select().from(invoicePayments).where(eq(invoicePayments.invoice_id, id));
                    details = { ...inv, items, payments };
                }
                break;
            }
            case 'REMISSION_GUIDE': {
                const [guide] = await db.select().from(remissionGuides).where(eq(remissionGuides.document_id, id));
                details = guide;
                break;
            }
            case 'CREDIT_NOTE':
            case 'DEBIT_NOTE': {
                const [note] = await db.select().from(creditNotes).where(eq(creditNotes.document_id, id));
                details = note;
                break;
            }
        }

        return { ...doc, entity, details };
    }, 300);
}

/**
 * Update document status
 */
export async function updateDocumentStatus(id: number, status: DocumentStatus, errorMessage?: string) {
    const [updated] = await db
        .update(electronicDocuments)
        .set({
            status,
            sri_error_message: errorMessage,
            sri_authorization_date: status === 'AUTHORIZED' ? new Date() : undefined,
        })
        .where(eq(electronicDocuments.id, id))
        .returning();

    if (!updated) throw new DomainError('Documento no encontrado', 404);

    cacheService.invalidate(`docs:${id}`);
    cacheService.invalidate('docs:list:*');
    broadcast('document:status_changed', { id, status }, 'documents');

    return updated;
}

/**
 * Add payment to invoice
 */
export async function addInvoicePayment(invoiceDocId: number, payload: PaymentPayload, userId: number) {
    const [payment] = await db
        .insert(invoicePayments)
        .values({
            invoice_id: invoiceDocId,
            amount: toDecimal(payload.amount)!,
            payment_date: payload.paymentDate,
            payment_method_code: payload.paymentMethodCode,
            transaction_reference: payload.transactionReference,
            notes: payload.notes,
            created_by: userId,
        })
        .returning();

    cacheService.invalidate(`docs:${invoiceDocId}`);
    broadcast('invoice:payment_added', { invoiceId: invoiceDocId, payment }, 'documents');

    return payment;
}
