import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import {
  listWorkOrders,
  getWorkOrder,
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
} from '../services/work-orders.service';

export const workOrderRoutes = new Elysia({ prefix: '/work-orders' })
  .use(authGuard)
  .get(
    '/',
    ({ query }) =>
      listWorkOrders({
        status: query.status as any,
        clientId: query.clientId ? Number(query.clientId) : undefined,
        search: query.search,
        limit: query.limit ? Number(query.limit) : undefined,
        offset: query.offset ? Number(query.offset) : undefined,
      }),
    {
      query: t.Object({
        status: t.Optional(t.String()),
        clientId: t.Optional(t.Numeric()),
        search: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
        offset: t.Optional(t.Numeric()),
      }),
    }
  )
  .get(
    '/:id',
    ({ params }) => getWorkOrder(Number(params.id)),
    {
      params: t.Object({ id: t.Numeric() }),
    }
  )
  .post(
    '/',
    async ({ body, currentUserId, set }) => {
      const workOrder = await createWorkOrder(body, currentUserId);
      set.status = 201;
      return workOrder;
    },
    {
      body: t.Object({
        clientId: t.Number(),
        status: t.Optional(
          t.Union([
            t.Literal('DRAFT'),
            t.Literal('APPROVED'),
            t.Literal('IN_PROGRESS'),
            t.Literal('COMPLETED'),
            t.Literal('INVOICED'),
          ])
        ),
        startDate: t.Optional(t.String()),
        deliveryDate: t.Optional(t.String()),
        totalEstimated: t.Optional(t.Number()),
        notes: t.Optional(t.String()),
        initialMaterials: t.Optional(
          t.Array(
            t.Object({
              productId: t.Number(),
              quantity: t.Number(),
            })
          )
        ),
      }),
    }
  )
  .put(
    '/:id',
    ({ params, body, currentUserId }) =>
      updateWorkOrder(Number(params.id), body, currentUserId),
    {
      params: t.Object({ id: t.Numeric() }),
      body: t.Partial(
        t.Object({
          clientId: t.Number(),
          status: t.Union([
            t.Literal('DRAFT'),
            t.Literal('APPROVED'),
            t.Literal('IN_PROGRESS'),
            t.Literal('COMPLETED'),
            t.Literal('INVOICED'),
          ]),
          startDate: t.String(),
          deliveryDate: t.String(),
          totalEstimated: t.Number(),
          notes: t.String(),
        })
      ),
    }
  )
  .delete(
    '/:id',
    async ({ params, currentUserId, set }) => {
      await deleteWorkOrder(Number(params.id), currentUserId);
      set.status = 204;
    },
    {
      params: t.Object({ id: t.Numeric() }),
    }
  );
