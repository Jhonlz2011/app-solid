import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { locationsService } from '../services/locations.service';

const LOCATION_TYPES = ['VIEW', 'INTERNAL'] as const;

export const locationsRoutes = new Elysia({ prefix: '/locations' })
    .use(authGuard)

    // List all locations (optionally filtered by warehouse)
    .get(
        '/',
        ({ query }) => {
            const warehouseId = query.warehouseId ? Number(query.warehouseId) : undefined;
            return locationsService.list(warehouseId);
        },
        {
            query: t.Object({
                warehouseId: t.Optional(t.String()),
            }),
        }
    )

    // Create a new location
    .post(
        '/',
        async ({ body, set }) => {
            const location = await locationsService.create(body);
            set.status = 201;
            return location;
        },
        {
            body: t.Object({
                warehouse_id: t.Optional(t.Nullable(t.Number())),
                parent_id: t.Optional(t.Nullable(t.Number())),
                name: t.String({ maxLength: 100 }),
                barcode: t.Optional(t.Nullable(t.String({ maxLength: 50 }))),
                type: t.Optional(t.Union(LOCATION_TYPES.map(l => t.Literal(l)))),
            }),
        }
    )

    // Update a location
    .put(
        '/:id',
        ({ params, body }) => locationsService.update(params.id, body),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Partial(
                t.Object({
                    name: t.String({ maxLength: 100 }),
                    barcode: t.Nullable(t.String({ maxLength: 50 })),
                    type: t.Union(LOCATION_TYPES.map(l => t.Literal(l))),
                    is_active: t.Boolean(),
                })
            ),
        }
    )

    // Reparent — Drag & Drop: move location under a new parent (or to root)
    .patch(
        '/:id/reparent',
        ({ params, body }) => locationsService.reparent(params.id, body.parent_id),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Object({
                parent_id: t.Nullable(t.Number()),
            }),
        }
    )

    // Check references before hard delete
    .get(
        '/:id/references',
        ({ params }) => locationsService.checkReferences(params.id),
        {
            params: t.Object({ id: t.Numeric() }),
        }
    )

    // Soft delete (deactivate)
    .patch(
        '/:id/deactivate',
        async ({ params }) => {
            await locationsService.deactivate(params.id);
            return { success: true };
        },
        { params: t.Object({ id: t.Numeric() }) }
    )

    // Restore
    .patch(
        '/:id/restore',
        ({ params }) => locationsService.restore(params.id),
        { params: t.Object({ id: t.Numeric() }) }
    )

    // Hard delete
    .delete(
        '/:id',
        async ({ params }) => {
            await locationsService.hardDelete(params.id);
            return { success: true } as const;
        },
        {
            params: t.Object({ id: t.Numeric() }),
        }
    );
