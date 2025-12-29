import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { technicalVisitsService } from '../services/technical-visits.service';

export const technicalVisitsRoutes = new Elysia({ prefix: '/technical-visits' })
    .use(authGuard)
    .get('/', async () => {
        return await technicalVisitsService.findAll();
    }, {
        detail: { tags: ['Technical Visits'] }
    })
    .get('/:id', async ({ params: { id } }) => {
        return await technicalVisitsService.findById(Number(id));
    }, {
        params: t.Object({
            id: t.Numeric()
        }),
        detail: { tags: ['Technical Visits'] }
    })
    .post('/', async ({ body }) => {
        return await technicalVisitsService.create({
            ...body,
            visit_date: new Date(body.visit_date)
        });
    }, {
        body: t.Object({
            client_id: t.Number(),
            assigned_employee_id: t.Optional(t.Number()),
            visit_date: t.String(), // ISO Date
            notes: t.Optional(t.String()),
            evidence_files: t.Optional(t.Array(t.String()))
        }),
        detail: { tags: ['Technical Visits'] }
    })
    .patch('/:id', async ({ params: { id }, body }) => {
        return await technicalVisitsService.update(Number(id), {
            ...body,
            visit_date: body.visit_date ? new Date(body.visit_date) : undefined,
            status: body.status as any
        });
    }, {
        params: t.Object({
            id: t.Numeric()
        }),
        body: t.Object({
            assigned_employee_id: t.Optional(t.Number()),
            visit_date: t.Optional(t.String()), // ISO Date
            status: t.Optional(t.String()), // Enum validation handled by DB or Service if needed
            notes: t.Optional(t.String()),
            evidence_files: t.Optional(t.Array(t.String()))
        }),
        detail: { tags: ['Technical Visits'] }
    })
    .patch('/:id/cancel', async ({ params: { id } }) => {
        return await technicalVisitsService.cancel(Number(id));
    }, {
        params: t.Object({
            id: t.Numeric()
        }),
        detail: { tags: ['Technical Visits'] }
    });
