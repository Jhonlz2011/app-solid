import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { rbac } from '../plugins/rbac';
import { getIpAndUserAgent } from '../plugins/ip';
import { vehiclesService } from '../services/vehicles.service';
import { CarrierVehiclePayloadSchema } from '@app/schema/backend';

export const vehiclesRoutes = new Elysia({ prefix: '/settings/vehicles' })
    .use(authGuard)
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
            params: t.Object({ id: t.Numeric() }),
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
            body: CarrierVehiclePayloadSchema,
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
            params: t.Object({ id: t.Numeric() }),
            body: t.Partial(CarrierVehiclePayloadSchema),
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
            params: t.Object({ id: t.Numeric() }),
            permission: 'config.update',
        }
    );
