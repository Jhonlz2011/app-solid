import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth-guard';
import {
    listProducts,
    getProduct,
    createProduct,
    updateProduct,
    deactivateProduct,
    restoreProduct,
    hardDeleteProduct,
    bulkDeactivateProducts,
    bulkRestoreProducts,
    checkProductReferences,
    getProductFacets,
    generateSku,
    type ProductPayload,
} from '../services/products.service';

// TypeBox schema for unified variant sub-form (attributes + packaging in one entity)
const variantSchema = t.Object({
    id: t.Optional(t.Nullable(t.Number())),
    sku: t.String({ minLength: 1 }),
    variant_name: t.Optional(t.Nullable(t.String())),
    variant_attributes: t.Optional(t.Any()),
    content_quantity: t.Number(),
    sale_uom_id: t.Optional(t.Nullable(t.Number())),
    base_price: t.Optional(t.Nullable(t.Number())),
    last_cost: t.Optional(t.Nullable(t.Number())),
    barcode: t.Optional(t.Nullable(t.String())),
    image_urls: t.Optional(t.Nullable(t.Array(t.String()))),
    std_length_cm: t.Optional(t.Nullable(t.Number())),
    std_width_cm: t.Optional(t.Nullable(t.Number())),
    is_default: t.Boolean(),
    is_active: t.Boolean(),
    sort_order: t.Optional(t.Number()),
});

const ProductBodySchema = t.Object({
    product_type: t.Union([t.Literal('PRODUCTO'), t.Literal('SERVICIO')]),
    product_subtype: t.Optional(t.Nullable(t.Union([
        t.Literal('SIMPLE'), t.Literal('COMPUESTO'), t.Literal('FABRICADO'),
    ]))),
    category_id: t.Number(),
    brand_id: t.Optional(t.Nullable(t.Number())),
    slug: t.String({ minLength: 1 }),
    name: t.String({ minLength: 1 }),
    description: t.Optional(t.Nullable(t.String())),
    shared_attributes: t.Optional(t.Any()),
    extra_specs: t.Optional(t.Any()),
    image_urls: t.Optional(t.Array(t.String())),
    uom_inventory_id: t.Number(),
    has_dimensional_tracking: t.Boolean(),
    min_stock_alert: t.Optional(t.Nullable(t.Number())),
    default_base_price: t.Number(),
    iva_rate_code: t.Number(),
    is_active: t.Boolean(),
    variants: t.Array(variantSchema),
});

export const productRoutes = new Elysia({ prefix: '/products' })
    .use(authGuard)

    // ─── LIST (cursor + offset pagination) ───────────────────────
    .get('/', ({ query, currentCompanyId }) =>
        listProducts({
            cursor: query.cursor,
            direction: query.direction as any,
            limit: query.limit ? Number(query.limit) : undefined,
            search: query.search,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder as any,
            page: query.page ? Number(query.page) : undefined,
            categoryId: query.categoryId ? query.categoryId.split(',') : undefined,
            brandId: query.brandId ? query.brandId.split(',') : undefined,
            productType: query.productType ? query.productType.split(',') : undefined,
            isActive: query.isActive ? query.isActive.split(',') : undefined,
        }, currentCompanyId),
        {
            query: t.Object({
                cursor: t.Optional(t.String()),
                direction: t.Optional(t.String()),
                limit: t.Optional(t.Numeric()),
                search: t.Optional(t.String()),
                sortBy: t.Optional(t.String()),
                sortOrder: t.Optional(t.String()),
                page: t.Optional(t.Numeric()),
                categoryId: t.Optional(t.String()),
                brandId: t.Optional(t.String()),
                productType: t.Optional(t.String()),
                isActive: t.Optional(t.String()),
            }),
        }
    )

    // ─── FACETS ──────────────────────────────────────────────────
    .get('/facets', ({ query, currentCompanyId }) =>
        getProductFacets(
            ['category_id', 'brand_id', 'product_type', 'is_active'],
            {
                search: query.search,
                categoryId: query.categoryId ? query.categoryId.split(',') : undefined,
                brandId: query.brandId ? query.brandId.split(',') : undefined,
                productType: query.productType ? query.productType.split(',') : undefined,
                isActive: query.isActive ? query.isActive.split(',') : undefined,
            },
            currentCompanyId
        ),
        {
            query: t.Object({
                search: t.Optional(t.String()),
                categoryId: t.Optional(t.String()),
                brandId: t.Optional(t.String()),
                productType: t.Optional(t.String()),
                isActive: t.Optional(t.String()),
            }),
        }
    )

    // ─── GENERATE SKU ────────────────────────────────────────────
    .get('/generate-sku', ({ query }) =>
        generateSku(
            query.categoryId ? Number(query.categoryId) : undefined,
            query.brandId ? Number(query.brandId) : undefined,
        ),
        {
            query: t.Object({
                categoryId: t.Optional(t.Numeric()),
                brandId: t.Optional(t.Numeric()),
            }),
        }
    )

    // ─── GET BY ID ───────────────────────────────────────────────
    .get('/:id', ({ params }) => getProduct(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )

    // ─── CAN-DELETE CHECK ────────────────────────────────────────
    .get('/:id/can-delete', ({ params }) => checkProductReferences(Number(params.id)),
        { params: t.Object({ id: t.Numeric() }) }
    )

    // ─── CREATE ──────────────────────────────────────────────────
    .post('/', async ({ body, currentUserId, currentCompanyId, set }) => {
        const product = await createProduct(body as ProductPayload, currentUserId, currentCompanyId);
        set.status = 201;
        return product;
    }, { body: ProductBodySchema })

    // ─── UPDATE ──────────────────────────────────────────────────
    .put('/:id', ({ params, body, currentUserId }) =>
        updateProduct(Number(params.id), body as Partial<ProductPayload>, currentUserId),
        {
            params: t.Object({ id: t.Numeric() }),
            body: t.Partial(ProductBodySchema),
        }
    )

    // ─── DEACTIVATE (Soft Delete) ────────────────────────────────
    .patch('/:id/deactivate', ({ params, currentUserId }) =>
        deactivateProduct(Number(params.id), currentUserId),
        { params: t.Object({ id: t.Numeric() }) }
    )

    // ─── RESTORE ─────────────────────────────────────────────────
    .patch('/:id/restore', ({ params, currentUserId }) =>
        restoreProduct(Number(params.id), currentUserId),
        { params: t.Object({ id: t.Numeric() }) }
    )

    // ─── HARD DELETE ─────────────────────────────────────────────
    .delete('/:id', async ({ params, set }) => {
        await hardDeleteProduct(Number(params.id));
        set.status = 204;
    }, { params: t.Object({ id: t.Numeric() }) })

    // ─── BULK DEACTIVATE ─────────────────────────────────────────
    .post('/bulk/delete', ({ body, currentUserId }) =>
        bulkDeactivateProducts(body.ids, currentUserId),
        { body: t.Object({ ids: t.Array(t.Number()) }) }
    )

    // ─── BULK RESTORE ────────────────────────────────────────────
    .patch('/bulk/restore', ({ body, currentUserId }) =>
        bulkRestoreProducts(body.ids, currentUserId),
        { body: t.Object({ ids: t.Array(t.Number()) }) }
    );
