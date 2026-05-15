import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import {
    listBrands, createBrand, updateBrand, deactivateBrand, restoreBrand,
    listFamilies, createFamily, updateFamily, deactivateFamily, restoreFamily,
} from '../services/categories.service';

export const categorieRoutes = new Elysia({ prefix: '/categories' })
    .use(authGuard)

    // NOTE: UOM routes are now in uom.routes.ts (tenant-aware, integer PK)

    // ====== BRANDS ======
    .get('/brands', () => listBrands())
    .post(
        '/brands',
        async ({ body, set }) => {
            const brand = await createBrand(body);
            set.status = 201;
            return brand;
        },
        {
            body: t.Object({
                name: t.String({ maxLength: 100 }),
                website: t.Optional(t.String({ maxLength: 255 })),
            }),
        }
    )
    .put(
        '/brands/:id',
        ({ params, body }) => updateBrand(Number(params.id), body),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Partial(
                t.Object({
                    name: t.String({ maxLength: 100 }),
                    website: t.String({ maxLength: 255 }),
                    is_active: t.Boolean(),
                })
            ),
        }
    )
    .patch(
        '/brands/:id/deactivate',
        ({ params }) => deactivateBrand(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .patch(
        '/brands/:id/restore',
        ({ params }) => restoreBrand(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )

    // ====== FAMILIES ======
    .get('/families', () => listFamilies())
    .post(
        '/families',
        async ({ body, set }) => {
            const family = await createFamily(body);
            set.status = 201;
            return family;
        },
        {
            body: t.Object({
                name: t.String({ maxLength: 100 }),
                categoryId: t.Optional(t.Number()),
                description: t.Optional(t.String({ maxLength: 255 })),
            }),
        }
    )
    .put(
        '/families/:id',
        ({ params, body }) => updateFamily(Number(params.id), body),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Partial(
                t.Object({
                    name: t.String({ maxLength: 100 }),
                    categoryId: t.Nullable(t.Number()),
                    description: t.Nullable(t.String({ maxLength: 255 })),
                })
            ),
        }
    )
    .patch(
        '/families/:id/deactivate',
        ({ params }) => deactivateFamily(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .patch(
        '/families/:id/restore',
        ({ params }) => restoreFamily(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    );
