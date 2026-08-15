import { Elysia } from 'elysia';
import { authGuard } from '../../plugins/auth-guard';
import { rbac } from '../../plugins/rbac';
import {
    listAttributes,
    getAttribute,
    createAttribute,
    updateAttribute,
    deactivateAttribute,
    restoreAttribute,
    checkAttributeReferences,
    hardDeleteAttribute,
} from './attributes.service';
import {
    AttributeBodySchema,
    AttributeUpdateSchema,
    AttributeReferencesResponseSchema,
    IdParamSchema,
    SuccessResponseSchema,
} from '@app/schema/backend';
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
            params: IdParamSchema,
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
            body: AttributeBodySchema,
            permission: 'attributes.create',
        }
    )

    // Update an attribute
    .put(
        '/:id',
        ({ params, body, currentCompanyId }) => updateAttribute(params.id, body, currentCompanyId),
        {
            params: IdParamSchema,
            body: AttributeUpdateSchema,
            permission: 'attributes.update',
        }
    )

    // Check references before hard delete (tenant-scoped)
    .get(
        '/:id/references',
        ({ params, currentCompanyId }) => checkAttributeReferences(params.id, currentCompanyId),
        {
            params: IdParamSchema,
            response: AttributeReferencesResponseSchema,
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
            params: IdParamSchema,
            permission: 'attributes.delete',
        }
    )
    // Restore a soft-deleted attribute
    .patch(
        '/:id/restore',
        ({ params, currentCompanyId }) => restoreAttribute(params.id, currentCompanyId),
        {
            params: IdParamSchema,
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
            params: IdParamSchema,
            response: SuccessResponseSchema,
            permission: 'attributes.destroy',
        }
    );
