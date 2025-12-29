import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import {
    listRemissionGuides,
    getRemissionGuide,
    createRemissionGuide,
    updateRemissionGuide,
} from '../services/remission-guides.service';
import { updateDocumentStatus } from '../services/electronic-documents.service';

export const remissionGuidesRoutes = new Elysia({ prefix: '/remission-guides' })
    .use(authGuard)
    // List remission guides
    .get(
        '/',
        ({ query }) =>
            listRemissionGuides({
                entityId: query.entityId ? Number(query.entityId) : undefined,
                carrierId: query.carrierId ? Number(query.carrierId) : undefined,
                status: query.status,
                limit: query.limit ? Number(query.limit) : undefined,
                offset: query.offset ? Number(query.offset) : undefined,
            }),
        {
            query: t.Object({
                entityId: t.Optional(t.Numeric()),
                carrierId: t.Optional(t.Numeric()),
                status: t.Optional(t.String()),
                limit: t.Optional(t.Numeric()),
                offset: t.Optional(t.Numeric()),
            }),
        }
    )
    // Get remission guide by ID
    .get(
        '/:id',
        ({ params }) => getRemissionGuide(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )
    // Create remission guide
    .post(
        '/',
        async ({ body, currentUserId, set }) => {
            const guide = await createRemissionGuide(body, currentUserId);
            set.status = 201;
            return guide;
        },
        {
            body: t.Object({
                establishment: t.String({ minLength: 3, maxLength: 3 }),
                emissionPoint: t.String({ minLength: 3, maxLength: 3 }),
                issueDate: t.String(),
                entityId: t.Number(),
                workOrderId: t.Optional(t.Number()),
                relatedInvoiceId: t.Optional(t.Number()),
                carrierId: t.Optional(t.Number()),
                vehiclePlate: t.String(),
                startDate: t.String(),
                endDate: t.String(),
                routeOrigin: t.String(),
                routeDestination: t.String(),
                reason: t.Optional(t.String()),
                customsDoc: t.Optional(t.String()),
            }),
        }
    )
    // Update remission guide (only drafts)
    .put(
        '/:id',
        ({ params, body }) => updateRemissionGuide(Number(params.id), body),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Partial(
                t.Object({
                    entityId: t.Number(),
                    issueDate: t.String(),
                    carrierId: t.Number(),
                    vehiclePlate: t.String(),
                    startDate: t.String(),
                    endDate: t.String(),
                    routeOrigin: t.String(),
                    routeDestination: t.String(),
                    reason: t.String(),
                    customsDoc: t.String(),
                })
            ),
        }
    )
    // Update status
    .patch(
        '/:id/status',
        ({ params, body }) =>
            updateDocumentStatus(Number(params.id), body.status, body.errorMessage),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Object({
                status: t.Union([
                    t.Literal('DRAFT'),
                    t.Literal('SIGNED'),
                    t.Literal('SENDING'),
                    t.Literal('AUTHORIZED'),
                    t.Literal('ANNULLED'),
                    t.Literal('REJECTED'),
                ]),
                errorMessage: t.Optional(t.String()),
            }),
        }
    );
