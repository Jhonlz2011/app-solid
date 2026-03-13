import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { SriService } from '../services/sri.service';
import { SriSupplierResponseSchema } from '@app/schema/backend';

export const sriRoutes = new Elysia({ prefix: '/sri' })
    .use(authGuard)
    .get(
        '/by-ruc',
        async ({ query }) => SriService.buscarPorRuc(query.q),
        {
            query: t.Object({
                q: t.String({ 
                    minLength: 13, 
                    maxLength: 13, 
                    error: 'El RUC debe tener exactamente 13 dígitos' 
                })
            }),
            response: { 200: t.Array(SriSupplierResponseSchema) }
        }
    )
    .get(
        '/by-name',
        async ({ query }) => SriService.buscarPorNombre(query.q),
        {
            query: t.Object({
                q: t.String({ 
                    minLength: 3, 
                    error: 'La búsqueda debe tener al menos 3 caracteres' 
                })
            }),
            response: { 200: t.Array(SriSupplierResponseSchema) }
        }
    );