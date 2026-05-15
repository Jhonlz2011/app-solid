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
} from '../services/categories.service';
import { CategoryBodySchema, CategoryUpdateSchema } from '@app/schema/backend';

export const categoryRoutes = new Elysia({ prefix: '/categories' })
    .use(authGuard)
    .get(
        '/',
        ({ query }) => listCategoriesEnhanced(query.flat === 'true'),
        {
            query: t.Object({
                flat: t.Optional(t.String()),
            }),
        }
    )
    .get(
        '/:id',
        ({ params }) => getCategoryEnhanced(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .get(
        '/:id/form-schema',
        ({ params }) => getCategoryFormSchema(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .post(
        '/',
        async ({ body, set }) => {
            const category = await createCategoryEnhanced(body as any);
            set.status = 201;
            return category;
        },
        {
            body: CategoryBodySchema,
        }
    )
    .put(
        '/:id',
        ({ params, body }) => updateCategoryEnhanced(Number(params.id), body as any),
        {
            params: t.Object({ id: t.Numeric() }),
            body: CategoryUpdateSchema,
        }
    )
    .patch(
        '/:id/deactivate',
        ({ params }) => deactivateCategory(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .patch(
        '/:id/restore',
        ({ params }) => restoreCategory(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .patch(
        '/reorder',
        ({ body }) => reorderCategories(body.items),
        {
            body: t.Object({
                items: t.Array(t.Object({
                    id: t.Number(),
                    sort_order: t.Number(),
                })),
            }),
        }
    );
