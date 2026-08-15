import { Elysia } from 'elysia';
import { authGuard } from '../../plugins/auth-guard';
import { rbac } from '../../plugins/rbac';
import { uomService } from './uom.service';
import {
    UomBodySchema,
    UomUpdateSchema,
    UomReferencesResponseSchema,
    IdParamSchema,
    SuccessResponseSchema,
} from '@app/schema/backend';
import type { UomPayload, UomUpdatePayload } from '@app/schema/dto';

export const uomRoutes = new Elysia({ prefix: '/uom' })
    .use(authGuard)
    .use(rbac)

    // Simple catalog list (all system + tenant UOMs)
    .get('/', ({ currentCompanyId }) => uomService.listUoms(currentCompanyId), {
        permission: 'uom.read',
    })

    // Get single UOM by id (system UOMs or owned by company)
    .get(
        '/:id',
        ({ params, currentCompanyId }) => uomService.getById(params.id, currentCompanyId),
        {
            params: IdParamSchema,
            permission: 'uom.read',
        }
    )

    // Create (tenant-scoped, never system)
    .post(
        '/',
        async ({ body, set, headers, currentCompanyId }) => {
            const created = await uomService.create(
                body as UomPayload,
                currentCompanyId,
                headers['x-client-id']
            );
            set.status = 201;
            return created;
        },
        {
            body: UomBodySchema,
            permission: 'uom.create',
        }
    )

    // Update by integer id (blocks system UOMs)
    .put(
        '/:id',
        ({ params, body, headers, currentCompanyId }) =>
            uomService.update(
                params.id,
                body as UomUpdatePayload,
                currentCompanyId,
                headers['x-client-id']
            ),
        {
            params: IdParamSchema,
            body: UomUpdateSchema,
            permission: 'uom.update',
        }
    )

    // Check references before hard delete
    .get(
        '/:id/references',
        ({ params, currentCompanyId }) => uomService.checkReferences(params.id, currentCompanyId),
        {
            params: IdParamSchema,
            response: UomReferencesResponseSchema,
            permission: 'uom.read',
        }
    )

    // Soft delete (deactivate) — sets is_active = false
    .patch(
        '/:id/deactivate',
        async ({ params, headers, currentCompanyId }) => {
            return uomService.deactivate(params.id, currentCompanyId, headers['x-client-id']);
        },
        {
            params: IdParamSchema,
            permission: 'uom.delete',
        }
    )

    // Restore a soft-deleted UOM back to active
    .patch(
        '/:id/restore',
        ({ params, headers, currentCompanyId }) =>
            uomService.restore(params.id, currentCompanyId, headers['x-client-id']),
        {
            params: IdParamSchema,
            permission: 'uom.restore',
        }
    )

    // Hard delete (blocks system UOMs and UOMs with references)
    .delete(
        '/:id',
        async ({ params, headers, currentCompanyId }) => {
            await uomService.hardDelete(params.id, currentCompanyId, headers['x-client-id']);
            return { success: true } as const;
        },
        {
            params: IdParamSchema,
            response: SuccessResponseSchema,
            permission: 'uom.destroy',
        }
    );
