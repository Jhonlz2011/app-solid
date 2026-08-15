import { Elysia, t } from 'elysia';
import { authGuard } from '../../plugins/auth-guard';
import { listForPicker } from './entities.query.service';
import {
    EntityFormSchema,
    EntityUpdateSchema,
    ContactPayloadSchema,
    AddressPayloadSchema,
    EntityPickerQuerySchema,
    EntityListQuerySchema,
    EntityFacetsQuerySchema,
    EntityReferencesResponseSchema,
    BulkIdsBodySchema,
    IdParamSchema,
    SuccessResponseSchema,
} from '@app/schema/backend';
import type { EntityPayload, EntityAddressPayload, EntityContactPayload } from '@app/schema/dto';
import { getIpAndUserAgent } from '../../plugins/ip';
import { rbac } from '../../plugins/rbac';
import { createEntityService } from './entities.service';
import { addAddress, addContact, updateContact, deleteContact } from './entities.command.service';
import { getAddresses, getContacts, type EntityType } from './entities.query.service';

/**
 * Entities routes — lightweight endpoints for entity picker/autocomplete.
 * Mounted at /api/entities via server.ts.
 */
export const entityRoutes = new Elysia({ prefix: '/entities' })
    .use(authGuard)
    .get(
        '/',
        ({ query, currentCompanyId }) => {
            return listForPicker(
                currentCompanyId,
                query.search,
                query.limit ? Number(query.limit) : 200,
            );
        },
        {
            query: EntityPickerQuerySchema,
        }
    );

/** Parse comma-separated string into array (shared by list + facets) */
const parseArray = (val?: string) => val?.split(',').filter(Boolean);

/**
 * Generic factory for entity routes (Suppliers, Clients, Employees).
 * Replaces boilerplate route files with a single generic implementation.
 */
