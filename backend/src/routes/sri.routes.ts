import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { SriService } from '../services/sri.service';
import { SriSupplierResponseSchema } from '@app/schema/backend';

export const sriRoutes = new Elysia({ prefix: '/sri' })
    .use(authGuard)
    .get(
        '/by-ruc',
        async ({ query, set }) => {
            try {
                const resultados = await SriService.buscarPorRuc(query.q);
                return resultados;
            } catch (err) {
                console.error('🚨 Error consultando el SRI por RUC:', err);
                set.status = 500;
                return { success: false, message: 'Error interno en la búsqueda SRI' };
            }
        },
        {
            query: t.Object({
                q: t.String({ 
                    minLength: 13, 
                    maxLength: 13, 
                    error: 'El RUC debe tener exactamente 13 dígitos' 
                })
            }),
            response: {
                200: t.Array(SriSupplierResponseSchema),
                500: t.Object({
                    success: t.Boolean(),
                    message: t.String()
                })
            }
        }
    )
    .get(
        '/by-name',
        async ({ query, set }) => {
            try {
                const resultados = await SriService.buscarPorNombre(query.q);
                return resultados;
            } catch (err) {
                console.error('🚨 Error consultando el SRI por Nombre:', err);
                set.status = 500;
                return { success: false, message: 'Error interno en la búsqueda SRI' };
            }
        },
        {
            query: t.Object({
                q: t.String({ 
                    minLength: 3, 
                    error: 'La búsqueda debe tener al menos 3 caracteres' 
                })
            }),
            response: {
                200: t.Array(SriSupplierResponseSchema),
                500: t.Object({
                    success: t.Boolean(),
                    message: t.String()
                })
            }
        }
    );