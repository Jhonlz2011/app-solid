import { Elysia, t } from 'elysia';
import { db } from '../../core/db';
import { companies } from '@app/schema/tables';
import { eq } from '@app/schema';
import { authGuard } from '../../plugins/auth-guard';
import { rbac } from '../../plugins/rbac';
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
    getVariantBySkuOrBarcode,
    type ProductPayload,
import { publicStorageService } from '../../core/storage';
import {
    ProductPayloadSchema,
    ProductUploadImagesBodySchema,
    ProductDeleteImageBodySchema,
    ProductListQuerySchema,
    ProductFacetsQuerySchema,
    GenerateSkuQuerySchema,
    IdParamSchema,
    BulkIdsBodySchema,
} from '@app/schema/backend';

export const productRoutes = new Elysia({ prefix: '/products' })
    .use(authGuard)
    .use(rbac)

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
            query: ProductListQuerySchema,
            permission: 'products.read',
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
            query: ProductFacetsQuerySchema,
            permission: 'products.read',
        }
    )

    // ─── GENERATE SKU ────────────────────────────────────────────
    .get('/generate-sku', ({ query, currentCompanyId }) =>
        generateSku(
            currentCompanyId,
            query.categoryId ? Number(query.categoryId) : undefined,
            query.brandId ? Number(query.brandId) : undefined,
        ),
        {
            query: GenerateSkuQuerySchema,
            permission: 'products.read',
        }
    )

    // ─── OPTIMIZED PUBLIC PRODUCT IMAGES UPLOAD (R2 PUBLIC BUCKET) ───
    .post('/upload-images', async ({ body, currentCompanyId, set }) => {
        const [company] = await db.select({ slug: companies.slug })
            .from(companies).where(eq(companies.id, currentCompanyId)).limit(1);
        const companySlug = company?.slug ?? 'default';

        const files = Array.isArray(body.files) ? body.files : [body.files];
        if (!files || files.length === 0 || !files[0]) {
            set.status = 400;
            return { message: 'No se enviaron archivos' };
        }

        const urls: string[] = [];
        for (const file of files) {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const url = await publicStorageService.optimizeAndUploadProductImage({
                slug: companySlug,
                rawFileBuffer: buffer,
            });
            urls.push(url);
        }

        return { urls };
    }, {
        body: ProductUploadImagesBodySchema,
        permission: 'products.create',
    })

    // ─── DELETE PRODUCT IMAGE (R2 cleanup) ───────────────────────
    .post('/delete-image', async ({ body }) => {
        if (body.url) {
            await publicStorageService.deleteObject(body.url);
        }
        return { success: true };
    }, {
        body: ProductDeleteImageBodySchema,
        permission: 'products.update',
    })

    // ─── LOOKUP BY SKU/BARCODE (POS/Scanner) ──────────────────────
    .get('/lookup/:code', async ({ params, currentCompanyId, set }) => {
        const variant = await getVariantBySkuOrBarcode(params.code, currentCompanyId);
        if (!variant) { set.status = 404; return { message: 'Variante no encontrada' }; }
        return variant;
    }, {
        params: t.Object({ code: t.String() }),
        permission: 'products.read',
    })

    // ─── GET BY ID ───────────────────────────────────────────────
    .get('/:id', ({ params, currentCompanyId }) => getProduct(Number(params.id), currentCompanyId),
        {
            params: IdParamSchema,
            permission: 'products.read',
        }
    )

    // ─── CAN-DELETE CHECK ────────────────────────────────────────
    .get('/:id/can-delete', ({ params, currentCompanyId }) => checkProductReferences(Number(params.id), currentCompanyId),
        {
            params: IdParamSchema,
            permission: 'products.read',
        }
    )

    // ─── CREATE ──────────────────────────────────────────────────
    .post('/', async ({ body, currentUserId, currentCompanyId, set }) => {
        const product = await createProduct(body as ProductPayload, currentUserId, currentCompanyId);
        set.status = 201;
        return product;
    }, {
        body: ProductPayloadSchema,
        permission: 'products.create',
    })

    // ─── UPDATE ──────────────────────────────────────────────────
    .put('/:id', ({ params, body, currentUserId, currentCompanyId }) =>
        updateProduct(Number(params.id), body as Partial<ProductPayload>, currentUserId, currentCompanyId),
        {
            params: IdParamSchema,
            body: t.Partial(ProductPayloadSchema),
            permission: 'products.update',
        }
    )

    // ─── DEACTIVATE (Soft Delete) ────────────────────────────────
    .patch('/:id/deactivate', ({ params, currentUserId, currentCompanyId }) =>
        deactivateProduct(Number(params.id), currentUserId, currentCompanyId),
        {
            params: IdParamSchema,
            permission: 'products.delete',
        }
    )

    // ─── RESTORE ─────────────────────────────────────────────────
    .patch('/:id/restore', ({ params, currentUserId, currentCompanyId }) =>
        restoreProduct(Number(params.id), currentUserId, currentCompanyId),
        {
            params: IdParamSchema,
            permission: 'products.restore',
        }
    )

    // ─── HARD DELETE ─────────────────────────────────────────────
    .delete('/:id', async ({ params, set, currentCompanyId }) => {
        await hardDeleteProduct(Number(params.id), currentCompanyId);
        set.status = 204;
    }, {
        params: IdParamSchema,
        permission: 'products.destroy',
    })

    // ─── BULK DEACTIVATE ─────────────────────────────────────────
    .post('/bulk/delete', ({ body, currentUserId, currentCompanyId }) =>
        bulkDeactivateProducts(body.ids, currentUserId, currentCompanyId),
        {
            body: BulkIdsBodySchema,
            permission: 'products.delete',
        }
    )

    // ─── BULK RESTORE ────────────────────────────────────────────
    .patch('/bulk/restore', ({ body, currentUserId, currentCompanyId }) =>
        bulkRestoreProducts(body.ids, currentUserId, currentCompanyId),
        {
            body: BulkIdsBodySchema,
            permission: 'products.restore',
        }
    );
