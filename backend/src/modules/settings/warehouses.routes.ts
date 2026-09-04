import { Elysia } from 'elysia';
import { tenantGuard } from '../../plugins/tenant-guard';
import { rbac } from '../../plugins/rbac';
import { getIpAndUserAgent } from '../../plugins/ip';
import { warehousesService } from './warehouses.service';
import {
    WarehouseBodySchema,
    WarehouseUpdateBodySchema,
    IdParamSchema,
} from '@app/schema/backend';

export const warehousesRoutes = new Elysia({ prefix: '/settings/warehouses' })
    .use(tenantGuard)
    .use(rbac)
    .get(
        '/',
        ({ currentCompanyId }) => {
            return warehousesService.list(currentCompanyId);
        },
        {
            permission: 'config.read',
        }
    )
    .get(
        '/:id',
        ({ currentCompanyId, params }) => {
            return warehousesService.get(currentCompanyId, Number(params.id));
        },
        {
            params: IdParamSchema,
            permission: 'config.read',
        }
    )
    .get(
        '/:id/references',
        ({ currentCompanyId, params }) => {
            return warehousesService.checkReferences(currentCompanyId, Number(params.id));
        },
        {
            params: IdParamSchema,
            permission: 'config.read',
        }
    )
    .post(
        '/',
        async ({ currentCompanyId, body, set, headers, currentUserId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            const warehouse = await warehousesService.create(
                currentCompanyId,
                body,
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }
            );
            set.status = 201;
            return warehouse;
        },
        {
            body: WarehouseBodySchema,
            permission: 'config.update',
        }
    )
    .put(
        '/:id',
        async ({ currentCompanyId, params, body, headers, currentUserId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return warehousesService.update(
                currentCompanyId,
                Number(params.id),
                body,
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }
            );
        },
        {
            params: IdParamSchema,
            body: WarehouseUpdateBodySchema,
            permission: 'config.update',
        }
    )
    .patch(
        '/:id/deactivate',
        async ({ currentCompanyId, params, headers, currentUserId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            await warehousesService.deactivate(
                currentCompanyId,
                Number(params.id),
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }
            );
            return { success: true };
        },
        {
            params: IdParamSchema,
            permission: 'config.update',
        }
    )
    .patch(
        '/:id/restore',
        async ({ currentCompanyId, params, headers, currentUserId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return warehousesService.restore(
                currentCompanyId,
                Number(params.id),
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }
            );
        },
        {
            params: IdParamSchema,
            permission: 'config.update',
        }
    )
    .delete(
        '/:id',
        async ({ currentCompanyId, params, set, headers, currentUserId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            await warehousesService.delete(
                currentCompanyId,
                Number(params.id),
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }
            );
            set.status = 200;
            return { success: true };
        },
        {
            params: IdParamSchema,
            permission: 'config.update',
        }
    );
