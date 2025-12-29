import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import {
    listEntities,
    getEntity,
    createEntity,
    updateEntity,
    deactivateEntity,
    addAddress,
    getAddresses,
    addContact,
    updateContact,
    deleteContact,
    getContacts,
} from '../services/entities.service';

const taxIdTypeSchema = t.Union([
    t.Literal('RUC'),
    t.Literal('CEDULA'),
    t.Literal('PASAPORTE'),
]);

const personTypeSchema = t.Union([
    t.Literal('NATURAL'),
    t.Literal('JURIDICA'),
]);

const sriContributorTypeSchema = t.Union([
    t.Literal('RIMPE_POPULAR'),
    t.Literal('RIMPE_EMPRENDEDOR'),
    t.Literal('GENERAL'),
    t.Literal('ESP_AGENT'),
]);

export const employeeRoutes = new Elysia({ prefix: '/employees' })
    .use(authGuard)
    .get(
        '/',
        ({ query }) =>
            listEntities('employee', {
                search: query.search,
                limit: query.limit ? Number(query.limit) : undefined,
                offset: query.offset ? Number(query.offset) : undefined,
                isCarrier: query.isCarrier === 'true' ? true : query.isCarrier === 'false' ? false : undefined,
            }),
        {
            query: t.Object({
                search: t.Optional(t.String()),
                limit: t.Optional(t.Numeric()),
                offset: t.Optional(t.Numeric()),
                isCarrier: t.Optional(t.String()),
            }),
        }
    )
    .get(
        '/:id',
        ({ params }) => getEntity(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .post(
        '/',
        async ({ body, set }) => {
            const employee = await createEntity('employee', body);
            set.status = 201;
            return employee;
        },
        {
            body: t.Object({
                taxId: t.String(),
                taxIdType: taxIdTypeSchema,
                personType: t.Optional(personTypeSchema),
                businessName: t.String(),
                tradeName: t.Optional(t.String()),
                emailBilling: t.String({ format: 'email' }),
                phone: t.Optional(t.String()),
                addressFiscal: t.String(),
                sriContributorType: t.Optional(sriContributorTypeSchema),
                // Employee specific
                department: t.Optional(t.String()),
                jobTitle: t.Optional(t.String()),
                salaryBase: t.Optional(t.Number()),
                hireDate: t.Optional(t.String()),
                costPerHour: t.Optional(t.Number()),
                isCarrier: t.Optional(t.Boolean()),
            }),
        }
    )
    .put(
        '/:id',
        ({ params, body }) => updateEntity(Number(params.id), 'employee', body),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Partial(
                t.Object({
                    businessName: t.String(),
                    tradeName: t.String(),
                    emailBilling: t.String({ format: 'email' }),
                    phone: t.String(),
                    addressFiscal: t.String(),
                    sriContributorType: sriContributorTypeSchema,
                    department: t.String(),
                    jobTitle: t.String(),
                    salaryBase: t.Number(),
                    costPerHour: t.Number(),
                    isCarrier: t.Boolean(),
                })
            ),
        }
    )
    .delete(
        '/:id',
        async ({ params, set }) => {
            await deactivateEntity(Number(params.id), 'employee');
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
