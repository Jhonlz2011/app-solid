import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import {
    listUom, createUom,
    listBrands, createBrand, updateBrand, deleteBrand,
    listAttributeDefinitions, createAttributeDefinition,
} from '../services/catalogs.service';

export const catalogRoutes = new Elysia({ prefix: '/catalogs' })
    .use(authGuard)
    // ====== UOM ======
    .get('/uom', () => listUom())
    .post(
        '/uom',
        async ({ body, set }) => {
            const uom = await createUom(body);
            set.status = 201;
            return uom;
        },
        {
            body: t.Object({
                code: t.String({ maxLength: 10 }),
                name: t.String({ maxLength: 50 }),
            }),
        }
    )
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
                })
            ),
        }
    )
    .delete(
        '/brands/:id',
        async ({ params, set }) => {
            await deleteBrand(Number(params.id));
            set.status = 204;
        },
        {
            params: t.Object({ id: t.Numeric() }),
        }
    )
    // ====== ATTRIBUTES ======
    .get('/attributes', () => listAttributeDefinitions())
    .post(
        '/attributes',
        async ({ body, set }) => {
            const attr = await createAttributeDefinition(body);
            set.status = 201;
            return attr;
        },
        {
            body: t.Object({
                key: t.String({ maxLength: 50 }),
                label: t.String({ maxLength: 50 }),
                type: t.String({ maxLength: 20 }),
                defaultOptions: t.Optional(t.Any()),
            }),
        }
    );
