import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import {
    listMaterialRequests,
    getMaterialRequest,
    createMaterialRequest,
    updateRequestStatus,
    dispatchItems,
} from '../services/materials.service';

export const materialRoutes = new Elysia({ prefix: '/material-requests' })
    .use(authGuard)
    .get(
        '/',
        ({ query }) =>
            listMaterialRequests({
                workOrderId: query.workOrderId ? Number(query.workOrderId) : undefined,
                status: query.status as any,
                limit: query.limit ? Number(query.limit) : undefined,
                offset: query.offset ? Number(query.offset) : undefined,
            }),
        {
            query: t.Object({
                workOrderId: t.Optional(t.Numeric()),
                status: t.Optional(t.String()),
                limit: t.Optional(t.Numeric()),
                offset: t.Optional(t.Numeric()),
            }),
        }
    )
    .get(
        '/:id',
        ({ params }) => getMaterialRequest(Number(params.id)),
        {
            params: t.Object({ id: t.Numeric() }),
        }
    )
    .post(
        '/',
        async ({ body, currentUserId, set }) => {
            const request = await createMaterialRequest(body, currentUserId);
            set.status = 201;
            return request;
        },
        {
            body: t.Object({
                workOrderId: t.Number(),
                items: t.Array(
                    t.Object({
                        productId: t.Number(),
                        quantity: t.Number({ minimum: 0.0001 }),
                    })
                ),
            }),
        }
    )
    .patch(
        '/:id/status',
        ({ params, body }) => updateRequestStatus(Number(params.id), body.status),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Object({
                status: t.Union([
                    t.Literal('PENDING'),
                    t.Literal('APPROVED'),
                    t.Literal('DISPATCHED'),
                    t.Literal('REJECTED'),
                ]),
            }),
        }
    )
    .post(
        '/:id/dispatch',
        ({ params, body }) => dispatchItems(Number(params.id), body.items),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Object({
                items: t.Array(
                    t.Object({
                        itemId: t.Number(),
                        quantity: t.Number({ minimum: 0.0001 }),
                    })
                ),
            }),
        }
    );
