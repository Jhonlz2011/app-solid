import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { getIpAndUserAgent } from '../plugins/ip';
import { clientsService } from '../services/clients.service';
import {
    addAddress,
    getAddresses,
    addContact,
    updateContact,
    deleteContact,
    getContacts,
} from '../services/entities.service';
import { ClientBodySchema, ClientUpdateSchema } from '@app/schema/backend';

/** Parse comma-separated string into array (shared by list + facets) */
const parseArray = (val?: string) => val?.split(',').filter(Boolean);

export const clientRoutes = new Elysia({ prefix: '/clients' })
    .use(authGuard)
    // List with cursor pagination
    .get(
        '/',
        ({ query }) => {
            return clientsService.list({
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
            });
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
        }
    )
    // Get faceted filter values + counts (with cross-filtering)
    .get(
        '/facets',
        ({ query }) => {
            return clientsService.facets({
                search: query.search,
                personType: parseArray(query.personType),
                taxIdType: parseArray(query.taxIdType),
                isActive: parseArray(query.isActive),
                businessName: parseArray(query.businessName),
            });
        },
        {
            query: t.Object({
                search: t.Optional(t.String()),
                personType: t.Optional(t.String()),
                taxIdType: t.Optional(t.String()),
                isActive: t.Optional(t.String()),
                businessName: t.Optional(t.String()),
            }),
        }
    )
    .get(
        '/:id',
        ({ params }) => clientsService.get(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .post(
        '/',
        async ({ body, set, headers, currentUserId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            const client = await clientsService.create(body, { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] });
            set.status = 201;
            return client;
        },
        { body: ClientBodySchema }
    )
    .put(
        '/:id',
        ({ params, body, headers, currentUserId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return clientsService.update(Number(params.id), body, { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] });
        },
        {
            params: t.Object({ id: t.Numeric() }),
            body: ClientUpdateSchema,
        }
    )
    // Bulk deactivate (soft delete) — before /:id to avoid route conflict
    .delete(
        '/bulk',
        async ({ body, headers, currentUserId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return clientsService.bulkDelete(body.ids, { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] });
        },
        {
            body: t.Object({
                ids: t.Array(t.Number(), { minItems: 1 })
            })
        }
    )
    // Bulk restore
    .patch(
        '/bulk/restore',
        async ({ body, headers, currentUserId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return clientsService.bulkRestore(body.ids, { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] });
        },
        {
            body: t.Object({
                ids: t.Array(t.Number(), { minItems: 1 })
            })
        }
    )
    // Pre-flight: check if entity has transactional references before hard delete
    .get(
        '/:id/can-delete',
        ({ params }) => clientsService.checkReferences(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )
    // Soft delete (deactivate) — safe default, reversible
    .patch(
        '/:id/deactivate',
        async ({ params, set, headers, currentUserId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            await clientsService.softDelete(
                Number(params.id),
                undefined, // deletedBy: wire to session user id when RBAC is available
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }
            );
            set.status = 204;
        },
        { params: t.Object({ id: t.Numeric() }) }
    )
    // Restore a soft-deleted client
    .patch(
        '/:id/restore',
        async ({ params, headers, currentUserId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return clientsService.restore(Number(params.id), { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] });
        },
        { params: t.Object({ id: t.Numeric() }) }
    )
    // Hard delete — permanent, guarded by clients:destroy permission
    .delete(
        '/:id',
        async ({ params, set, headers, currentUserId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            await clientsService.hardDelete(Number(params.id), { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] });
            set.status = 204;
        },
        { params: t.Object({ id: t.Numeric() }) }
    )
    // Addresses
    .get(
        '/:id/addresses',
        ({ params }) => getAddresses(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .post(
        '/:id/addresses',
        async ({ params, body, set }) => {
            const address = await addAddress(Number(params.id), body);
            set.status = 201;
            return address;
        },
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Object({
                addressLine: t.String(),
                city: t.Optional(t.String()),
                country: t.Optional(t.String()),
                countryCode: t.Optional(t.String()),
                state: t.Optional(t.String()),
                parish: t.Optional(t.String()),
                postalCode: t.Optional(t.String()),
                isMain: t.Optional(t.Boolean()),
            }),
        }
    )
    // Contacts
    .get(
        '/:id/contacts',
        ({ params }) => getContacts(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .post(
        '/:id/contacts',
        async ({ params, body, set }) => {
            const contact = await addContact(Number(params.id), body);
            set.status = 201;
            return contact;
        },
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Object({
                name: t.String(),
                position: t.Optional(t.String()),
                email: t.Optional(t.String({ format: 'email' })),
                phone: t.Optional(t.String()),
                isPrimary: t.Optional(t.Boolean()),
            }),
        }
    )
    .put(
        '/contacts/:contactId',
        ({ params, body }) => updateContact(Number(params.contactId), body),
        {
            params: t.Object({ contactId: t.Numeric() }),
            body: t.Partial(
                t.Object({
                    name: t.String(),
                    position: t.String(),
                    email: t.String({ format: 'email' }),
                    phone: t.String(),
                    isPrimary: t.Boolean(),
                })
            ),
        }
    )
    .delete(
        '/contacts/:contactId',
        async ({ params, set }) => {
            await deleteContact(Number(params.contactId));
            set.status = 204;
        },
        { params: t.Object({ contactId: t.Numeric() }) }
    );
