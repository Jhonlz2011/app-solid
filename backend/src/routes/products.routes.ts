import { Elysia, t } from 'elysia';
import { ProductInsert } from '@app/schema/backend';
import { authGuard } from '../plugins/auth-guard';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  type ProductPayload,
} from '../services/products.service';

// Schema for extra fields not in the DB table
const ExtraFields = t.Object({
  components: t.Optional(
    t.Array(
      t.Object({
        componentId: t.Number(),
        quantity: t.Number(),
        wastagePercent: t.Optional(t.Number()),
      })
    )
  ),
  dimensions: t.Optional(
    t.Object({
      width: t.Optional(t.Number()),
      length: t.Optional(t.Number()),
      thickness: t.Optional(t.Number()),
    })
  ),
});

export const productRoutes = new Elysia({ prefix: '/products' })
  .use(authGuard)
  .get(
    '/',
    ({ query }) =>
      listProducts({
        search: query.search,
        categoryId: query.categoryId ? Number(query.categoryId) : undefined,
        brandId: query.brandId ? Number(query.brandId) : undefined,
        productType: query.productType,
        productSubtype: query.productSubtype,
        isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        offset: query.offset ? Number(query.offset) : undefined,
      }),
    {
      query: t.Object({
        search: t.Optional(t.String()),
        categoryId: t.Optional(t.Numeric()),
        brandId: t.Optional(t.Numeric()),
        productType: t.Optional(t.String()),
        productSubtype: t.Optional(t.String()),
        isActive: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
        offset: t.Optional(t.Numeric()),
      }),
    }
  )
  .get(
    '/:id',
    ({ params }) => getProduct(Number(params.id)),
    {
      params: t.Object({ id: t.Numeric() }),
    }
  )
  .post(
    '/',
    async ({ body, currentUserId, set }) => {
      // Body is already validated and typed by Elysia + TypeBox
      // It matches ProductPayload because ProductInsert is derived from the same schema
      const product = await createProduct(body as ProductPayload, currentUserId);
      set.status = 201;
      return product;
    },
    {
      body: t.Composite([ProductInsert, ExtraFields]),
    }
  )
  .put(
    '/:id',
    ({ params, body, currentUserId }) =>
      updateProduct(Number(params.id), body as Partial<ProductPayload>, currentUserId),
    {
      params: t.Object({ id: t.Numeric() }),
      body: t.Partial(t.Composite([ProductInsert, ExtraFields])),
    }
  )
  .delete(
    '/:id',
    async ({ params, currentUserId, set }) => {
      await deleteProduct(Number(params.id), currentUserId);
      set.status = 204;
    },
    {
      params: t.Object({ id: t.Numeric() }),
    }
  );
