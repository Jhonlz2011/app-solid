import { Elysia, t } from 'elysia';
import { tenantGuard } from '../../plugins/tenant-guard';
import { listForPicker } from './entities.query.service';
import {
    EntityBodySchema,
    EntityUpdateBodySchema,
    ContactBodySchema,
    AddressBodySchema,
    EntityPickerQuerySchema,
    EntityListQuerySchema,
    EntityFacetsQuerySchema,
    EntityReferencesResponseSchema,
    DepartmentBodySchema,
    JobTitleBodySchema,
    DepartmentResponseSchema,
    JobTitleResponseSchema,
    BulkStringIdsBodySchema,
    IdStringParamSchema,
    EntityDetailResponseSchema,
    EntityLookupResponseSchema,
    EntityListResponseSchema,
} from '@app/schema/backend';
import type { EntityBodyType, EntityAddressType, EntityContactType, DepartmentType, JobTitleType, EntityType } from '@app/schema/dto';
import { getIpAndUserAgent } from '../../plugins/ip';
import { rbac } from '../../plugins/rbac';
import { createEntityService } from './entities.service';
import { addAddress, addContact, updateContact, deleteContact, createDepartment, createJobTitle } from './entities.command.service';
import { getAddresses, getContacts, listDepartments, listJobTitles, lookupEntityByTaxId } from './entities.query.service';

/**
 * Entities routes — lightweight endpoints for entity picker/autocomplete, departments, job-titles, and taxId lookup.
 * Mounted at /api/entities via server.ts.
 */
export const entityRoutes = new Elysia({ prefix: '/entities' })
    .use(tenantGuard)
    .get(
        '/',
        ({ query, currentCompanyId }) => {
            return listForPicker(
                currentCompanyId,
                {
                    search: query.search,
                    limit: query.limit ? Number(query.limit) : 200,
                    type: query.type,
                    isClient: query.isClient,
                    isSupplier: query.isSupplier,
                    isEmployee: query.isEmployee,
                    isCarrier: query.isCarrier,
                    isActive: query.isActive,
                }
            );
        },
        {
            query: EntityPickerQuerySchema,
        }
    )
    .get('/lookup/:taxId', async ({ params, currentCompanyId }) => {
        return lookupEntityByTaxId(params.taxId, currentCompanyId);
    }, {
        params: t.Object({ taxId: t.String() }),
        response: EntityLookupResponseSchema,
    })
    .get('/departments', ({ currentCompanyId }) => {
        return listDepartments(currentCompanyId);
    }, {
        response: t.Array(DepartmentResponseSchema),
    })
    .post('/departments', async ({ body, set, currentCompanyId }) => {
        const dept = await createDepartment(body as DepartmentType, currentCompanyId);
        set.status = 201;
        return dept;
    }, {
        body: DepartmentBodySchema,
        response: DepartmentResponseSchema,
    })
    .get('/job-titles', ({ currentCompanyId, query }) => {
        const deptId = query.departmentId ? Number(query.departmentId) : undefined;
        return listJobTitles(currentCompanyId, deptId);
    }, {
        query: t.Object({ departmentId: t.Optional(t.Numeric()) }),
        response: t.Array(JobTitleResponseSchema),
    })
    .post('/job-titles', async ({ body, set, currentCompanyId }) => {
        const job = await createJobTitle(body as JobTitleType, currentCompanyId);
        set.status = 201;
        return job;
    }, {
        body: JobTitleBodySchema,
        response: JobTitleResponseSchema,
    });

/**
 * Generic route factory that builds standard CRUD endpoints for any Entity type.
 * Mounted at: /api/clients, /api/suppliers, /api/employees.
 */
interface EntityRouteConfig {
    prefix: string;
    type: EntityType;
    permission: string;
}

const parseArray = (val?: string) => val?.split(',').filter(Boolean);

