import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import {
    listInvoices,
    getInvoice,
    createInvoice,
    updateInvoiceStatus,
    addPayment,
    listPayments,
    addRetention,
} from '../services/invoices.service';

const invoiceTypeSchema = t.Union([
    t.Literal('INVOICE'),
    t.Literal('PURCHASE_LIQUIDATION'),
]);

const invoiceStatusSchema = t.Union([
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

export const invoiceRoutes = new Elysia({ prefix: '/invoices' })
    .use(authGuard)
    // List invoices
    .get(
        '/',
        ({ query }) =>
            listInvoices({
                type: query.type as any,
                status: query.status as any,
                entityId: query.entityId ? Number(query.entityId) : undefined,
                limit: query.limit ? Number(query.limit) : undefined,
                offset: query.offset ? Number(query.offset) : undefined,
            }),
        {
            query: t.Object({
                type: t.Optional(t.String()),
                status: t.Optional(t.String()),
                entityId: t.Optional(t.Numeric()),
                limit: t.Optional(t.Numeric()),
                offset: t.Optional(t.Numeric()),
            }),
        }
    )
    // Get invoice by document ID
    .get(
        '/:id',
        ({ params }) => getInvoice(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )
    // Create invoice
    .post(
        '/',
        async ({ body, currentUserId, set }) => {
            const invoice = await createInvoice(body, currentUserId);
            set.status = 201;
            return invoice;
        },
        {
            body: t.Object({
                entityId: t.Number(),
                workOrderId: t.Optional(t.Number()),
                type: invoiceTypeSchema,
                establishment: t.String({ minLength: 3, maxLength: 3 }),
                emissionPoint: t.String({ minLength: 3, maxLength: 3 }),
                issueDate: t.String(),
                billedToName: t.String(),
                billedToAddress: t.String(),
                billedToRuc: t.String(),
                establishmentAddress: t.Optional(t.String()),
                items: t.Array(
                    t.Object({
                        productId: t.Number(),
                        quantity: t.Number({ minimum: 0.0001 }),
                        unitPrice: t.Number({ minimum: 0 }),
                        discount: t.Optional(t.Number()),
                        ivaRate: t.Number(),
                    })
                ),
            }),
        }
    )
    // Update status
    .patch(
        '/:id/status',
        ({ params, body }) =>
            updateInvoiceStatus(Number(params.id), body.status, body.xmlContent, body.sriAccessKey),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Object({
                status: invoiceStatusSchema,
                xmlContent: t.Optional(t.String()),
                sriAccessKey: t.Optional(t.String()),
            }),
        }
    )
    // Payments
    .get(
        '/:id/payments',
        ({ params }) => listPayments(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .post(
        '/:id/payments',
        async ({ params, body, currentUserId, set }) => {
            const payment = await addPayment(Number(params.id), body, currentUserId);
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
    )
    // Retentions
    .post(
        '/:id/retentions',
        async ({ params, body, set }) => {
            const retention = await addRetention(Number(params.id), body);
            set.status = 201;
            return retention;
        },
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Object({
                retentionType: t.Union([t.Literal('IVA'), t.Literal('RENTA'), t.Literal('ISD')]),
                taxCode: t.String(),
                baseAmount: t.Number({ minimum: 0 }),
                percentage: t.Number({ minimum: 0, maximum: 100 }),
            }),
        }
    );
