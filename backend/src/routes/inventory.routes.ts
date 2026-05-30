import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import {
    listWarehouses, getWarehouse, createWarehouse, updateWarehouse, deactivateWarehouse, restoreWarehouse,
} from '../services/inventory.service';

export const inventoryRoutes = new Elysia({ prefix: '/inventory' })
    .use(authGuard)

    // ====== WAREHOUSES ======
    .get('/warehouses', ({ currentCompanyId }) => listWarehouses(currentCompanyId))
    .get(
        '/warehouses/:id',
        ({ params, currentCompanyId }) => getWarehouse(Number(params.id), currentCompanyId),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .post(
        '/warehouses',
        async ({ body, set, currentCompanyId }) => {
            const warehouse = await createWarehouse(body, currentCompanyId);
            set.status = 201;
            return warehouse;
        },
        {
            body: t.Object({
                code: t.String({ maxLength: 20 }),
                name: t.String({ maxLength: 100 }),
                address: t.Optional(t.String({ maxLength: 255 })),
                is_mobile: t.Optional(t.Boolean()),
                manager_id: t.Optional(t.Number()),
            }),
        }
    )
    .put(
        '/warehouses/:id',
        ({ params, body, currentCompanyId }) => updateWarehouse(Number(params.id), body, currentCompanyId),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Partial(
                t.Object({
                    code: t.String({ maxLength: 20 }),
                    name: t.String({ maxLength: 100 }),
                    address: t.Nullable(t.String({ maxLength: 255 })),
                    is_mobile: t.Boolean(),
                    manager_id: t.Nullable(t.Number()),
                    is_active: t.Boolean(),
                })
            ),
        }
    )
    .patch(
        '/warehouses/:id/deactivate',
        ({ params, currentCompanyId }) => deactivateWarehouse(Number(params.id), currentCompanyId),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .patch(
        '/warehouses/:id/restore',
        ({ params, currentCompanyId }) => restoreWarehouse(Number(params.id), currentCompanyId),
        { params: t.Object({ id: t.Numeric() }) }
    );

