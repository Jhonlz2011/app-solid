import { and, desc, eq, ilike, or, sql, inArray, type AnyColumn, type SQL } from '@app/schema';
import { db } from '../../core/db';
import { products, productVariants, categories, brands, uom } from '@app/schema/tables';
import { DomainError } from '../../core/errors';
import { cacheService } from '../../core/cache';
import { CursorPaginator } from '../../core/db/paginator';
// =============================================================================
// Types & Column Whitelists
// =============================================================================
export interface ProductColumnFilters {
    categoryId?: string[];
    brandId?: string[];
    productType?: string[];
    isActive?: string[];
}

export interface ProductFilters extends ProductColumnFilters {
    cursor?: string;
    limit?: number;
    search?: string;
    direction?: 'next' | 'prev' | 'first' | 'last';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
}

export const SORTABLE_COLUMNS: Record<string, AnyColumn> = {
    id: products.id,
    name: products.name,
    slug: products.slug,
    default_base_price: products.default_base_price,
    product_type: products.product_type,
    is_active: products.is_active,
    created_at: products.created_at,
};

export interface ProductReferences {
    inventoryStock: number;
    inventoryMovements: number;
    inventoryDimensionalItems: number;
    purchaseOrderItems: number;
    invoiceItems: number;
    workOrderItems: number;
    manufacturingOrders: number;
    manufacturingOrderInputs: number;
    manufacturingLog: number;
    supplierProducts: number;
    goodsReceiptItems: number;
    materialRequestItems: number;
    materialRequestDispatches: number;
    requestReturnItems: number;
    total: number;
    canDelete: boolean;
}

// =============================================================================
// Shared Filter Builder
// =============================================================================

export interface FilterBuildOptions {
    companyId: number;
    search?: string;
    filters?: ProductColumnFilters;
    columnFilters?: ProductColumnFilters;
    excludeColumn?: string;
    excludeFilterKey?: string;
}

export function buildWhereConditions(opts: FilterBuildOptions): SQL[] {
    const conditions: SQL[] = [eq(products.company_id, opts.companyId)];

    if (opts.search) {
        const pattern = `%${opts.search}%`;
        const searchCondition = or(
            ilike(products.name, pattern),
            ilike(products.slug, pattern),
            ilike(products.description, pattern),
            // Search in variants (SKU + barcode) — essential for hardware catalogs
            sql`EXISTS (
                SELECT 1 FROM product_variants pv
                WHERE pv.product_id = ${products.id}
                AND pv.company_id = ${opts.companyId}
                AND (pv.sku ILIKE ${pattern} OR pv.barcode ILIKE ${pattern})
            )`
        );
        if (searchCondition) conditions.push(searchCondition);
    }

    const cf = opts.filters || opts.columnFilters;
    const exclude = opts.excludeFilterKey || opts.excludeColumn;

    // is_active filter (default to active-only)
    if (exclude !== 'isActive') {
        if (cf?.isActive && cf.isActive.length > 0) {
            const boolValues = cf.isActive.map(v => v === 'true');
            if (boolValues.length === 1) {
                conditions.push(eq(products.is_active, boolValues[0]));
            }
        } else {
            conditions.push(eq(products.is_active, true));
        }
    }

    if (exclude !== 'categoryId' && cf?.categoryId && cf.categoryId.length > 0) {
        conditions.push(inArray(products.category_id, cf.categoryId.map(Number)));
    }
    if (exclude !== 'brandId' && cf?.brandId && cf.brandId.length > 0) {
        conditions.push(inArray(products.brand_id, cf.brandId.map(Number)));
    }
    if (exclude !== 'productType' && cf?.productType && cf.productType.length > 0) {
        conditions.push(inArray(products.product_type, cf.productType as any));
    }

    return conditions;
}

export async function fetchProductRows(ids: number[], companyId: number) {
    if (ids.length === 0) return [];
    return db
        .select({
            id: products.id,
            product_type: products.product_type,
            product_subtype: products.product_subtype,
            slug: products.slug,
            name: products.name,
            description: products.description,
            default_base_price: products.default_base_price,
            uom_inventory_id: products.uom_inventory_id,
            uom_code: uom.code,
            uom_name: uom.name,
            has_dimensional_tracking: products.has_dimensional_tracking,
            is_active: products.is_active,
            created_at: products.created_at,
            iva_rate_code: products.iva_rate_code,
            min_stock_alert: products.min_stock_alert,
            image_urls: products.image_urls,
            // Joined fields
            category_name: categories.name,
            category_id: products.category_id,
            brand_name: brands.name,
            brand_id: products.brand_id,
            // Default variant SKU for table display
            default_sku: sql<string | null>`(
                SELECT pv.sku FROM product_variants pv
                WHERE pv.product_id = ${products.id} AND pv.is_default = true
                LIMIT 1
            )`,
            variant_count: sql<number>`(
                SELECT count(*) FROM product_variants pv
                WHERE pv.product_id = ${products.id} AND pv.is_active = true
            )`.mapWith(Number),
        })
        .from(products)
        .leftJoin(categories, eq(products.category_id, categories.id))
        .leftJoin(brands, eq(products.brand_id, brands.id))
        .leftJoin(uom, eq(products.uom_inventory_id, uom.id))
        .where(and(eq(products.company_id, companyId), inArray(products.id, ids)));
}

