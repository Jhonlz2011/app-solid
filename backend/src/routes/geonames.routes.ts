import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { geonamesService } from '../services/geonames.service';

const GeoNameCitySchema = t.Object({
    ciudad: t.String(),
    pais: t.String(),
    codigo: t.String(),
    bandera: t.String(),
});

export const geonamesRoutes = new Elysia({ prefix: '/geonames' })
    .use(authGuard)
    .get(
        '/cities',
        async ({ query }) => geonamesService.searchCities(query.q),
        {
            query: t.Object({
                q: t.String({
                    minLength: 2,
                    error: 'La búsqueda debe tener al menos 2 caracteres',
                }),
            }),
            response: { 200: t.Array(GeoNameCitySchema) },
        }
    );
