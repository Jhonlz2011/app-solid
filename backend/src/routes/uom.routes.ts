import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { uomService } from '../services/uom.service';

const UOM_GROUPS = ['VOLUMEN', 'LONGITUD', 'PESO', 'AREA', 'CANTIDAD', 'TIEMPO', 'DATA'] as const;

export const uomRoutes = new Elysia({ prefix: '/uom' })
    .use(authGuard)

    // Simple catalog list (all system + tenant UOMs)
    .get('/', ({ currentCompanyId }) => uomService.listUoms(currentCompanyId))

    // Create (tenant-scoped, never system)
    .post(
        '/',
        async ({ body, set, currentCompanyId }) => {
            const created = await uomService.create(body, currentCompanyId);
            set.status = 201;
            return created;
        },
        {
            body: t.Object({
                code: t.String({ maxLength: 10 }),
                name: t.String({ maxLength: 50 }),
                uom_group: t.Union(UOM_GROUPS.map(g => t.Literal(g))),
                base_factor: t.Optional(t.String()),
            }),
        }
    )

    // Update by integer id (blocks system UOMs)
    .put(
        '/:id',
        ({ params, body, currentCompanyId }) => uomService.update(params.id, body, currentCompanyId),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Partial(t.Object({
                name: t.String({ maxLength: 50 }),
                uom_group: t.Union(UOM_GROUPS.map(g => t.Literal(g))),
                base_factor: t.String(),
                is_active: t.Boolean(),
            })),
        }
    )

    // Check references before hard delete
    .get(
        '/:id/references',
        ({ params, currentCompanyId }) => uomService.checkReferences(params.id),
        {
            params: t.Object({ id: t.Numeric() }),
            response: t.Object({
                products: t.Number(),
                variants: t.Number(),
                supplierProducts: t.Number(),
                conversions: t.Number(),
                workOrderItems: t.Number(),
                quoteItems: t.Number(),
                total: t.Number(),
            }),
        }
    )

    // Soft delete (deactivate) — sets is_active = false
    .patch(
        '/:id/deactivate',
        async ({ params, set, currentCompanyId }) => {
            await uomService.deactivate(params.id, currentCompanyId);
            set.status = 204;
        },
        { params: t.Object({ id: t.Numeric() }) }
    )

    // Restore a soft-deleted UOM back to active
    .patch(
        '/:id/restore',
        ({ params, currentCompanyId }) => uomService.restore(params.id, currentCompanyId),
        { params: t.Object({ id: t.Numeric() }) }
    )

    // Hard delete (blocks system UOMs and UOMs with references)
    .delete(
        '/:id',
        async ({ params, currentCompanyId }) => {
            await uomService.hardDelete(params.id, currentCompanyId);
            return { success: true } as const;
        },
        {
            params: t.Object({ id: t.Numeric() }),
            response: t.Object({ success: t.Literal(true) }),
        }
    );
