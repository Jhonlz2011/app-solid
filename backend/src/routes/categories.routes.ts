import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
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
    .get(
        '/',
        ({ query, currentCompanyId }) => listCategoriesEnhanced(currentCompanyId, query.flat === 'true'),
        {
            query: t.Object({
                flat: t.Optional(t.String()),
            }),
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
        }
    )

    .get(
        '/:id',
        ({ params, currentCompanyId }) => getCategoryEnhanced(Number(params.id), currentCompanyId),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .get(
        '/:id/form-schema',
        ({ params, currentCompanyId }) => getCategoryFormSchema(Number(params.id), currentCompanyId),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .get(
        '/:id/references',
        ({ params, currentCompanyId }) => checkCategoryReferences(Number(params.id), currentCompanyId),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .post(
        '/',
        async ({ body, set, currentCompanyId }) => {
            const category = await createCategoryEnhanced({ ...body, companyId: currentCompanyId } as CategoryPayload);
            set.status = 201;
            return category;
        },
        {
            body: CategoryBodySchema,
        }
    )
    .put(
        '/:id',
        ({ params, body, currentCompanyId }) => updateCategoryEnhanced(Number(params.id), body as Partial<CategoryPayload>, currentCompanyId),
        {
            params: t.Object({ id: t.Numeric() }),
            body: CategoryUpdateSchema,
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
        { params: t.Object({ id: t.Numeric() }) }
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
        { params: t.Object({ id: t.Numeric() }) }
    )
    .patch(
        '/:id/reparent',
        ({ params, body, currentCompanyId }) => reparentCategory(Number(params.id), body.parent_id, currentCompanyId),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Object({
                parent_id: t.Nullable(t.Number()),
            }),
        }
    )
    .patch(
        '/reorder',
        ({ body, currentCompanyId }) => reorderCategories(body.items, currentCompanyId),
        {
            body: t.Object({
                items: t.Array(t.Object({
                    id: t.Number(),
                    sort_order: t.Number(),
                })),
            }),
        }
    )
    .delete(
        '/:id',
        async ({ params, currentCompanyId }) => {
            await hardDeleteCategory(Number(params.id), currentCompanyId);
            return { success: true } as const;
        },
        { params: t.Object({ id: t.Numeric() }) }
    );
