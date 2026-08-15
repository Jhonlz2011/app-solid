import { Elysia } from 'elysia';
import { authGuard } from '../../plugins/auth-guard';
import { rbac } from '../../plugins/rbac';
import { getIpAndUserAgent } from '../../plugins/ip';
import { locationsService } from './locations.service';
import {
    LocationBodySchema,
    LocationUpdateSchema,
    LocationReparentSchema,
    LocationListQuerySchema,
    BulkIdsBodySchema,
    IdParamSchema,
    SuccessResponseSchema,
} from '@app/schema/backend';

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
            query: LocationListQuerySchema,
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
            body: BulkIdsBodySchema,
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
            body: BulkIdsBodySchema,
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
            body: LocationBodySchema,
            permission: 'locations.create',
        }
    )

    // Update a location
    .put(
        '/:id',
        ({ params, body, headers, currentCompanyId }) => locationsService.update(params.id, body, currentCompanyId, headers['x-client-id']),
        {
            params: IdParamSchema,
            body: LocationUpdateSchema,
            permission: 'locations.update',
        }
    )

    // Reparent — Drag & Drop: move location under a new parent (or to root)
    .patch(
        '/:id/reparent',
        ({ params, body, headers, currentCompanyId }) => locationsService.reparent(params.id, body.parent_id, currentCompanyId, headers['x-client-id']),
        {
            params: IdParamSchema,
            body: LocationReparentSchema,
            permission: 'locations.update',
        }
    )

    // Check references before hard delete
    .get(
        '/:id/references',
        ({ params, currentCompanyId }) => locationsService.checkReferences(params.id, currentCompanyId),
        {
            params: IdParamSchema,
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
            params: IdParamSchema,
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
            params: IdParamSchema,
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
            params: IdParamSchema,
            response: SuccessResponseSchema,
            permission: 'locations.destroy',
        }
    );
