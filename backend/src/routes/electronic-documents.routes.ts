import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import {
    listDocuments,
    getDocument,
    updateDocumentStatus,
    addInvoicePayment,
} from '../services/electronic-documents.service';

const documentTypeSchema = t.Union([
    t.Literal('INVOICE'),
    t.Literal('CREDIT_NOTE'),
    t.Literal('DEBIT_NOTE'),
    t.Literal('REMISSION_GUIDE'),
    t.Literal('PURCHASE_LIQUIDATION'),
]);

const documentStatusSchema = t.Union([
    t.Literal('DRAFT'),
    t.Literal('SIGNED'),
    t.Literal('SENDING'),
    t.Literal('AUTHORIZED'),
    t.Literal('ANNULLED'),
    t.Literal('REJECTED'),
]);

const paymentMethodSchema = t.Union([
    t.Literal('01'),
    t.Literal('16'),
    t.Literal('19'),
    t.Literal('20'),
]);

export const electronicDocumentsRoutes = new Elysia({ prefix: '/documents' })
    .use(authGuard)
    // List all electronic documents
    .get(
        '/',
        ({ query }) =>
            listDocuments({
                type: query.type as any,
                status: query.status as any,
                entityId: query.entityId ? Number(query.entityId) : undefined,
                fromDate: query.fromDate,
                toDate: query.toDate,
                limit: query.limit ? Number(query.limit) : undefined,
                offset: query.offset ? Number(query.offset) : undefined,
            }),
        {
            query: t.Object({
                type: t.Optional(t.String()),
                status: t.Optional(t.String()),
                entityId: t.Optional(t.Numeric()),
                fromDate: t.Optional(t.String()),
                toDate: t.Optional(t.String()),
                limit: t.Optional(t.Numeric()),
                offset: t.Optional(t.Numeric()),
            }),
        }
    )
    // Get document by ID (returns details based on type)
    .get(
        '/:id',
        ({ params }) => getDocument(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )
    // Update document status
    .patch(
        '/:id/status',
        ({ params, body }) =>
            updateDocumentStatus(Number(params.id), body.status, body.errorMessage),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Object({
                status: documentStatusSchema,
                errorMessage: t.Optional(t.String()),
            }),
        }
    )
    // Add payment to invoice
    .post(
        '/:id/payments',
        async ({ params, body, currentUserId, set }) => {
            const payment = await addInvoicePayment(Number(params.id), body, currentUserId);
            set.status = 201;
            return payment;
        },
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Object({
                amount: t.Number({ minimum: 0.01 }),
                paymentDate: t.String(),
                paymentMethodCode: paymentMethodSchema,
                transactionReference: t.Optional(t.String()),
                notes: t.Optional(t.String()),
            }),
        }
    );
