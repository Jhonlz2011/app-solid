import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { employeeSchedulesService } from '../services/employee-schedules.service';

export const employeeSchedulesRoutes = new Elysia({ prefix: '/employee-schedules' })
    .use(authGuard)
    .get('/', async ({ query }) => {
        return await employeeSchedulesService.getReport(
            query.start_date,
            query.end_date,
            query.employee_id ? Number(query.employee_id) : undefined
        );
    }, {
        query: t.Object({
            start_date: t.Optional(t.String()),
            end_date: t.Optional(t.String()),
            employee_id: t.Optional(t.String())
        }),
        detail: { tags: ['Employee Schedules'] }
    })
    .post('/', async ({ body }) => {
        return await employeeSchedulesService.createLog(body as any);
    }, {
        body: t.Object({
            employee_id: t.Numeric(),
            work_order_id: t.Optional(t.Numeric()),
            work_date: t.String(), // ISO Date
            hours_normal: t.Optional(t.Numeric()),
            hours_supplementary: t.Optional(t.Numeric()),
            hours_extraordinary: t.Optional(t.Numeric()),
            labor_cost: t.Optional(t.String()), // Numeric
            project_expense: t.Optional(t.String()), // Numeric
            justification: t.Optional(t.String()) // Enum
        }),
        detail: { tags: ['Employee Schedules'] }
    })
    .patch('/:id', async ({ params: { id }, body }) => {
        return await employeeSchedulesService.updateLog(Number(id), body as any);
    }, {
        params: t.Object({
            id: t.Numeric()
        }),
        body: t.Object({
            hours_normal: t.Optional(t.Numeric()),
            hours_supplementary: t.Optional(t.Numeric()),
            hours_extraordinary: t.Optional(t.Numeric()),
            labor_cost: t.Optional(t.String()),
            project_expense: t.Optional(t.String()),
            justification: t.Optional(t.String())
        }),
        detail: { tags: ['Employee Schedules'] }
    });
