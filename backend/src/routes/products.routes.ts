import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../services/products.service';

export const productRoutes = new Elysia({ prefix: '/products' })
  .use(authGuard)
  .get(
    '/',
    ({ query }) =>
      listProducts({
        search: query.search,
        categoryId: query.categoryId ? Number(query.categoryId) : undefined,
        brandId: query.brandId ? Number(query.brandId) : undefined,
        productClass: query.productClass as any,
        isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        offset: query.offset ? Number(query.offset) : undefined,
      }),
    {
      query: t.Object({
        search: t.Optional(t.String()),
        categoryId: t.Optional(t.Numeric()),
        brandId: t.Optional(t.Numeric()),
        productClass: t.Optional(t.String()),
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
      const product = await createProduct(body, currentUserId);
      set.status = 201;
      return product;
    },
    {
      body: t.Object({
        sku: t.String(),
        name: t.String(),
        productClass: t.Union([
          t.Literal('MATERIAL'),
          t.Literal('TOOL'),
          t.Literal('EPP'),
          t.Literal('ASSET'),
        ]),
        categoryId: t.Optional(t.Number()),
        brandId: t.Optional(t.Number()),
        description: t.Optional(t.String()),
        specs: t.Optional(t.Any()),
        imageUrls: t.Optional(t.Array(t.String())),
        uomInventoryCode: t.Optional(t.String()),
        uomConsumptionCode: t.Optional(t.String()),
        trackDimensional: t.Optional(t.Boolean()),
        isService: t.Optional(t.Boolean()),
        minStockAlert: t.Optional(t.Number()),
        lastCost: t.Optional(t.Number()),
        basePrice: t.Optional(t.Number()),
        ivaRateCode: t.Optional(t.Number()),
        components: t.Optional(
          t.Array(
            t.Object({
              componentId: t.Number(),
              quantity: t.Number(),
              wastagePercent: t.Optional(t.Number()),
            })
          )
        ),
      }),
    }
  )
  .put(
    '/:id',
    ({ params, body, currentUserId }) =>
      updateProduct(Number(params.id), body, currentUserId),
    {
      params: t.Object({ id: t.Numeric() }),
      body: t.Partial(
        t.Object({
          name: t.String(),
          productClass: t.Union([
            t.Literal('MATERIAL'),
            t.Literal('TOOL'),
            t.Literal('EPP'),
            t.Literal('ASSET'),
          ]),
          categoryId: t.Number(),
          brandId: t.Number(),
          description: t.String(),
          specs: t.Any(),
          uomInventoryCode: t.String(),
          uomConsumptionCode: t.String(),
          trackDimensional: t.Boolean(),
          isService: t.Boolean(),
          minStockAlert: t.Number(),
          lastCost: t.Number(),
          basePrice: t.Number(),
          ivaRateCode: t.Number(),
        })
      ),
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
