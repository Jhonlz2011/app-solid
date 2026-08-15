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

export const uomRoutes = new Elysia({ prefix: '/uom' })
    .use(authGuard)
    .use(rbac)

    // Simple catalog list (all system + tenant UOMs)
    .get('/', ({ currentCompanyId }) => uomService.listUoms(currentCompanyId), {
        permission: 'uom.read',
    })

    // Create (tenant-scoped, never system)
    .post(
        '/',
        async ({ body, set, currentCompanyId }) => {
            const created = await uomService.create(body, currentCompanyId);
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
        ({ params, body, currentCompanyId }) => uomService.update(params.id, body, currentCompanyId),
        {
            params: IdParamSchema,
            body: UomUpdateSchema,
            permission: 'uom.update',
        }
    )

    // Check references before hard delete
    .get(
        '/:id/references',
        ({ params }) => uomService.checkReferences(params.id),
        {
            params: IdParamSchema,
            response: UomReferencesResponseSchema,
            permission: 'uom.read',
        }
    )

    // Soft delete (deactivate) — sets is_active = false
    .patch(
        '/:id/deactivate',
        async ({ params, set, currentCompanyId }) => {
            await uomService.deactivate(params.id, currentCompanyId);
            set.status = 204;
        },
        {
            params: IdParamSchema,
            permission: 'uom.delete',
        }
    )

    // Restore a soft-deleted UOM back to active
    .patch(
        '/:id/restore',
        ({ params, currentCompanyId }) => uomService.restore(params.id, currentCompanyId),
        {
            params: IdParamSchema,
            permission: 'uom.restore',
        }
    )

    // Hard delete (blocks system UOMs and UOMs with references)
    .delete(
        '/:id',
        async ({ params, currentCompanyId }) => {
            await uomService.hardDelete(params.id, currentCompanyId);
            return { success: true } as const;
        },
        {
            params: IdParamSchema,
            response: SuccessResponseSchema,
            permission: 'uom.destroy',
        }
    );
