import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { rbac } from '../plugins/rbac';
import { getIpAndUserAgent } from '../plugins/ip';
import { locationsService } from '../services/locations.service';
import { LocationTypeSchema } from '@app/schema/backend';

export const locationsRoutes = new Elysia({ prefix: '/locations' })
    .use(authGuard)
    .use(rbac)

    // List all locations (optionally filtered by warehouse)
    .get(
        '/',
        ({ query, currentCompanyId }) => {
            const warehouseId = query.warehouseId ? Number(query.warehouseId) : undefined;
            return locationsService.list(currentCompanyId, warehouseId);
        },
        {
            query: t.Object({
                warehouseId: t.Optional(t.String()),
            }),
            permission: 'locations.read',
        }
    )

    // Bulk deactivate — before /:id to avoid route conflicts
    .delete(
        '/bulk',
        async ({ body, headers, currentUserId, currentCompanyId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return locationsService.bulkDeactivate(
                body.ids,
                currentCompanyId,
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }
            );
        },
        {
            body: t.Object({
                ids: t.Array(t.Number(), { minItems: 1 })
            }),
            permission: 'locations.delete',
        }
    )
    // Bulk restore
    .patch(
        '/bulk/restore',
        async ({ body, headers, currentUserId, currentCompanyId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return locationsService.bulkRestore(
                body.ids,
                currentCompanyId,
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }
            );
        },
        {
            body: t.Object({
                ids: t.Array(t.Number(), { minItems: 1 })
            }),
            permission: 'locations.restore',
        }
    )

    // Create a new location
    .post(
        '/',
        async ({ body, set, headers, currentCompanyId }) => {
            const location = await locationsService.create(body, currentCompanyId, headers['x-client-id']);
            set.status = 201;
            return location;
        },
        {
            body: t.Object({
                warehouse_id: t.Optional(t.Nullable(t.Number())),
                parent_id: t.Optional(t.Nullable(t.Number())),
                name: t.String({ maxLength: 100 }),
                type: t.Optional(LocationTypeSchema),
            }),
            permission: 'locations.create',
        }
    )

    // Update a location
    .put(
        '/:id',
        ({ params, body, headers, currentCompanyId }) => locationsService.update(params.id, body, currentCompanyId, headers['x-client-id']),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Partial(
                t.Object({
                    name: t.String({ maxLength: 100 }),
                    type: LocationTypeSchema,
                    warehouse_id: t.Nullable(t.Number()),
                    parent_id: t.Nullable(t.Number()),
                    is_active: t.Boolean(),
                })
            ),
            permission: 'locations.update',
        }
    )

    // Reparent — Drag & Drop: move location under a new parent (or to root)
    .patch(
        '/:id/reparent',
        ({ params, body, headers, currentCompanyId }) => locationsService.reparent(params.id, body.parent_id, currentCompanyId, headers['x-client-id']),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Object({
                parent_id: t.Nullable(t.Number()),
            }),
            permission: 'locations.update',
        }
    )

    // Check references before hard delete
    .get(
        '/:id/references',
        ({ params, currentCompanyId }) => locationsService.checkReferences(params.id, currentCompanyId),
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'locations.read',
        }
    )

    // Soft delete (deactivate)
    .patch(
        '/:id/deactivate',
        async ({ params, headers, currentUserId, currentCompanyId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            await locationsService.deactivate(
                params.id,
                currentCompanyId,
                headers['x-client-id'],
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }
            );
            return { success: true };
        },
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'locations.delete',
        }
    )

    // Restore
    .patch(
        '/:id/restore',
        async ({ params, headers, currentUserId, currentCompanyId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return locationsService.restore(
                params.id,
                currentCompanyId,
                headers['x-client-id'],
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }
            );
        },
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'locations.restore',
        }
    )

    // Hard delete
    .delete(
        '/:id',
        async ({ params, headers, currentCompanyId }) => {
            await locationsService.hardDelete(params.id, currentCompanyId, headers['x-client-id']);
            return { success: true } as const;
        },
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'locations.destroy',
        }
    );
