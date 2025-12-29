import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { quotationsService } from '../services/quotations.service';

export const quotationRoutes = new Elysia({ prefix: '/quotations' })
    .use(authGuard)
    .get('/', async () => {
        return await quotationsService.findAll();
    }, {
        detail: { tags: ['Quotations'] }
    })
    .get('/:id', async ({ params: { id } }) => {
        return await quotationsService.findById(Number(id));
    }, {
        params: t.Object({
            id: t.Numeric()
        }),
        detail: { tags: ['Quotations'] }
    })
    .post('/', async ({ body, currentUserId }) => {
        return await quotationsService.create({
            client_id: body.client_id,
            technical_visit_id: body.technical_visit_id,
            total_amount: body.total_amount,
            valid_until: body.valid_until,
            notes: body.notes,
            created_by: currentUserId,
            items: body.items?.map(item => ({
                product_id: item.product_id,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: item.subtotal
            })) || []
        });
    }, {
        body: t.Object({
            client_id: t.Number(),
            technical_visit_id: t.Optional(t.Number()),
            total_amount: t.Optional(t.String()), // Numeric passed as string
            valid_until: t.Optional(t.String()), // ISO Date
            notes: t.Optional(t.String()),
            items: t.Optional(t.Array(t.Object({
                product_id: t.Optional(t.Number()),
                description: t.String(),
                quantity: t.String(), // Numeric
                unit_price: t.String(), // Numeric
                subtotal: t.String(), // Numeric
            })))
        }),
        detail: { tags: ['Quotations'] }
    })
    .patch('/:id/status', async ({ params: { id }, body }) => {
        return await quotationsService.updateStatus(Number(id), body.status as any);
    }, {
        params: t.Object({
            id: t.Numeric()
        }),
        body: t.Object({
            status: t.String() // Enum validation in service/db
        }),
        detail: { tags: ['Quotations'] }
    })
    .post('/:id/convert', async ({ params: { id } }) => {
        return await quotationsService.convertToWorkOrder(Number(id));
    }, {
        params: t.Object({
            id: t.Numeric()
        }),
        detail: { tags: ['Quotations'] }
    });
