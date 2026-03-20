import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import { listForPicker } from '../services/entities.service';

/**
 * Entities routes — lightweight endpoints for entity picker/autocomplete.
 * Mounted at /api/entities via server.ts.
 */
export const entityRoutes = new Elysia({ prefix: '/entities' })
    .use(authGuard)
    // List entities for picker (minimal fields)
    .get(
        '/',
        ({ query }) => {
            return listForPicker(
                query.search,
                query.limit ? Number(query.limit) : 200,
            );
        },
        {
            query: t.Object({
                search: t.Optional(t.String()),
                limit: t.Optional(t.Numeric()),
            }),
        }
    );
