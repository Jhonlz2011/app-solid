import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { rbac } from '../plugins/rbac';
import {
    listAttributes,
    getAttribute,
    createAttribute,
    updateAttribute,
    deactivateAttribute,
    restoreAttribute,
    checkAttributeReferences,
    hardDeleteAttribute,
} from '../services/attributes.service';

const AttributeOptionSchema = t.Array(t.String());
const AttributeTypeSchema = t.Union([t.Literal('TEXT'), t.Literal('NUMBER'), t.Literal('SELECT'), t.Literal('BOOLEAN')]);

export const attributeRoutes = new Elysia({ prefix: '/attributes' })
    .use(authGuard)
    .use(rbac)

    // List all attributes for the current tenant
    .get('/', ({ currentCompanyId }) => listAttributes(currentCompanyId), {
        permission: 'attributes.read',
    })

    // Get single attribute with usedInCategories
    .get(
        '/:id',
        ({ params, currentCompanyId }) => getAttribute(params.id, currentCompanyId),
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'attributes.read',
        }
    )

    // Create a new attribute
    .post(
        '/',
        async ({ body, set, currentCompanyId }) => {
            const attr = await createAttribute(body, currentCompanyId);
            set.status = 201;
            return attr;
        },
        {
            body: t.Object({
                label: t.String({ maxLength: 100 }),
                type: AttributeTypeSchema,
                defaultOptions: t.Optional(AttributeOptionSchema),
            }),
            permission: 'attributes.create',
        }
    )

    // Update an attribute
    .put(
        '/:id',
        ({ params, body, currentCompanyId }) => updateAttribute(params.id, body, currentCompanyId),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Partial(
                t.Object({
                    label: t.String({ maxLength: 100 }),
                    type: AttributeTypeSchema,
                    defaultOptions: t.Nullable(AttributeOptionSchema),
                    renamedOptions: t.Array(t.Object({ from: t.String(), to: t.String() })),
                })
            ),
            permission: 'attributes.update',
        }
    )

    // Check references before hard delete (tenant-scoped)
    .get(
        '/:id/references',
        ({ params, currentCompanyId }) => checkAttributeReferences(params.id, currentCompanyId),
        {
            params: t.Object({ id: t.Numeric() }),
            response: t.Object({
                categories: t.Number(),
                total: t.Number(),
            }),
            permission: 'attributes.read',
        }
    )

    // Soft delete (deactivate) — sets is_active = false
    .patch(
        '/:id/deactivate',
        async ({ params, set, currentCompanyId }) => {
            await deactivateAttribute(params.id, currentCompanyId);
            set.status = 204;
        },
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'attributes.delete',
        }
    )

    // Restore a soft-deleted attribute
    .patch(
        '/:id/restore',
        ({ params, currentCompanyId }) => restoreAttribute(params.id, currentCompanyId),
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'attributes.restore',
        }
    )

    // Hard delete (blocks if used by categories)
    .delete(
        '/:id',
        async ({ params, currentCompanyId }) => {
            await hardDeleteAttribute(params.id, currentCompanyId);
            return { success: true } as const;
        },
        {
            params: t.Object({ id: t.Numeric() }),
            response: t.Object({ success: t.Literal(true) }),
            permission: 'attributes.destroy',
        }
    );
