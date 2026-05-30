import { and, desc, eq, ilike, or, sql, lt, gt, asc, inArray, type AnyColumn } from '@app/schema';
import { db, type Tx } from '../db';
import { products, productVariants, categories, brands } from '@app/schema/tables';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/sse';
import { createHash } from 'crypto';
import type { ProductFormData } from '@app/schema/frontend';

// =============================================================================
// Types
// =============================================================================

export type ProductPayload = ProductFormData;

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

interface PaginationMeta {
    nextCursor: string | null;
    prevCursor: string | null;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    total: number;
    page: number | null;
    pageCount: number | null;
}

/** Whitelist of sortable columns */
const SORTABLE_COLUMNS: Record<string, AnyColumn> = {
    id: products.id,
    name: products.name,
    slug: products.slug,
    default_base_price: products.default_base_price,
    product_type: products.product_type,
    is_active: products.is_active,
    created_at: products.created_at,
};

// =============================================================================
// Cursor Helpers
// =============================================================================

function encodeCursor(id: number): string {
    return Buffer.from(JSON.stringify({ id })).toString('base64url');
}

function decodeCursor(cursor: string): { id: number } | null {
    try {
        return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
    } catch { return null; }
}

function hashKey(obj: Record<string, unknown>): string {
    return createHash('md5').update(JSON.stringify(obj)).digest('hex').slice(0, 12);
}

// =============================================================================
// Shared Filter Builder
// =============================================================================

interface FilterBuildOptions {
    companyId: number;
    search?: string;
    columnFilters?: ProductColumnFilters;
    excludeColumn?: string;
}

