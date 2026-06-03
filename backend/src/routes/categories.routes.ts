import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { rbac } from '../plugins/rbac';
import {
    listCategoriesEnhanced,
    getCategoryEnhanced,
    getCategoryFormSchema,
    createCategoryEnhanced,
    updateCategoryEnhanced,
    deactivateCategory,
    restoreCategory,
    reorderCategories,
    reparentCategory,
    checkCategoryReferences,
    hardDeleteCategory,
    bulkDeactivateCategories,
    bulkRestoreCategories,
    type CategoryPayload,
} from '../services/categories.service';
import { CategoryBodySchema, CategoryUpdateSchema } from '@app/schema/backend';
import { getIpAndUserAgent } from '../plugins/ip';

export const categoryRoutes = new Elysia({ prefix: '/categories' })
    .use(authGuard)
    .use(rbac)
    .get(
        '/',
        ({ query, currentCompanyId }) => listCategoriesEnhanced(currentCompanyId, query.flat === 'true'),
        {
            query: t.Object({
                flat: t.Optional(t.String()),
            }),
            permission: 'categories.read',
        }
    )

    // Bulk routes — BEFORE /:id to avoid route conflicts
    .delete(
        '/bulk',
        async ({ body, headers, currentUserId, currentCompanyId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return bulkDeactivateCategories(
                body.ids,
                currentCompanyId,
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }
            );
        },
        {
            body: t.Object({
                ids: t.Array(t.Number(), { minItems: 1 }),
            }),
            permission: 'categories.delete',
        }
    )
    .patch(
        '/bulk/restore',
        async ({ body, headers, currentUserId, currentCompanyId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return bulkRestoreCategories(
                body.ids,
                currentCompanyId,
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }
            );
        },
        {
            body: t.Object({
                ids: t.Array(t.Number(), { minItems: 1 }),
            }),
            permission: 'categories.restore',
        }
    )

    .get(
        '/:id',
        ({ params, currentCompanyId }) => getCategoryEnhanced(Number(params.id), currentCompanyId),
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'categories.read',
        }
    )
    .get(
        '/:id/form-schema',
        ({ params, currentCompanyId }) => getCategoryFormSchema(Number(params.id), currentCompanyId),
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'categories.read',
        }
    )
    .get(
        '/:id/references',
        ({ params, currentCompanyId }) => checkCategoryReferences(Number(params.id), currentCompanyId),
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'categories.read',
        }
    )
    .post(
        '/',
        async ({ body, set, headers, currentCompanyId }) => {
            const category = await createCategoryEnhanced(
                { ...body, companyId: currentCompanyId } as CategoryPayload,
                headers['x-client-id']
            );
            set.status = 201;
            return category;
        },
        {
            body: CategoryBodySchema,
            permission: 'categories.create',
        }
    )
    .put(
        '/:id',
        ({ params, body, headers, currentCompanyId }) =>
            updateCategoryEnhanced(
                Number(params.id),
                body as Partial<CategoryPayload>,
                currentCompanyId,
                headers['x-client-id']
            ),
        {
            params: t.Object({ id: t.Numeric() }),
            body: CategoryUpdateSchema,
            permission: 'categories.update',
        }
    )
    .patch(
        '/:id/deactivate',
        async ({ params, headers, currentUserId, currentCompanyId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return deactivateCategory(
                Number(params.id),
                currentCompanyId,
                headers['x-client-id'],
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }
            );
        },
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'categories.delete',
        }
    )
    .patch(
        '/:id/restore',
        async ({ params, headers, currentUserId, currentCompanyId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return restoreCategory(
                Number(params.id),
                currentCompanyId,
                headers['x-client-id'],
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }
            );
        },
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'categories.restore',
        }
    )
    .patch(
        '/:id/reparent',
        ({ params, body, headers, currentCompanyId }) =>
            reparentCategory(
                Number(params.id),
                body.parent_id,
                currentCompanyId,
                headers['x-client-id']
            ),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Object({
                parent_id: t.Nullable(t.Number()),
            }),
            permission: 'categories.update',
        }
    )
    .patch(
        '/reorder',
        ({ body, headers, currentCompanyId }) =>
            reorderCategories(body.items, currentCompanyId, headers['x-client-id']),
        {
            body: t.Object({
                items: t.Array(t.Object({
                    id: t.Number(),
                    sort_order: t.Number(),
                })),
            }),
            permission: 'categories.update',
        }
    )
    .delete(
        '/:id',
        async ({ params, headers, currentCompanyId }) => {
            await hardDeleteCategory(Number(params.id), currentCompanyId, headers['x-client-id']);
            return { success: true } as const;
        },
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'categories.destroy',
        }
    );
