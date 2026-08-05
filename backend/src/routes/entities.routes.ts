import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { listForPicker } from '../services/entities.service';

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
            query: t.Object({
                search: t.Optional(t.String()),
                limit: t.Optional(t.Numeric()),
            }),
        }
    );

import { getIpAndUserAgent } from '../plugins/ip';
import { rbac } from '../plugins/rbac';
import { EntityFormSchema, EntityUpdateSchema, ContactPayloadSchema, AddressPayloadSchema } from '@app/schema/backend';
import { createEntityService } from '../services/entities.service';
import { addAddress, addContact, updateContact, deleteContact } from '../services/entities/entities.command.service';
import { getAddresses, getContacts, type EntityType } from '../services/entities/entities.query.service';

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
                query: t.Object({
                    cursor: t.Optional(t.String()),
                    direction: t.Optional(t.String()),
                    search: t.Optional(t.String()),
                    limit: t.Optional(t.Numeric()),
                    sortBy: t.Optional(t.String()),
                    sortOrder: t.Optional(t.String()),
                    page: t.Optional(t.Numeric()),
                    personType: t.Optional(t.String()),
                    taxIdType: t.Optional(t.String()),
                    isActive: t.Optional(t.String()),
                    businessName: t.Optional(t.String()),
                }),
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
                query: t.Object({
                    search: t.Optional(t.String()),
                    personType: t.Optional(t.String()),
                    taxIdType: t.Optional(t.String()),
                    isActive: t.Optional(t.String()),
                    businessName: t.Optional(t.String()),
                }),
                permission: `${config.permission}.read`,
            }
        )
        .get(
            '/:id',
            ({ params, currentCompanyId }) => service.get(Number(params.id), currentCompanyId),
            {
                params: t.Object({ id: t.Numeric() }),
                permission: `${config.permission}.read`,
            }
        )
        .post(
            '/',
            async ({ body, set, headers, currentUserId, currentCompanyId, request }) => {
                const { ipAddress } = getIpAndUserAgent(request);
                const entity = await service.create(body as any, { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }, currentCompanyId);
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
                return service.update(Number(params.id), body as any, { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }, currentCompanyId);
            },
            {
                params: t.Object({ id: t.Numeric() }),
                body: EntityUpdateSchema,
                permission: `${config.permission}.update`,
            }
        )
        // Bulk deactivate (soft delete)
        .delete(
            '/bulk',
            async ({ body, headers, currentUserId, request }) => {
                const { ipAddress } = getIpAndUserAgent(request);
                return service.bulkDelete(body.ids, { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] });
            },
            {
                body: t.Object({
                    ids: t.Array(t.Number(), { minItems: 1 })
                }),
                permission: `${config.permission}.delete`,
            }
        )
        // Bulk restore
        .patch(
            '/bulk/restore',
            async ({ body, headers, currentUserId, request }) => {
                const { ipAddress } = getIpAndUserAgent(request);
                return service.bulkRestore(body.ids, { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] });
            },
            {
                body: t.Object({
                    ids: t.Array(t.Number(), { minItems: 1 })
                }),
                permission: `${config.permission}.restore`,
            }
        )
        // Pre-flight: check references
        .get(
            '/:id/can-delete',
            ({ params }) => service.checkReferences(Number(params.id)),
            {
                params: t.Object({ id: t.Numeric() }),
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
                params: t.Object({ id: t.Numeric() }),
                permission: `${config.permission}.delete`,
            }
        )
        // Restore
        .patch(
            '/:id/restore',
            async ({ params, headers, currentUserId, currentCompanyId, request }) => {
                const { ipAddress } = getIpAndUserAgent(request);
                return service.restore(Number(params.id), { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }, currentCompanyId);
            },
            {
                params: t.Object({ id: t.Numeric() }),
                permission: `${config.permission}.restore`,
            }
        )
        // Hard delete
        .delete(
            '/:id',
            async ({ params, set, headers, currentUserId, currentCompanyId, request }) => {
                const { ipAddress } = getIpAndUserAgent(request);
                await service.hardDelete(Number(params.id), { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }, currentCompanyId);
                set.status = 204;
            },
            {
                params: t.Object({ id: t.Numeric() }),
                permission: `${config.permission}.destroy`,
            }
        )
        // Addresses
        .get(
            '/:id/addresses',
            ({ params }) => getAddresses(Number(params.id)),
            {
                params: t.Object({ id: t.Numeric() }),
                permission: `${config.permission}.read`,
            }
        )
        .post(
            '/:id/addresses',
            async ({ params, body, set }) => {
                const address = await addAddress(Number(params.id), body as any);
                set.status = 201;
                return address;
            },
            {
                params: t.Object({ id: t.Numeric() }),
                body: AddressPayloadSchema,
                permission: `${config.permission}.update`,
            }
        )
        // Contacts
        .get(
            '/:id/contacts',
            ({ params }) => getContacts(Number(params.id)),
            {
                params: t.Object({ id: t.Numeric() }),
                permission: `${config.permission}.read`,
            }
        )
        .post(
            '/:id/contacts',
            async ({ params, body, set }) => {
                const contact = await addContact(Number(params.id), body as any);
                set.status = 201;
                return contact;
            },
            {
                params: t.Object({ id: t.Numeric() }),
                body: ContactPayloadSchema,
                permission: `${config.permission}.update`,
            }
        )
        .put(
            '/contacts/:contactId',
            ({ params, body }) => updateContact(Number(params.contactId), body as any),
            {
                params: t.Object({ contactId: t.Numeric() }),
                body: t.Partial(ContactPayloadSchema),
                permission: `${config.permission}.update`,
            }
        )
        .delete(
            '/contacts/:contactId',
            async ({ params, set }) => {
                await deleteContact(Number(params.contactId));
                set.status = 204;
            },
            {
                params: t.Object({ contactId: t.Numeric() }),
                permission: `${config.permission}.update`,
            }
        );
}
