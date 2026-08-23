import { Elysia } from 'elysia';
import { tenantGuard } from '../../plugins/tenant-guard';
import { rbac } from '../../plugins/rbac';
import { getIpAndUserAgent } from '../../plugins/ip';
import { locationsService } from './locations.service';
import {
    LocationBodySchema,
    LocationUpdateBodySchema,
    LocationReparentBodySchema,
    LocationListQuerySchema,
    BulkIdsBodySchema,
    IdParamSchema,
    SuccessResponseSchema,
} from '@app/schema/backend';
import type { LocationBodyType, LocationUpdateType } from '@app/schema/dto';

export const locationsRoutes = new Elysia({ prefix: '/locations' })
    .use(tenantGuard)
    .use(rbac)
    .get(
        '/',
        ({ query, currentCompanyId }) => {
            const warehouseId = query.warehouseId !== undefined ? Number(query.warehouseId) : undefined;
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

    // Get single location by id
    .get(
        '/:id',
        ({ params, currentCompanyId }) => locationsService.getById(params.id, currentCompanyId),
        {
            params: IdParamSchema,
            permission: 'locations.read',
        }
    )

    // Create a new location
    .post(
        '/',
        async ({ body, set, headers, currentCompanyId }) => {
            const location = await locationsService.create(
                body as LocationBodyType,
                currentCompanyId,
                headers['x-client-id']
            );
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
        ({ params, body, headers, currentCompanyId }) =>
            locationsService.update(
                params.id,
                body as LocationUpdateType,
                currentCompanyId,
                headers['x-client-id']
            ),
        {
            params: IdParamSchema,
            body: LocationUpdateBodySchema,
            permission: 'locations.update',
        }
    )

    // Reparent — Drag & Drop: move location under a new parent (or to root)
    .patch(
        '/:id/reparent',
        ({ params, body, headers, currentCompanyId }) =>
            locationsService.reparent(
                params.id,
                body.parent_id,
                currentCompanyId,
                headers['x-client-id']
            ),
        {
            params: IdParamSchema,
            body: LocationReparentBodySchema,
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
