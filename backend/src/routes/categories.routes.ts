import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import {
    listCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory,
    addCategoryAttribute,
} from '../services/catalogs.service';

export const categoryRoutes = new Elysia({ prefix: '/categories' })
    .use(authGuard)
    .get(
        '/',
        ({ query }) => listCategories(query.flat === 'true'),
        {
            query: t.Object({
                flat: t.Optional(t.String()), // 'true' for flat list, else tree
            }),
        }
    )
    .get(
        '/:id',
        ({ params }) => getCategory(Number(params.id)),
        {
            params: t.Object({ id: t.Numeric() }),
        }
    )
    .post(
        '/',
        async ({ body, set }) => {
            const category = await createCategory(body);
            set.status = 201;
            return category;
        },
        {
            body: t.Object({
                name: t.String(),
                parentId: t.Optional(t.Number()),
                nameTemplate: t.Optional(t.String()),
            }),
        }
    )
    .put(
        '/:id',
        ({ params, body }) => updateCategory(Number(params.id), body),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Partial(
                t.Object({
                    name: t.String(),
                    parentId: t.Number(),
                    nameTemplate: t.String(),
                })
            ),
        }
    )
    .delete(
        '/:id',
        async ({ params, set }) => {
            await deleteCategory(Number(params.id));
            set.status = 204;
        },
        {
            params: t.Object({ id: t.Numeric() }),
        }
    )
    .post(
        '/:id/attributes',
        async ({ params, body, set }) => {
            const attr = await addCategoryAttribute(Number(params.id), body);
            set.status = 201;
            return attr;
        },
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Object({
                attributeDefId: t.Number(),
                required: t.Optional(t.Boolean()),
                order: t.Optional(t.Number()),
                specificOptions: t.Optional(t.Any()),
            }),
        }
    );
