import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import {
    listWarehouses, getWarehouse, createWarehouse, updateWarehouse, deactivateWarehouse, restoreWarehouse,
    listLocations, createLocation, updateLocation, deactivateLocation, restoreLocation,
} from '../services/inventory.service';

const LOCATION_TYPES = ['VIEW', 'INTERNAL'] as const;

export const inventoryRoutes = new Elysia({ prefix: '/inventory' })
    .use(authGuard)

    // ====== WAREHOUSES ======
    .get('/warehouses', () => listWarehouses())
    .get(
        '/warehouses/:id',
        ({ params }) => getWarehouse(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .post(
        '/warehouses',
        async ({ body, set }) => {
            const warehouse = await createWarehouse(body);
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
        ({ params, body }) => updateWarehouse(Number(params.id), body),
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
        ({ params }) => deactivateWarehouse(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .patch(
        '/warehouses/:id/restore',
        ({ params }) => restoreWarehouse(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )

    // ====== LOCATIONS ======
    .get(
        '/locations',
        ({ query }) => {
            const warehouseId = query.warehouseId ? Number(query.warehouseId) : undefined;
            return listLocations(warehouseId);
        },
        {
            query: t.Object({
                warehouseId: t.Optional(t.String()),
            }),
        }
    )
    .post(
        '/locations',
        async ({ body, set }) => {
            const location = await createLocation(body);
            set.status = 201;
            return location;
        },
        {
            body: t.Object({
                warehouse_id: t.Number(),
                name: t.String({ maxLength: 100 }),
                parent_id: t.Optional(t.Nullable(t.Number())),
                barcode: t.Optional(t.Nullable(t.String({ maxLength: 50 }))),
                type: t.Optional(t.Union(LOCATION_TYPES.map(l => t.Literal(l)))),
            }),
        }
    )
    .put(
        '/locations/:id',
        ({ params, body }) => updateLocation(Number(params.id), body),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Partial(
                t.Object({
                    name: t.String({ maxLength: 100 }),
                    barcode: t.Nullable(t.String({ maxLength: 50 })),
                    type: t.Union(LOCATION_TYPES.map(l => t.Literal(l))),
                    is_active: t.Boolean(),
                })
            ),
        }
    )
    .patch(
        '/locations/:id/deactivate',
        ({ params }) => deactivateLocation(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .patch(
        '/locations/:id/restore',
        ({ params }) => restoreLocation(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    );
