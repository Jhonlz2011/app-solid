import { Elysia } from 'elysia';
import { authGuard } from '../../plugins/auth-guard';
import { rbac } from '../../plugins/rbac';
import { brandsService } from './brands.service';
import {
    BrandBodySchema,
    BrandUpdateSchema,
    BrandListQuerySchema,
    BulkIdsBodySchema,
    IdParamSchema,
} from '@app/schema/backend';

const parseArray = (val?: string) => val?.split(',').filter(Boolean);

export const brandRoutes = new Elysia({ prefix: '/brands' })
    .use(authGuard)
    .use(rbac)

    // Paginated list
    .get(
        '/',
        ({ query, currentCompanyId }) => {
            return brandsService.list({
                cursor: query.cursor,
                direction: query.direction as any,
                limit: query.limit,
                search: query.search,
                sortBy: query.sortBy,
                sortOrder: query.sortOrder as 'asc' | 'desc' | undefined,
                page: query.page,
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

    // Create
    .post(
        '/',
        async ({ body, set, currentCompanyId }) => {
            const brand = await brandsService.create(body, currentCompanyId);
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
        ({ params, body, currentCompanyId }) => brandsService.update(params.id, body, currentCompanyId),
        {
            params: IdParamSchema,
            body: BrandUpdateSchema,
            permission: 'brands.update',
        }
    )

    // Deactivate
    .patch(
        '/:id/deactivate',
        ({ params, currentCompanyId }) => brandsService.deactivate(params.id, currentCompanyId),
        {
            params: IdParamSchema,
            permission: 'brands.delete',
        }
    )

    // Restore
    .patch(
        '/:id/restore',
        ({ params, currentCompanyId }) => brandsService.restore(params.id, currentCompanyId),
        {
            params: IdParamSchema,
            permission: 'brands.restore',
        }
    )

    // Bulk deactivate
    .delete(
        '/bulk',
        ({ body, currentCompanyId }) => brandsService.bulkDeactivate(body.ids, currentCompanyId),
        {
            body: BulkIdsBodySchema,
            permission: 'brands.delete',
        }
    )

    // Bulk restore
    .patch(
        '/bulk/restore',
        ({ body, currentCompanyId }) => brandsService.bulkRestore(body.ids, currentCompanyId),
        {
            body: BulkIdsBodySchema,
            permission: 'brands.restore',
        }
    );