export function createEntityRoutes(config: EntityRouteConfig) {
    const service = createEntityService(config.type);

    return new Elysia({ prefix: config.prefix })
        .use(tenantGuard)
        .use(rbac)
        // List with cursor pagination
        .get(
            '/',
            ({ query, currentCompanyId }) => {
                return service.list({
                    cursor: query.cursor,
                    direction: query.direction as any,
                    limit: query.limit !== undefined ? Number(query.limit) : undefined,
                    search: query.search,
                    sortBy: query.sortBy,
                    sortOrder: query.sortOrder as 'asc' | 'desc' | undefined,
                    page: query.page !== undefined ? Number(query.page) : undefined,
                    personType: parseArray(query.personType) as any,
                    taxIdType: parseArray(query.taxIdType) as any,
                    isActive: parseArray(query.isActive),
                    businessName: parseArray(query.businessName),
                }, currentCompanyId);
            },
            {
                query: EntityListQuerySchema,
                response: EntityListResponseSchema,
                permission: `${config.permission}.read`,
            }
        )
        // Get faceted filter values + counts (with cross-filtering)
        .get(
            '/facets',
            ({ query, currentCompanyId }) => {
                return service.facets({
                    search: query.search,
                    personType: parseArray(query.personType) as any,
                    taxIdType: parseArray(query.taxIdType) as any,
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
            ({ params, currentCompanyId }) => service.get(params.id, currentCompanyId),
            {
                params: IdStringParamSchema,
                response: EntityDetailResponseSchema,
                permission: `${config.permission}.read`,
            }
        )
        .post(
            '/',
            async ({ body, set, headers, currentUserId, currentCompanyId, request }) => {
                const { ipAddress } = getIpAndUserAgent(request);
                const entity = await service.create(
                    body as EntityBodyType,
                    { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] },
                    currentCompanyId
                );
                set.status = 201;
                return entity;
            },
            {
                body: EntityBodySchema,
                response: EntityDetailResponseSchema,
                permission: `${config.permission}.create`,
            }
        )
        .put(
            '/:id',
            ({ params, body, headers, currentUserId, currentCompanyId, request }) => {
                const { ipAddress } = getIpAndUserAgent(request);
                return service.update(
                    params.id,
                    body as Partial<EntityBodyType>,
                    { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] },
                    currentCompanyId
                );
            },
            {
                params: IdStringParamSchema,
                body: EntityUpdateBodySchema,
                response: EntityDetailResponseSchema,
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
                body: BulkStringIdsBodySchema,
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
                body: BulkStringIdsBodySchema,
                permission: `${config.permission}.restore`,
            }
        )
        // Pre-flight: check references
        .get(
            '/:id/can-delete',
            ({ params, currentCompanyId }) => service.checkReferences(params.id, currentCompanyId),
            {
                params: IdStringParamSchema,
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
                    params.id,
                    undefined,
                    { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] },
                    currentCompanyId
                );
                set.status = 204;
            },
            {
                params: IdStringParamSchema,
                permission: `${config.permission}.delete`,
            }
        )
        // Restore
        .patch(
            '/:id/restore',
            async ({ params, headers, currentUserId, currentCompanyId, request }) => {
                const { ipAddress } = getIpAndUserAgent(request);
                return service.restore(
                    params.id,
                    { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] },
                    currentCompanyId
                );
            },
            {
                params: IdStringParamSchema,
                permission: `${config.permission}.restore`,
            }
        )
        // Hard delete
        .delete(
            '/:id',
            async ({ params, set, headers, currentUserId, currentCompanyId, request }) => {
                const { ipAddress } = getIpAndUserAgent(request);
                await service.hardDelete(
                    params.id,
                    { userId: currentUserId, ipAddress, clientId: headers['x-client-id'] },
                    currentCompanyId
                );
                set.status = 204;
            },
            {
                params: IdStringParamSchema,
                permission: `${config.permission}.destroy`,
            }
        )
        // Addresses
        .get(
            '/:id/addresses',
            ({ params, currentCompanyId }) => getAddresses(params.id, currentCompanyId),
            {
                params: IdStringParamSchema,
                permission: `${config.permission}.read`,
            }
        )
        .post(
            '/:id/addresses',
            async ({ params, body, currentCompanyId, set }) => {
                const address = await addAddress(params.id, body as EntityAddressType, currentCompanyId);
                set.status = 201;
                return address;
            },
            {
                params: IdStringParamSchema,
                body: AddressBodySchema,
                permission: `${config.permission}.update`,
            }
        )
        // Contacts
        .get(
            '/:id/contacts',
            ({ params, currentCompanyId }) => getContacts(params.id, currentCompanyId),
            {
                params: IdStringParamSchema,
                permission: `${config.permission}.read`,
            }
        )
        .post(
            '/:id/contacts',
            async ({ params, body, currentCompanyId, set }) => {
                const contact = await addContact(params.id, body as EntityContactType, currentCompanyId);
                set.status = 201;
                return contact;
            },
            {
                params: IdStringParamSchema,
                body: ContactBodySchema,
                permission: `${config.permission}.update`,
            }
        )
        .put(
            '/contacts/:contactId',
            ({ params, body, currentCompanyId }) => updateContact(Number(params.contactId), body as Partial<EntityContactType>, currentCompanyId),
            {
                params: t.Object({ contactId: t.Numeric() }),
                body: t.Partial(ContactBodySchema),
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
