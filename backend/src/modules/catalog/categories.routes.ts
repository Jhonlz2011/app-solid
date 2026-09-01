import { Elysia } from 'elysia';
import { tenantGuard } from '../../plugins/tenant-guard';
import { rbac } from '../../plugins/rbac';
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
} from './categories.service';
import type { CategoryBodyType } from '@app/schema/dto';
import {
    CategoryBodySchema,
    CategoryUpdateSchema,
    CategoryReparentSchema,
    CategoryReorderSchema,
    CategoryListQuerySchema,
    CategoryReferencesResponseSchema,
    BulkIdsBodySchema,
    IdParamSchema,
    SuccessResponseSchema,
} from '@app/schema/backend';
import { getIpAndUserAgent } from '../../plugins/ip';

export const categoryRoutes = new Elysia({ prefix: '/categories' })
    .use(tenantGuard)
    .use(rbac)
    // ─── LIST CATEGORIES (flat or tree) ───────────────────────────
    .get(
        '/',
        ({ query, currentCompanyId }) =>
            listCategoriesEnhanced(currentCompanyId, query.flat === 'true' || query.flat === true),
        {
            query: CategoryListQuerySchema,
            permission: 'categories.read',
        }
    )

    // ─── BULK & STATIC ROUTES (BEFORE /:id to prevent route shadowing) ───
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
            body: BulkIdsBodySchema,
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
            body: BulkIdsBodySchema,
            permission: 'categories.restore',
        }
    )
    .patch(
        '/reorder',
        ({ body, headers, currentCompanyId }) =>
            reorderCategories(body.items, currentCompanyId, headers['x-client-id']),
        {
            body: CategoryReorderSchema,
            permission: 'categories.update',
        }
    )

    // ─── PARAMETERIZED ROUTES (/:id) ─────────────────────────────
    .get(
        '/:id',
        ({ params, currentCompanyId }) => getCategoryEnhanced(params.id, currentCompanyId),
        {
            params: IdParamSchema,
            permission: 'categories.read',
        }
    )
    .get(
        '/:id/form-schema',
        ({ params, currentCompanyId }) => getCategoryFormSchema(params.id, currentCompanyId),
        {
            params: IdParamSchema,
            permission: 'categories.read',
        }
    )
    .get(
        '/:id/references',
        ({ params, currentCompanyId }) => checkCategoryReferences(params.id, currentCompanyId),
        {
            params: IdParamSchema,
            response: CategoryReferencesResponseSchema,
            permission: 'categories.read',
        }
    )
    .post(
        '/',
        async ({ body, set, headers, currentCompanyId }) => {
            const category = await createCategoryEnhanced(
                { ...body, companyId: currentCompanyId } as CategoryBodyType,
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
                params.id,
                body as Partial<CategoryBodyType>,
                currentCompanyId,
                headers['x-client-id']
            ),
        {
            params: IdParamSchema,
            body: CategoryUpdateSchema,
            permission: 'categories.update',
        }
    )
    .patch(
        '/:id/deactivate',
        async ({ params, headers, currentUserId, currentCompanyId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return deactivateCategory(
                params.id,
                currentCompanyId,
                headers['x-client-id'],
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }
            );
        },
        {
            params: IdParamSchema,
            permission: 'categories.delete',
        }
    )
    .patch(
        '/:id/restore',
        async ({ params, headers, currentUserId, currentCompanyId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return restoreCategory(
                params.id,
                currentCompanyId,
                headers['x-client-id'],
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }
            );
        },
        {
            params: IdParamSchema,
            permission: 'categories.restore',
        }
    )
    .patch(
        '/:id/reparent',
        ({ params, body, headers, currentCompanyId }) =>
            reparentCategory(
                params.id,
                body.parent_id,
                currentCompanyId,
                headers['x-client-id']
            ),
        {
            params: IdParamSchema,
            body: CategoryReparentSchema,
            permission: 'categories.update',
        }
    )
    .delete(
        '/:id',
        async ({ params, headers, currentCompanyId }) => {
            await hardDeleteCategory(params.id, currentCompanyId, headers['x-client-id']);
            return { success: true } as const;
        },
        {
            params: IdParamSchema,
            response: SuccessResponseSchema,
            permission: 'categories.destroy',
        }
    );
