import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import {
    getBomForProduct,
    getBom,
    createBom,
    updateBom,
    deleteBom,
} from '../services/bom.service';

export const bomRoutes = new Elysia({ prefix: '/bom' })
    .use(authGuard)
    .get(
        '/product/:productId',
        ({ params }) => getBomForProduct(Number(params.productId)),
        {
            params: t.Object({ productId: t.Numeric() }),
        }
    )
    .get(
        '/:id',
        ({ params }) => getBom(Number(params.id)),
        {
            params: t.Object({ id: t.Numeric() }),
        }
    )
    .post(
        '/',
        async ({ body, set }) => {
            const bom = await createBom(body);
            set.status = 201;
            return bom;
        },
        {
            body: t.Object({
                productId: t.Number(),
                name: t.Optional(t.String()),
                revision: t.Optional(t.Number()),
                components: t.Array(
                    t.Object({
                        componentProductId: t.Number(),
                        quantityNeeded: t.Number({ minimum: 0.0001 }),
                        wastagePercent: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
                    })
                ),
            }),
        }
    )
    .put(
        '/:id',
        ({ params, body }) => updateBom(Number(params.id), body),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Partial(
                t.Object({
                    name: t.String(),
                    components: t.Array(
                        t.Object({
                            componentProductId: t.Number(),
                            quantityNeeded: t.Number({ minimum: 0.0001 }),
                            wastagePercent: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
                        })
                    ),
                })
            ),
        }
    )
    .delete(
        '/:id',
        async ({ params, set }) => {
            await deleteBom(Number(params.id));
            set.status = 204;
        },
        {
            params: t.Object({ id: t.Numeric() }),
        }
    );