export const productPaginator = new CursorPaginator<typeof products, ProductColumnFilters>({
    table: products,
    idColumn: products.id,
    companyIdColumn: products.company_id,
    sortableColumns: SORTABLE_COLUMNS,
    defaultSortBy: 'name',
    cacheNamespace: 'products',
    ttl: 120,
    buildConditions: (opts) => buildWhereConditions(opts),
});

// =============================================================================
// List Products — Router
// =============================================================================

export async function listProducts(filters: ProductFilters, companyId: number) {
    const { cursor, direction, limit, search, sortBy, sortOrder, page, ...columnFilters } = filters;
    return productPaginator.paginate(
        { cursor, direction, limit, search, sortBy, sortOrder, page, filters: columnFilters },
        companyId,
        (ids) => fetchProductRows(ids, companyId)
    );
}

// =============================================================================
// Facets
// =============================================================================

export type ProductFacetColumn = 'category_id' | 'brand_id' | 'product_type' | 'is_active';

export const FACET_TO_FILTER_KEY: Record<ProductFacetColumn, keyof ProductColumnFilters> = {
    category_id: 'categoryId',
    brand_id: 'brandId',
    product_type: 'productType',
    is_active: 'isActive',
};

export async function getProductFacets(
    columns: ProductFacetColumn[],
    filters: { search?: string } & ProductColumnFilters,
    companyId: number
) {
    const columnMap: Record<ProductFacetColumn, any> = {
        category_id: products.category_id,
        brand_id: products.brand_id,
        product_type: products.product_type,
        is_active: products.is_active,
    };

    // For category/brand facets, we want to return the name, not just the ID
    const labelJoins: Partial<Record<ProductFacetColumn, { table: any; nameCol: any; idCol: any }>> = {
        category_id: { table: categories, nameCol: categories.name, idCol: categories.id },
        brand_id: { table: brands, nameCol: brands.name, idCol: brands.id },
    };

    return productPaginator.getFacets(
        columns,
        columnMap,
        FACET_TO_FILTER_KEY,
        labelJoins,
        filters,
        companyId
    );
}

// =============================================================================
// Get Single Product (with variants)
// =============================================================================

