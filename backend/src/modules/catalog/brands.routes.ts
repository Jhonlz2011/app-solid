import { Elysia } from 'elysia';
import { tenantGuard } from '../../plugins/tenant-guard';
import { rbac } from '../../plugins/rbac';
import { brandsService } from './brands.service';
import {
    BrandBodySchema,
    BrandUpdateBodySchema,
    BrandListQuerySchema,
    BrandReferencesResponseSchema,
    BulkIdsBodySchema,
    IdParamSchema,
    SuccessResponseSchema,
} from '@app/schema/backend';
import type { BrandBodyType, BrandUpdateType } from '@app/schema/dto';

const parseArray = (val?: string) => val?.split(',').filter(Boolean);

export const brandRoutes = new Elysia({ prefix: '/brands' })
    .use(tenantGuard)
    .use(rbac)

    // Paginated list
    .get(
        '/',
        ({ query, currentCompanyId }) => {
            return brandsService.list({
                cursor: query.cursor,
                direction: query.direction,
                limit: query.limit !== undefined ? Number(query.limit) : undefined,
                search: query.search,
                sortBy: query.sortBy,
                sortOrder: query.sortOrder,
                page: query.page !== undefined ? Number(query.page) : undefined,
                isActive: parseArray(query.isActive),
            }, currentCompanyId);
        },
        {
            query: BrandListQuerySchema,
            permission: 'brands.read',
        }
    )

    // Simple list (for selectors)
    .get('/all', ({ currentCompanyId }) => brandsService.listAll(currentCompanyId), {
        permission: 'brands.read',
    })

    // Get single brand by ID
    .get(
        '/:id',
        ({ params, currentCompanyId }) => brandsService.getById(params.id, currentCompanyId),
        {
            params: IdParamSchema,
            permission: 'brands.read',
        }
    )

    // Check references before hard delete
    .get(
        '/:id/references',
        ({ params, currentCompanyId }) => brandsService.checkReferences(params.id, currentCompanyId),
        {
            params: IdParamSchema,
            response: BrandReferencesResponseSchema,
            permission: 'brands.read',
        }
    )

    // Create
    .post(
        '/',
        async ({ body, set, headers, currentCompanyId }) => {
            const brand = await brandsService.create(
                body as BrandBodyType,
                currentCompanyId,
                headers['x-client-id']
            );
            set.status = 201;
            return brand;
        },
        {
            body: BrandBodySchema,
            permission: 'brands.create',
        }
    )

    // Update
    .put(
        '/:id',
        ({ params, body, headers, currentCompanyId }) =>
            brandsService.update(
                params.id,
                body as BrandUpdateType,
                currentCompanyId,
                headers['x-client-id']
            ),
        {
            params: IdParamSchema,
            body: BrandUpdateBodySchema,
            permission: 'brands.update',
        }
    )

    // Deactivate
    .patch(
        '/:id/deactivate',
        ({ params, headers, currentCompanyId }) =>
            brandsService.deactivate(params.id, currentCompanyId, headers['x-client-id']),
        {
            params: IdParamSchema,
            permission: 'brands.delete',
        }
    )

    // Restore
    .patch(
        '/:id/restore',
        ({ params, headers, currentCompanyId }) =>
            brandsService.restore(params.id, currentCompanyId, headers['x-client-id']),
        {
            params: IdParamSchema,
            permission: 'brands.restore',
        }
    )

    // Hard delete
    .delete(
        '/:id',
        async ({ params, headers, currentCompanyId }) => {
            await brandsService.hardDelete(params.id, currentCompanyId, headers['x-client-id']);
            return { success: true } as const;
        },
        {
            params: IdParamSchema,
            response: SuccessResponseSchema,
            permission: 'brands.destroy',
        }
    )

    // Bulk deactivate
    .delete(
        '/bulk',
        ({ body, headers, currentCompanyId }) =>
            brandsService.bulkDeactivate(body.ids, currentCompanyId, headers['x-client-id']),
        {
            body: BulkIdsBodySchema,
            permission: 'brands.delete',
        }
    )

    // Bulk restore
    .patch(
        '/bulk/restore',
        ({ body, headers, currentCompanyId }) =>
            brandsService.bulkRestore(body.ids, currentCompanyId, headers['x-client-id']),
        {
            body: BulkIdsBodySchema,
            permission: 'brands.restore',
        }
    );
