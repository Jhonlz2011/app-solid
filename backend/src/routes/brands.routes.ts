import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { rbac } from '../plugins/rbac';
import { brandsService } from '../services/brands.service';

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
                limit: query.limit ? Number(query.limit) : undefined,
                search: query.search,
                sortBy: query.sortBy,
                sortOrder: query.sortOrder as 'asc' | 'desc' | undefined,
                page: query.page ? Number(query.page) : undefined,
                isActive: parseArray(query.isActive),
            }, currentCompanyId);
        },
        {
            query: t.Object({
                cursor: t.Optional(t.String()),
                direction: t.Optional(t.String()),
                search: t.Optional(t.String()),
                limit: t.Optional(t.Numeric()),
                sortBy: t.Optional(t.String()),
                sortOrder: t.Optional(t.String()),
                page: t.Optional(t.Numeric()),
                isActive: t.Optional(t.String()),
            }),
            permission: 'brands.read',
        }
    )

    // Simple list (for selectors)
    .get('/all', ({ currentCompanyId }) => brandsService.listAll(currentCompanyId), {
        permission: 'brands.read',
    })

    // Create
    .post(
        '/',
        async ({ body, set, currentCompanyId }) => {
            const brand = await brandsService.create(body, currentCompanyId);
            set.status = 201;
            return brand;
        },
        {
            body: t.Object({
                name: t.String({ maxLength: 100 }),
                website: t.Optional(t.String({ maxLength: 255 })),
            }),
            permission: 'brands.create',
        }
    )

    // Update
    .put(
        '/:id',
        ({ params, body, currentCompanyId }) => brandsService.update(Number(params.id), body, currentCompanyId),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Partial(t.Object({
                name: t.String({ maxLength: 100 }),
                website: t.String({ maxLength: 255 }),
                is_active: t.Boolean(),
            })),
            permission: 'brands.update',
        }
    )

    // Deactivate
    .patch(
        '/:id/deactivate',
        ({ params, currentCompanyId }) => brandsService.deactivate(Number(params.id), currentCompanyId),
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'brands.delete',
        }
    )

    // Restore
    .patch(
        '/:id/restore',
        ({ params, currentCompanyId }) => brandsService.restore(Number(params.id), currentCompanyId),
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'brands.restore',
        }
    )

    // Bulk deactivate
    .delete(
        '/bulk',
        ({ body, currentCompanyId }) => brandsService.bulkDeactivate(body.ids, currentCompanyId),
        {
            body: t.Object({ ids: t.Array(t.Number(), { minItems: 1 }) }),
            permission: 'brands.delete',
        }
    )

    // Bulk restore
    .patch(
        '/bulk/restore',
        ({ body, currentCompanyId }) => brandsService.bulkRestore(body.ids, currentCompanyId),
        {
            body: t.Object({ ids: t.Array(t.Number(), { minItems: 1 }) }),
            permission: 'brands.restore',
        }
    );