export async function getProduct(id: number, companyId: number) {
    const cacheKey = `products:c${companyId}:${id}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const product = await db.query.products.findFirst({
            where: and(eq(products.id, id), eq(products.company_id, companyId)),
            with: {
                category: true,
                brand: true,
                variants: true,
                uomConversions: true,
                components: {
                    with: { componentProduct: true },
                },
            }
        });

        if (!product) throw new DomainError('Producto no encontrado', 404);

        return product;
    }, 600);
}

// =============================================================================
// References Check
// =============================================================================

export async function checkProductReferences(productId: number, companyId: number): Promise<ProductReferences> {
    const cacheKey = `products:c${companyId}:refs:${productId}`;
    return cacheService.getOrSet(cacheKey, async () => {
        const [refs] = await db
            .select({
                inventoryStock: sql<number>`(
                    SELECT count(*) FROM inventory_stock ist
                    JOIN product_variants pv ON ist.variant_id = pv.id
                    WHERE pv.product_id = ${productId} AND ist.company_id = ${companyId}
                )`.mapWith(Number),
                inventoryMovements: sql<number>`(
                    SELECT count(*) FROM inventory_movements im
                    JOIN product_variants pv ON im.variant_id = pv.id
                    WHERE pv.product_id = ${productId}
                )`.mapWith(Number),
                inventoryDimensionalItems: sql<number>`(
                    SELECT count(*) FROM inventory_dimensional_items idi
                    JOIN product_variants pv ON idi.variant_id = pv.id
                    WHERE pv.product_id = ${productId}
                )`.mapWith(Number),
                purchaseOrderItems: sql<number>`(
                    SELECT count(*) FROM purchase_order_items poi
                    JOIN product_variants pv ON poi.variant_id = pv.id
                    WHERE pv.product_id = ${productId}
                )`.mapWith(Number),
                invoiceItems: sql<number>`(
                    SELECT count(*) FROM invoice_items ii
                    JOIN product_variants pv ON ii.variant_id = pv.id
                    WHERE pv.product_id = ${productId}
                )`.mapWith(Number),
                workOrderItems: sql<number>`(SELECT count(*) FROM work_order_items WHERE product_id = ${productId})`.mapWith(Number),
                manufacturingOrders: sql<number>`(
                    SELECT count(*) FROM manufacturing_orders mo
                    JOIN product_variants pv ON mo.output_variant_id = pv.id
                    WHERE pv.product_id = ${productId}
                )`.mapWith(Number),
                manufacturingOrderInputs: sql<number>`(
                    SELECT count(*) FROM manufacturing_order_inputs moi
                    JOIN product_variants pv ON moi.variant_id = pv.id
                    WHERE pv.product_id = ${productId}
                )`.mapWith(Number),
                manufacturingLog: sql<number>`(
                    SELECT count(*) FROM manufacturing_log ml
                    JOIN product_variants pv ON ml.variant_id = pv.id
                    WHERE pv.product_id = ${productId}
                )`.mapWith(Number),
                supplierProducts: sql<number>`(
                    SELECT count(*) FROM supplier_products sp
                    JOIN product_variants pv ON sp.variant_id = pv.id
                    WHERE pv.product_id = ${productId}
                )`.mapWith(Number),
                goodsReceiptItems: sql<number>`(
                    SELECT count(*) FROM goods_receipt_items gri
                    JOIN product_variants pv ON gri.variant_id = pv.id
                    WHERE pv.product_id = ${productId}
                )`.mapWith(Number),
                materialRequestItems: sql<number>`(
                    SELECT count(*) FROM material_request_items mri
                    JOIN product_variants pv ON mri.variant_id = pv.id
                    WHERE pv.product_id = ${productId}
                )`.mapWith(Number),
                materialRequestDispatches: sql<number>`(
                    SELECT count(*) FROM material_request_dispatches mrd
                    JOIN product_variants pv ON mrd.variant_id = pv.id
                    WHERE pv.product_id = ${productId}
                )`.mapWith(Number),
                requestReturnItems: sql<number>`(
                    SELECT count(*) FROM request_return_items rri
                    JOIN product_variants pv ON rri.variant_id = pv.id
                    WHERE pv.product_id = ${productId}
                )`.mapWith(Number),
            })
            .from(sql`(SELECT 1) as dummy`);

        const total = Object.values(refs).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
        return { ...refs, total, canDelete: total === 0 };
    }, 10);
}

// =============================================================================
// SKU Auto-Generation
// =============================================================================

export async function generateSku(companyId: number, categoryId?: number, brandId?: number): Promise<string> {
    return db.transaction(async (tx) => {
        let prefix = 'PRD';

        if (categoryId) {
            const cat = await tx.select({ name: categories.name }).from(categories).where(eq(categories.id, categoryId)).limit(1);
            if (cat[0]) prefix = cat[0].name.substring(0, 3).toUpperCase().replace(/\s/g, '');
        }

        if (brandId) {
            const brand = await tx.select({ name: brands.name }).from(brands).where(eq(brands.id, brandId)).limit(1);
            if (brand[0]) prefix += '-' + brand[0].name.substring(0, 3).toUpperCase().replace(/\s/g, '');
        }

        // Advisory lock per prefix to serialize concurrent SKU generation
        const lockId = [...prefix].reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 0) & 0x7FFFFFFF;
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockId})`);

        const [last] = await tx
            .select({ sku: productVariants.sku })
            .from(productVariants)
            .where(and(
                eq(productVariants.company_id, companyId),
                ilike(productVariants.sku, `${prefix}-%`)
            ))
            .orderBy(desc(sql`COALESCE((regexp_match(${productVariants.sku}, '-(\\d+)$'))[1]::int, 0)`))
            .limit(1);

        let seq = 1;
        if (last?.sku) {
            const match = last.sku.match(/-(\d+)$/);
            if (match) seq = parseInt(match[1], 10) + 1;
        }

        return `${prefix}-${String(seq).padStart(3, '0')}`;
    });
}

// =============================================================================
// Variant Lookup by SKU/Barcode
// =============================================================================

export async function getVariantBySkuOrBarcode(code: string, companyId: number) {
    const [variant] = await db
        .select()
        .from(productVariants)
        .where(and(
            eq(productVariants.company_id, companyId),
            or(eq(productVariants.sku, code), eq(productVariants.barcode, code))
        ))
        .limit(1);

    return variant ?? null;
}
