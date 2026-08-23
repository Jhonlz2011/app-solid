import { Elysia } from 'elysia';
import { tenantGuard } from '../../plugins/tenant-guard';
import { rbac } from '../../plugins/rbac';
import { getIpAndUserAgent } from '../../plugins/ip';
import { vehiclesService } from './vehicles.service';
import {
    CarrierVehicleBodySchema,
    CarrierVehicleUpdateSchema,
    IdParamSchema,
} from '@app/schema/backend';

export const vehiclesRoutes = new Elysia({ prefix: '/settings/vehicles' })
    .use(tenantGuard)
    .use(rbac)
    .get(
        '/',
        ({ currentCompanyId }) => {
            return vehiclesService.list(currentCompanyId);
        },
        {
            permission: 'config.read',
        }
    )
    .get(
        '/:id',
        ({ currentCompanyId, params }) => {
            return vehiclesService.get(currentCompanyId, Number(params.id));
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
            const vehicle = await vehiclesService.create(
                currentCompanyId,
                body,
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }
            );
            set.status = 201;
            return vehicle;
        },
        {
            body: CarrierVehicleBodySchema,
            permission: 'config.update',
        }
    )
    .put(
        '/:id',
        async ({ currentCompanyId, params, body, headers, currentUserId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return vehiclesService.update(
                currentCompanyId,
                Number(params.id),
                body,
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }
            );
        },
        {
            params: IdParamSchema,
            body: CarrierVehicleUpdateSchema,
            permission: 'config.update',
        }
    )
    .delete(
        '/:id',
        async ({ currentCompanyId, params, set, headers, currentUserId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            await vehiclesService.delete(
                currentCompanyId,
                Number(params.id),
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }
            );
            set.status = 204;
        },
        {
            params: IdParamSchema,
            permission: 'config.update',
        }
    );
