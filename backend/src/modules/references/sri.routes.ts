import { Elysia, t } from 'elysia';
import { authGuard } from '../../plugins/auth-guard';
import { SriService } from './sri.service';
import {
    SriSupplierResponseSchema,
    SriRucQuerySchema,
    SriNameQuerySchema,
} from '@app/schema/backend';

export const sriRoutes = new Elysia({ prefix: '/sri' })
    .use(authGuard)
    .get(
        '/by-ruc',
        async ({ query }) => SriService.buscarPorRuc(query.q),
        {
            query: SriRucQuerySchema,
            response: { 200: t.Array(SriSupplierResponseSchema) }
        }
    )
    .get(
        '/by-name',
        async ({ query }) => SriService.buscarPorNombre(query.q),
        {
            query: SriNameQuerySchema,
            response: { 200: t.Array(SriSupplierResponseSchema) }
        }
    );