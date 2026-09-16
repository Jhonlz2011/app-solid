import { Elysia, t } from 'elysia';
import { authGuard } from '../../plugins/auth-guard';
import { taxonomyService } from './taxonomy.service';
import {
    TaxonomyCategoryResponseSchema,
    TaxonomyCategorySearchQuerySchema,
    TaxonomyAttributeResponseSchema,
} from '@app/schema/backend';

export const taxonomyRoutes = new Elysia({ prefix: '/references/taxonomy' })
    .use(authGuard)
    .get(
        '/categories',
        async ({ query }) => taxonomyService.searchCategories(query.q, query.limit),
        {
            query: TaxonomyCategorySearchQuerySchema,
            response: { 200: t.Array(TaxonomyCategoryResponseSchema) },
        }
    )
    .get(
        '/categories/:id/attributes',
        async ({ params }) => taxonomyService.getCategoryAttributes(Number(params.id)),
        {
            params: t.Object({ id: t.Numeric() }),
            response: { 200: t.Array(TaxonomyAttributeResponseSchema) },
        }
    );
