import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { rbac } from '../plugins/rbac';
import { getIpAndUserAgent } from '../plugins/ip';
import { employeesService } from '../services/employees.service';
import {
    addAddress,
    getAddresses,
    addContact,
    updateContact,
    deleteContact,
    getContacts,
} from '../services/entities.service';
import { EntityFormSchema, SupplierUpdateSchema } from '@app/schema/backend';

/** Parse comma-separated string into array (shared by list + facets) */
const parseArray = (val?: string) => val?.split(',').filter(Boolean);

export const employeeRoutes = new Elysia({ prefix: '/employees' })
    .use(authGuard)
    .use(rbac)
    // List with cursor pagination
    .get(
        '/',
        ({ query, currentCompanyId }) => {
            return employeesService.list({
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
            permission: 'employees.read',
        }
    )
    // Get faceted filter values + counts (with cross-filtering)
    .get(
        '/facets',
        ({ query, currentCompanyId }) => {
            return employeesService.facets({
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
            permission: 'employees.read',
        }
    )
    .get(
        '/:id',
        ({ params, currentCompanyId }) => employeesService.get(Number(params.id), currentCompanyId),
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'employees.read',
        }
    )
    .post(
        '/',
        async ({ body, set, headers, currentUserId, currentCompanyId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            const employee = await employeesService.create(body, { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }, currentCompanyId);
            set.status = 201;
            return employee;
        },
        {
            body: EntityFormSchema,
            permission: 'employees.create',
        }
    )
    .put(
        '/:id',
        ({ params, body, headers, currentUserId, currentCompanyId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return employeesService.update(Number(params.id), body, { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }, currentCompanyId);
        },
        {
            params: t.Object({ id: t.Numeric() }),
            body: SupplierUpdateSchema, // Valid for now, same as supplier
            permission: 'employees.update',
        }
    )
    // Bulk deactivate (soft delete)
    .delete(
        '/bulk',
        async ({ body, headers, currentUserId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return employeesService.bulkDelete(body.ids, { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] });
        },
        {
            body: t.Object({
                ids: t.Array(t.Number(), { minItems: 1 })
            }),
            permission: 'employees.delete',
        }
    )
    // Bulk restore
    .patch(
        '/bulk/restore',
        async ({ body, headers, currentUserId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return employeesService.bulkRestore(body.ids, { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] });
        },
        {
            body: t.Object({
                ids: t.Array(t.Number(), { minItems: 1 })
            }),
            permission: 'employees.restore',
        }
    )
    // Pre-flight: check references
    .get(
        '/:id/can-delete',
        ({ params }) => employeesService.checkReferences(Number(params.id)),
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'employees.read',
        }
    )
    // Soft delete
    .patch(
        '/:id/deactivate',
        async ({ params, set, headers, currentUserId, currentCompanyId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            await employeesService.softDelete(
                Number(params.id),
                undefined,
                { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] },
                currentCompanyId
            );
            set.status = 204;
        },
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'employees.delete',
        }
    )
    // Restore
    .patch(
        '/:id/restore',
        async ({ params, headers, currentUserId, currentCompanyId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            return employeesService.restore(Number(params.id), { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }, currentCompanyId);
        },
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'employees.restore',
        }
    )
    // Hard delete
    .delete(
        '/:id',
        async ({ params, set, headers, currentUserId, currentCompanyId, request }) => {
            const { ipAddress } = getIpAndUserAgent(request);
            await employeesService.hardDelete(Number(params.id), { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] }, currentCompanyId);
            set.status = 204;
        },
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'employees.destroy',
        }
    )
    // Addresses
    .get(
        '/:id/addresses',
        ({ params }) => getAddresses(Number(params.id)),
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'employees.read',
        }
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
            permission: 'employees.update',
        }
    )
    // Contacts
    .get(
        '/:id/contacts',
        ({ params }) => getContacts(Number(params.id)),
        {
            params: t.Object({ id: t.Numeric() }),
            permission: 'employees.read',
        }
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
            permission: 'employees.update',
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
            permission: 'employees.update',
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
            permission: 'employees.update',
        }
    );