export function createEntityRoutes(config: { prefix: string; type: EntityType; permission: string }) {
    const service = createEntityService(config.type);

    return new Elysia({ prefix: config.prefix })
        .use(authGuard)
        .use(rbac)
        // List with cursor pagination
        .get(
            '/',
            ({ query, currentCompanyId }) => {
                return service.list({
                    cursor: query.cursor,
                    direction: query.direction as 'next' | 'prev' | 'first' | 'last' | undefined,
                    limit: query.limit ? Number(query.limit) : undefined,
                    search: query.search,
                    sortBy: query.sortBy,
                    sortOrder: query.sortOrder as 'asc' | 'desc' | undefined,
                    page: query.page ? Number(query.page) : undefined,
                    personType: parseArray(query.personType),
                    taxIdType: parseArray(query.taxIdType),
                    isActive: parseArray(query.isActive),
                    businessName: parseArray(query.businessName),
                }, currentCompanyId);
            },
            {
                query: EntityListQuerySchema,
                permission: `${config.permission}.read`,
            }
        )
        // Get faceted filter values + counts (with cross-filtering)
        .get(
            '/facets',
            ({ query, currentCompanyId }) => {
                return service.facets({
                    search: query.search,
                    personType: parseArray(query.personType),
                    taxIdType: parseArray(query.taxIdType),
                    isActive: parseArray(query.isActive),
                    businessName: parseArray(query.businessName),
                }, currentCompanyId);
            },
            {
                query: EntityFacetsQuerySchema,
                permission: `${config.permission}.read`,
            }
        )
        .get(
            '/:id',
            ({ params, currentCompanyId }) => service.get(Number(params.id), currentCompanyId),
            {
                params: IdParamSchema,
                permission: `${config.permission}.read`,
            }
        )
        .post(
            '/',
            async ({ body, set, headers, currentUserId, currentCompanyId, request }) => {
                const { ipAddress } = getIpAndUserAgent(request);
                const entity = await service.create(
                    body as EntityPayload,
                    { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] },
                    currentCompanyId
                );
                set.status = 201;
                return entity;
            },
            {
                body: EntityFormSchema,
                permission: `${config.permission}.create`,
            }
        )
        .put(
            '/:id',
            ({ params, body, headers, currentUserId, currentCompanyId, request }) => {
                const { ipAddress } = getIpAndUserAgent(request);
                return service.update(
                    Number(params.id),
                    body as Partial<EntityPayload>,
                    { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] },
                    currentCompanyId
                );
            },
            {
                params: IdParamSchema,
                body: EntityUpdateSchema,
                permission: `${config.permission}.update`,
            }
        )
        // Bulk deactivate (soft delete)
        .delete(
            '/bulk',
            async ({ body, headers, currentUserId, currentCompanyId, request }) => {
                const { ipAddress } = getIpAndUserAgent(request);
                return service.bulkDelete(
                    body.ids,
                    { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] },
                    currentCompanyId
                );
            },
            {
                body: BulkIdsBodySchema,
                permission: `${config.permission}.delete`,
            }
        )
        // Bulk restore
        .patch(
            '/bulk/restore',
            async ({ body, headers, currentUserId, currentCompanyId, request }) => {
                const { ipAddress } = getIpAndUserAgent(request);
                return service.bulkRestore(
                    body.ids,
                    { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] },
                    currentCompanyId
                );
            },
            {
                body: BulkIdsBodySchema,
                permission: `${config.permission}.restore`,
            }
        )
        // Pre-flight: check references
        .get(
            '/:id/can-delete',
            ({ params, currentCompanyId }) => service.checkReferences(Number(params.id), currentCompanyId),
            {
                params: IdParamSchema,
                response: EntityReferencesResponseSchema,
                permission: `${config.permission}.read`,
            }
        )
        // Soft delete
        .patch(
            '/:id/deactivate',
            async ({ params, set, headers, currentUserId, currentCompanyId, request }) => {
                const { ipAddress } = getIpAndUserAgent(request);
                await service.softDelete(
                    Number(params.id),
                    undefined,
                    { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] },
                    currentCompanyId
                );
                set.status = 204;
            },
            {
                params: IdParamSchema,
                permission: `${config.permission}.delete`,
            }
        )
        // Restore
        .patch(
            '/:id/restore',
            async ({ params, headers, currentUserId, currentCompanyId, request }) => {
                const { ipAddress } = getIpAndUserAgent(request);
                return service.restore(
                    Number(params.id),
                    { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] },
                    currentCompanyId
                );
            },
            {
                params: IdParamSchema,
                permission: `${config.permission}.restore`,
            }
        )
        // Hard delete
        .delete(
            '/:id',
            async ({ params, set, headers, currentUserId, currentCompanyId, request }) => {
                const { ipAddress } = getIpAndUserAgent(request);
                await service.hardDelete(
                    Number(params.id),
                    { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] },
                    currentCompanyId
                );
                set.status = 204;
            },
            {
                params: IdParamSchema,
                permission: `${config.permission}.destroy`,
            }
        )
        // Addresses
        .get(
            '/:id/addresses',
            ({ params, currentCompanyId }) => getAddresses(Number(params.id), currentCompanyId),
            {
                params: IdParamSchema,
                permission: `${config.permission}.read`,
            }
        )
        .post(
            '/:id/addresses',
            async ({ params, body, currentCompanyId, set }) => {
                const address = await addAddress(Number(params.id), body as EntityAddressPayload, currentCompanyId);
                set.status = 201;
                return address;
            },
            {
                params: IdParamSchema,
                body: AddressPayloadSchema,
                permission: `${config.permission}.update`,
            }
        )
        // Contacts
        .get(
            '/:id/contacts',
            ({ params, currentCompanyId }) => getContacts(Number(params.id), currentCompanyId),
            {
                params: IdParamSchema,
                permission: `${config.permission}.read`,
            }
        )
        .post(
            '/:id/contacts',
            async ({ params, body, currentCompanyId, set }) => {
                const contact = await addContact(Number(params.id), body as EntityContactPayload, currentCompanyId);
                set.status = 201;
                return contact;
            },
            {
                params: IdParamSchema,
                body: ContactPayloadSchema,
                permission: `${config.permission}.update`,
            }
        )
        .put(
            '/contacts/:contactId',
            ({ params, body, currentCompanyId }) => updateContact(Number(params.contactId), body as Partial<EntityContactPayload>, currentCompanyId),
            {
                params: t.Object({ contactId: t.Numeric() }),
                body: t.Partial(ContactPayloadSchema),
                permission: `${config.permission}.update`,
            }
        )
        .delete(
            '/contacts/:contactId',
            async ({ params, currentCompanyId, set }) => {
                await deleteContact(Number(params.contactId), currentCompanyId);
                set.status = 204;
            },
            {
                params: t.Object({ contactId: t.Numeric() }),
                permission: `${config.permission}.update`,
            }
        );
}

/**
 * Concrete domain entity routes instantiated directly from the factory.
 */
export const clientRoutes = createEntityRoutes({
    prefix: '/clients',
    type: 'client',
    permission: 'clients',
});

export const supplierRoutes = createEntityRoutes({
    prefix: '/suppliers',
    type: 'supplier',
    permission: 'suppliers',
});

export const employeeRoutes = createEntityRoutes({
    prefix: '/employees',
    type: 'employee',
    permission: 'employees',
});