function buildWhereConditions(opts: FilterBuildOptions) {
    const conditions = [];

    // Tenant isolation — always filter by company
    conditions.push(eq(products.company_id, opts.companyId));

    if (opts.search) {
        const pattern = `%${opts.search}%`;
        conditions.push(or(
            ilike(products.name, pattern),
            ilike(products.slug, pattern),
            ilike(products.description, pattern)
        ));
    }

    const cf = opts.columnFilters;
    const exclude = opts.excludeColumn;

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

// =============================================================================
// List Products — Router
// =============================================================================

export async function listProducts(filters: ProductFilters, companyId: number) {
    const { sortBy } = filters;
    if (sortBy && sortBy !== 'id' && SORTABLE_COLUMNS[sortBy]) {
        return listProductsSorted(filters, companyId);
    }
    return listProductsCursor(filters, companyId);
}

// =============================================================================
// Strategy 1: Cursor Pagination
// =============================================================================

async function listProductsCursor(filters: ProductFilters, companyId: number) {
    const { cursor, limit: limitRaw = 25, search, direction = 'first', ...rest } = filters;
    const { sortBy, sortOrder, page, ...columnFilters } = rest;
    const limit = Number(limitRaw);
    const cacheKey = `products:c${companyId}:list:${hashKey({ cursor, limit, search, direction, ...columnFilters })}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const conditions = buildWhereConditions({ companyId, search, columnFilters });
        const total = await getCachedTotal(companyId, search, columnFilters);

        let effectiveLimit = limit;
        if (direction === 'last') {
            const remainder = total % limit;
            effectiveLimit = remainder === 0 ? limit : remainder;
        }

        const { minId, maxId } = await getCachedBounds(companyId, search, columnFilters);

        const cursorData = cursor ? decodeCursor(cursor) : null;
        if (cursorData) {
            if (direction === 'next') conditions.push(lt(products.id, cursorData.id));
            else if (direction === 'prev') conditions.push(gt(products.id, cursorData.id));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        const fetchLimit = effectiveLimit + 1;
        const isDescending = direction === 'first' || direction === 'next';

        let data = await db
            .select({
                id: products.id,
                product_type: products.product_type,
                product_subtype: products.product_subtype,
                slug: products.slug,
                name: products.name,
                description: products.description,
                default_base_price: products.default_base_price,
                uom_inventory_id: products.uom_inventory_id,
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
            .where(whereClause)
            .limit(fetchLimit)
            .orderBy(isDescending ? desc(products.id) : asc(products.id));

        const hasMore = data.length > effectiveLimit;
        if (hasMore) data = data.slice(0, effectiveLimit);
        if (direction === 'prev' || direction === 'last') data = data.reverse();

        const meta: PaginationMeta = {
            nextCursor: null, prevCursor: null,
            hasNextPage: false, hasPrevPage: false,
            total, page: null, pageCount: null,
        };

        if (data.length > 0) {
            const firstItem = data[0];
            const lastItem = data[data.length - 1];
            meta.hasPrevPage = firstItem.id < maxId;
            meta.prevCursor = meta.hasPrevPage ? encodeCursor(firstItem.id) : null;
            meta.hasNextPage = lastItem.id > minId;
            meta.nextCursor = meta.hasNextPage ? encodeCursor(lastItem.id) : null;
        }

        return { data, meta };
    }, 120);
}

// =============================================================================
// Strategy 2: Offset Pagination (Deferred Join)
// =============================================================================

async function listProductsSorted(filters: ProductFilters, companyId: number) {
    const {
        limit: limitRaw = 25, search,
        sortBy = 'name', sortOrder = 'asc',
        page: pageRaw = 1,
        ...rest
    } = filters;
    const { cursor, direction, ...columnFilters } = rest;
    const limit = Number(limitRaw);
    const page = Math.max(1, Number(pageRaw));
    const offset = (page - 1) * limit;
    const cacheKey = `products:c${companyId}:sorted:${hashKey({ limit, search, sortBy, sortOrder, page, ...columnFilters })}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const conditions = buildWhereConditions({ companyId, search, columnFilters });
        const total = await getCachedTotal(companyId, search, columnFilters);
        const pageCount = Math.ceil(total / limit);

        const sortColumn = SORTABLE_COLUMNS[sortBy]!;
        const orderFn = sortOrder === 'desc' ? desc : asc;
        const orderClauses = [orderFn(sortColumn), orderFn(products.id)];

        const idRows = await db
            .select({ id: products.id })
            .from(products)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(...orderClauses)
            .limit(limit)
            .offset(offset);

        if (idRows.length === 0) {
            return {
                data: [],
                meta: { nextCursor: null, prevCursor: null, hasNextPage: false, hasPrevPage: false, total, page, pageCount } as PaginationMeta,
            };
        }

        const ids = idRows.map(r => r.id);
        const rows = await db
            .select({
                id: products.id,
                product_type: products.product_type,
                product_subtype: products.product_subtype,
                slug: products.slug,
                name: products.name,
                description: products.description,
                default_base_price: products.default_base_price,
                uom_inventory_id: products.uom_inventory_id,
                has_dimensional_tracking: products.has_dimensional_tracking,
                is_active: products.is_active,
                created_at: products.created_at,
                iva_rate_code: products.iva_rate_code,
                min_stock_alert: products.min_stock_alert,
                image_urls: products.image_urls,
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
            .where(inArray(products.id, ids));

        const idOrder = new Map(ids.map((id, i) => [id, i]));
        const data = rows.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

        return {
            data,
            meta: {
                nextCursor: null, prevCursor: null,
                hasNextPage: page < pageCount, hasPrevPage: page > 1,
                total, page, pageCount,
            } as PaginationMeta,
        };
    }, 120);
}

// =============================================================================
// Cached Helpers
// =============================================================================

async function getCachedTotal(companyId: number, search?: string, columnFilters?: ProductColumnFilters) {
    const cacheKey = `products:c${companyId}:total:${hashKey({ search: search || 'all', ...columnFilters })}`;
    return cacheService.getOrSet(cacheKey, async () => {
        const conditions = buildWhereConditions({ companyId, search, columnFilters });
        const [{ count }] = await db
            .select({ count: sql<number>`count(*)`.mapWith(Number) })
            .from(products)
            .where(conditions.length > 0 ? and(...conditions) : undefined);
        return count;
    }, 120);
}

async function getCachedBounds(companyId: number, search?: string, columnFilters?: ProductColumnFilters) {
    const cacheKey = `products:c${companyId}:bounds:${hashKey({ search: search || 'all', ...columnFilters })}`;
    return cacheService.getOrSet(cacheKey, async () => {
        const conditions = buildWhereConditions({ companyId, search, columnFilters });
        const [result] = await db
            .select({
                minId: sql<number>`min(${products.id})`.mapWith(Number),
                maxId: sql<number>`max(${products.id})`.mapWith(Number),
            })
            .from(products)
            .where(conditions.length > 0 ? and(...conditions) : undefined);
        return result || { minId: 0, maxId: 0 };
    }, 120);
}

// =============================================================================
// Facets
// =============================================================================

type ProductFacetColumn = 'category_id' | 'brand_id' | 'product_type' | 'is_active';

const FACET_TO_FILTER_KEY: Record<ProductFacetColumn, keyof ProductColumnFilters> = {
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
    const { search, ...columnFilters } = filters;
    const cacheKey = `products:c${companyId}:facets:${hashKey({ columns, search, ...columnFilters })}`;

    return cacheService.getOrSet(cacheKey, async () => {
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

        const results: Record<string, { value: string; label?: string; count: number }[]> = {};

        await Promise.all(
            columns.map(async (col) => {
                const dbCol = columnMap[col];
                if (!dbCol) return;

                const excludeKey = FACET_TO_FILTER_KEY[col];
                const conditions = buildWhereConditions({ companyId, search, columnFilters, excludeColumn: excludeKey });

                const join = labelJoins[col];
                if (join) {
                    // Join to get label (category name / brand name)
                    const rows = await db
                        .select({
                            value: sql<string>`CAST(${dbCol} AS TEXT)`,
                            label: join.nameCol,
                            count: sql<number>`count(*)`.mapWith(Number),
                        })
                        .from(products)
                        .leftJoin(join.table, eq(dbCol, join.idCol))
                        .where(conditions.length > 0 ? and(...conditions) : undefined)
                        .groupBy(dbCol, join.nameCol)
                        .orderBy(desc(sql`count(*)`));
                    results[col] = rows.filter(r => r.value !== null);
                } else {
                    const rows = await db
                        .select({
                            value: sql<string>`CAST(${dbCol} AS TEXT)`,
                            count: sql<number>`count(*)`.mapWith(Number),
                        })
                        .from(products)
                        .where(conditions.length > 0 ? and(...conditions) : undefined)
                        .groupBy(dbCol)
                        .orderBy(desc(sql`count(*)`));
                    results[col] = rows.filter(r => r.value !== null);
                }
            })
        );

        return results;
    }, 300);
}

// =============================================================================
// Get Single Product (with variants)
// =============================================================================

export async function getProduct(id: number) {
    const cacheKey = `products:${id}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const product = await db.query.products.findFirst({
            where: eq(products.id, id),
            with: {
                category: true,
                brand: true,
                variants: true,
                uomConversions: true,
            }
        });

        if (!product) throw new DomainError('Producto no encontrado', 404);

        return product;
    }, 600);
}

// =============================================================================
// Create Product (with Variants)
// =============================================================================

export async function createProduct(payload: ProductPayload, userId: number, companyId: number) {
    const existing = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.company_id, companyId), eq(products.slug, payload.slug)));

    if (existing.length) {
        throw new DomainError('El slug ya está registrado', 409);
    }

    return db.transaction(async (tx: Tx) => {
        const { variants, image_urls, ...productData } = payload;

        const [created] = await tx
            .insert(products)
            .values({
                company_id: companyId,
                product_type: productData.product_type,
                product_subtype: productData.product_subtype ?? null,
                category_id: productData.category_id,
                brand_id: productData.brand_id ?? null,

                slug: productData.slug,
                name: productData.name,
                description: productData.description ?? null,
                shared_attributes: productData.shared_attributes ?? {},
                extra_specs: productData.extra_specs ?? {},
                image_urls: image_urls ?? [],
                uom_inventory_id: productData.uom_inventory_id,
                has_dimensional_tracking: productData.has_dimensional_tracking,
                min_stock_alert: productData.min_stock_alert?.toString() ?? '0',
                default_base_price: productData.default_base_price.toString(),
                iva_rate_code: productData.iva_rate_code,
                is_active: productData.is_active,
                created_by: userId,
                updated_by: userId,
            })
            .returning();

        // Create variants (each variant = 1 SKU)
        if (variants && variants.length > 0) {
            await tx.insert(productVariants).values(
                variants.map((v, idx) => ({
                    product_id: created.id,
                    sku: v.sku,
                    variant_name: v.variant_name ?? null,
                    variant_attributes: v.variant_attributes ?? {},
                    content_quantity: v.content_quantity.toString(),
                    sale_uom_id: v.sale_uom_id ?? null,
                    base_price: v.base_price?.toString() ?? null,
                    last_cost: v.last_cost?.toString() ?? '0',
                    barcode: v.barcode ?? null,
                    image_urls: v.image_urls ?? null,
                    std_length_cm: v.std_length_cm?.toString() ?? null,
                    std_width_cm: v.std_width_cm?.toString() ?? null,
                    is_default: v.is_default,
                    is_active: v.is_active,
                    sort_order: v.sort_order ?? idx,
                }))
            );
        }

        cacheService.invalidate('products:*');
        broadcast('product:created', created, 'products');

        return created;
    });
}

// =============================================================================
// Update Product (with Variant Sync)
// =============================================================================

export async function updateProduct(productId: number, payload: Partial<ProductPayload>, userId: number) {
    return db.transaction(async (tx: Tx) => {
        const { variants, image_urls, ...productData } = payload;

        const updateValues: Partial<typeof products.$inferInsert> = {
            updated_at: new Date(),
            updated_by: userId,
        };

        // Only set fields that were provided
        if (productData.product_type !== undefined) updateValues.product_type = productData.product_type;
        if (productData.product_subtype !== undefined) updateValues.product_subtype = productData.product_subtype;
        if (productData.category_id !== undefined) updateValues.category_id = productData.category_id;
        if (productData.brand_id !== undefined) updateValues.brand_id = productData.brand_id;
        if (productData.slug !== undefined) updateValues.slug = productData.slug;
        if (productData.name !== undefined) updateValues.name = productData.name;
        if (productData.description !== undefined) updateValues.description = productData.description;
        if (productData.shared_attributes !== undefined) updateValues.shared_attributes = productData.shared_attributes;
        if (productData.extra_specs !== undefined) updateValues.extra_specs = productData.extra_specs;
        if (image_urls !== undefined) updateValues.image_urls = image_urls;
        if (productData.uom_inventory_id !== undefined) updateValues.uom_inventory_id = productData.uom_inventory_id;
        if (productData.has_dimensional_tracking !== undefined) updateValues.has_dimensional_tracking = productData.has_dimensional_tracking;
        if (productData.min_stock_alert !== undefined) updateValues.min_stock_alert = productData.min_stock_alert?.toString();
        if (productData.default_base_price !== undefined) updateValues.default_base_price = productData.default_base_price.toString();
        if (productData.iva_rate_code !== undefined) updateValues.iva_rate_code = productData.iva_rate_code;
        if (productData.is_active !== undefined) updateValues.is_active = productData.is_active;

        const [updated] = await tx
            .update(products)
            .set(updateValues)
            .where(eq(products.id, productId))
            .returning();

        if (!updated) throw new DomainError('Producto no encontrado', 404);

        // Smart Variant Sync — preserves existing IDs to maintain FK integrity
        if (variants !== undefined) {
            const existingVariants = await tx
                .select({ id: productVariants.id })
                .from(productVariants)
                .where(eq(productVariants.product_id, productId));

            const existingIds = new Set(existingVariants.map(v => v.id));
            const incomingIds = new Set(
                variants.filter(v => v.id != null).map(v => v.id!)
            );

            // DELETE removed (existed but not in new list)
            const toDelete = [...existingIds].filter(id => !incomingIds.has(id));
            if (toDelete.length > 0) {
                await tx.delete(productVariants)
                    .where(and(
                        eq(productVariants.product_id, productId),
                        inArray(productVariants.id, toDelete)
                    ));
            }

            // UPSERT existing + INSERT new
            for (const v of variants) {
                const values = {
                    product_id: productId,
                    sku: v.sku,
                    variant_name: v.variant_name ?? null,
                    variant_attributes: v.variant_attributes ?? {},
                    content_quantity: v.content_quantity.toString(),
                    sale_uom_id: v.sale_uom_id ?? null,
                    base_price: v.base_price?.toString() ?? null,
                    last_cost: v.last_cost?.toString() ?? '0',
                    barcode: v.barcode ?? null,
                    image_urls: v.image_urls ?? null,
                    std_length_cm: v.std_length_cm?.toString() ?? null,
                    std_width_cm: v.std_width_cm?.toString() ?? null,
                    is_default: v.is_default,
                    is_active: v.is_active,
                    sort_order: v.sort_order ?? 0,
                };

                if (v.id != null && existingIds.has(v.id)) {
                    await tx.update(productVariants)
                        .set(values)
                        .where(eq(productVariants.id, v.id));
                } else {
                    await tx.insert(productVariants).values(values);
                }
            }
        }

        cacheService.invalidate(`products:${productId}`);
        cacheService.invalidate('products:list:*');
        cacheService.invalidate('products:sorted:*');
        cacheService.invalidate('products:total:*');
        cacheService.invalidate('products:bounds:*');
        cacheService.invalidate('products:facets:*');
        broadcast('product:updated', updated, 'products');

        return updated;
    });
}

// =============================================================================
// Deactivate / Restore / Hard Delete
// =============================================================================

export async function deactivateProduct(productId: number, userId: number) {
    const [updated] = await db
        .update(products)
        .set({ is_active: false, updated_at: new Date(), updated_by: userId })
        .where(eq(products.id, productId))
        .returning();

    if (!updated) throw new DomainError('Producto no encontrado', 404);

    cacheService.invalidate(`products:*`);
    broadcast('product:updated', { id: productId, is_active: false }, 'products');
    return { success: true };
}

export async function restoreProduct(productId: number, userId: number) {
    const [updated] = await db
        .update(products)
        .set({ is_active: true, updated_at: new Date(), updated_by: userId })
        .where(eq(products.id, productId))
        .returning();

    if (!updated) throw new DomainError('Producto no encontrado', 404);

    cacheService.invalidate(`products:*`);
    broadcast('product:updated', { id: productId, is_active: true }, 'products');
    return { success: true };
}

export async function hardDeleteProduct(productId: number) {
    const [deleted] = await db
        .delete(products)
        .where(eq(products.id, productId))
        .returning();

    if (!deleted) throw new DomainError('Producto no encontrado', 404);

    cacheService.invalidate(`products:*`);
    broadcast('product:deleted', { id: productId }, 'products');
    return { success: true };
}

// =============================================================================
// Bulk Operations
// =============================================================================

export async function bulkDeactivateProducts(ids: number[], userId: number) {
    await db
        .update(products)
        .set({ is_active: false, updated_at: new Date(), updated_by: userId })
        .where(inArray(products.id, ids));

    cacheService.invalidate('products:*');
    broadcast('product:updated', { ids, is_active: false }, 'products');
    return { affected: ids.length };
}

export async function bulkRestoreProducts(ids: number[], userId: number) {
    await db
        .update(products)
        .set({ is_active: true, updated_at: new Date(), updated_by: userId })
        .where(inArray(products.id, ids));

    cacheService.invalidate('products:*');
    broadcast('product:updated', { ids, is_active: true }, 'products');
    return { affected: ids.length };
}

// =============================================================================
// Reference Check (Pre-flight for hard delete)
// =============================================================================

export interface ProductReferences {
    purchaseOrderItems: number;
    invoiceItems: number;
    workOrderItems: number;
    inventoryMovements: number;
    total: number;
    canDelete: boolean;
}

export async function checkProductReferences(productId: number): Promise<ProductReferences> {
    const cacheKey = `products:refs:${productId}`;
    return cacheService.getOrSet(cacheKey, async () => {
        // Check references via variants (the transactional entity)
        const [refs] = await db
            .select({
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
                inventoryMovements: sql<number>`(
                    SELECT count(*) FROM inventory_movements im
                    JOIN product_variants pv ON im.variant_id = pv.id
                    WHERE pv.product_id = ${productId}
                )`.mapWith(Number),
            })
            .from(sql`(SELECT 1) as dummy`);

        const total = refs.purchaseOrderItems + refs.invoiceItems + refs.workOrderItems + refs.inventoryMovements;
        return { ...refs, total, canDelete: total === 0 };
    }, 10);
}

// =============================================================================
// SKU Auto-Generation
// =============================================================================

export async function generateSku(categoryId?: number, brandId?: number): Promise<string> {
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

        // Find next sequential number from VARIANTS (where SKUs live now)
        const [last] = await tx
            .select({ sku: productVariants.sku })
            .from(productVariants)
            .where(ilike(productVariants.sku, `${prefix}-%`))
            .orderBy(desc(productVariants.sku))
            .limit(1);

        let seq = 1;
        if (last?.sku) {
            const match = last.sku.match(/-(\d+)$/);
            if (match) seq = parseInt(match[1], 10) + 1;
        }

        return `${prefix}-${String(seq).padStart(3, '0')}`;
    });
}
