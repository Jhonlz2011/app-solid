import { Elysia, t } from 'elysia';
import { authGuard } from '../../plugins/auth-guard';
import { geonamesService } from './geonames.service';
import { GeoNameCitySchema, GeoNameSearchQuerySchema } from '@app/schema/backend';

export const geonamesRoutes = new Elysia({ prefix: '/geonames' })
    .use(authGuard)
    .get(
        '/cities',
        async ({ query }) => geonamesService.searchCities(query.q),
        {
            query: GeoNameSearchQuerySchema,
            response: { 200: t.Array(GeoNameCitySchema) },
        }
    );
