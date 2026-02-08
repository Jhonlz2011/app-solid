import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { suppliersService } from '../services/suppliers.service';
import {
    addAddress,
    getAddresses,
    addContact,
    updateContact,
    deleteContact,
    getContacts,
} from '../services/entities.service';
import { SupplierBodySchema, SupplierUpdateSchema } from '@app/schema/backend';

export const supplierRoutes = new Elysia({ prefix: '/suppliers' })
    .use(authGuard)
    .get(
        '/',
        ({ query }) =>
            suppliersService.list({
                search: query.search,
                limit: query.limit ? Number(query.limit) : undefined,
                offset: query.offset ? Number(query.offset) : undefined,
            }),
        {
            query: t.Object({
                search: t.Optional(t.String()),
                limit: t.Optional(t.Numeric()),
                offset: t.Optional(t.Numeric()),
            }),
        }
    )
    .get(
        '/:id',
        ({ params }) => suppliersService.get(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )
    .post(
        '/',
        async ({ body, set }) => {
            const supplier = await suppliersService.create(body);
            set.status = 201;
            return supplier;
        },
        { body: SupplierBodySchema }
    )
    .put(
        '/:id',
        ({ params, body }) => suppliersService.update(Number(params.id), body),
        {
            params: t.Object({ id: t.Numeric() }),
            body: SupplierUpdateSchema,
        }
    )
    .delete(
        '/:id',
        async ({ params, set }) => {
            await suppliersService.delete(Number(params.id));
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
