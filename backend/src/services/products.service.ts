import { and, desc, eq, ilike, or, sql, lt, gt, asc, inArray, type AnyColumn } from '@app/schema';
import { db, type Tx } from '../db';
import { products, productVariants, productComponents, categories, brands, uom } from '@app/schema/tables';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/sse';
import { createHash } from 'crypto';
import type { ProductFormData } from '@app/schema/frontend';
import { publicStorageService } from './public-storage.service';

// =============================================================================
// Helpers
// =============================================================================

/** Extract SKU from Postgres 23505 detail string */
function extractSkuFromDetail(detail?: string): string {
    if (!detail) return '(desconocido)';
    const match = detail.match(/\(company_id, sku\)=\(\d+, (.+?)\)/);
    return match?.[1] ?? detail;
}

/** Validate business rules before create/update */
function validateProductPayload(payload: ProductFormData, productId?: number) {
    // At least one variant
    if (!payload.variants?.length) {
        throw new DomainError('El producto debe tener al menos una variante', 400);
    }
    // Exactly one is_default=true
    const defaultCount = payload.variants.filter(v => v.is_default).length;
    if (defaultCount !== 1) {
        throw new DomainError('Debe haber exactamente una variante marcada como predeterminada', 400);
    }
    // product_type / product_subtype consistency
    if (payload.product_type === 'SERVICIO' && payload.product_subtype != null) {
        throw new DomainError('Un servicio no puede tener subtipo de producto', 400);
    }
    if (payload.product_type === 'PRODUCTO' && !payload.product_subtype) {
        throw new DomainError('Un producto debe tener subtipo (SIMPLE, COMPUESTO o FABRICADO)', 400);
    }
    // Components only for COMPUESTO/FABRICADO
    if (payload.components?.length && !['COMPUESTO', 'FABRICADO'].includes(payload.product_subtype ?? '')) {
        throw new DomainError('Solo productos COMPUESTO o FABRICADO pueden tener componentes', 400);
    }
    // BOM self-reference check
    if (productId && payload.components?.some(c => c.component_product_id === productId)) {
        throw new DomainError('Un producto no puede contenerse a sí mismo como componente', 400);
    }
}

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
            ilike(products.description, pattern),
            // Search in variants (SKU + barcode) — essential for hardware catalogs
            sql`EXISTS (
                SELECT 1 FROM product_variants pv
                WHERE pv.product_id = ${products.id}
                AND pv.company_id = ${opts.companyId}
                AND (pv.sku ILIKE ${pattern} OR pv.barcode ILIKE ${pattern})
            )`
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
                uom_code: uom.code,
                uom_name: uom.name,
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
            .leftJoin(uom, eq(products.uom_inventory_id, uom.id))
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
// Create Product (with Variants)
// =============================================================================

export async function createProduct(payload: ProductPayload, userId: number, companyId: number) {
    // Business validations
    validateProductPayload(payload);

    // Fast-path slug check (UX — real guarantee is the 23505 catch below)
    const existing = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.company_id, companyId), eq(products.slug, payload.slug)));

    if (existing.length) {
        throw new DomainError('El slug ya está registrado', 409);
    }

    return db.transaction(async (tx: Tx) => {
        try {
            const { variants, image_urls, components, ...productData } = payload;

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
                        company_id: companyId,
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

            // Persist BOM components for COMPUESTO/FABRICADO products
            if (components && components.length > 0) {
                // Self-reference guard (created.id is now known)
                if (components.some(c => c.component_product_id === created.id)) {
                    throw new DomainError('Un producto no puede contenerse a sí mismo como componente', 400);
                }
                await tx.insert(productComponents).values(
                    components.map(c => ({
                        company_id: companyId,
                        parent_product_id: created.id,
                        component_product_id: c.component_product_id,
                        quantity_per_parent: c.quantity_per_parent.toString(),
                        is_reversible: c.is_reversible ?? true,
                        notes: c.notes ?? null,
                    }))
                );
            }

            cacheService.invalidate(`products:c${companyId}:*`);
            broadcast('product:created', created, 'products');

            return created;
        } catch (err: any) {
            // Convert Postgres unique constraint violations to user-friendly errors
            if (err.code === '23505') {
                if (err.constraint === 'unq_product_slug_company')
                    throw new DomainError('El slug ya está registrado para esta empresa', 409);
                if (err.constraint === 'unq_variant_sku_company')
                    throw new DomainError(`SKU duplicado: ${extractSkuFromDetail(err.detail)}`, 409);
                if (err.constraint === 'unq_prod_component')
                    throw new DomainError('Componente duplicado en la lista de materiales', 409);
            }
            throw err;
        }
    });
}

// =============================================================================
// Update Product (with Variant Sync)
// =============================================================================

export async function updateProduct(productId: number, payload: Partial<ProductPayload>, userId: number, companyId: number) {
    // Business validations (only if full payload provided — partial updates skip)
    if (payload.variants !== undefined && payload.product_type !== undefined) {
        validateProductPayload(payload as ProductPayload, productId);
    }

    return db.transaction(async (tx: Tx) => {
        try {
            const { variants, image_urls, components, ...productData } = payload;

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
            if (image_urls !== undefined) updateValues.image_urls = image_urls;
            if (productData.uom_inventory_id !== undefined) updateValues.uom_inventory_id = productData.uom_inventory_id;
            if (productData.has_dimensional_tracking !== undefined) updateValues.has_dimensional_tracking = productData.has_dimensional_tracking;
            if (productData.min_stock_alert !== undefined) updateValues.min_stock_alert = productData.min_stock_alert?.toString();
            if (productData.default_base_price !== undefined) updateValues.default_base_price = productData.default_base_price.toString();
            if (productData.iva_rate_code !== undefined) updateValues.iva_rate_code = productData.iva_rate_code;
            if (productData.is_active !== undefined) updateValues.is_active = productData.is_active;

            // Fetch current image URLs for deferred R2 cleanup
            const [currentProduct] = await tx
                .select({ image_urls: products.image_urls })
                .from(products)
                .where(eq(products.id, productId));
            const oldImageUrls = (currentProduct?.image_urls as string[] | null) ?? [];

            const [updated] = await tx
                .update(products)
                .set(updateValues)
                .where(and(eq(products.id, productId), eq(products.company_id, companyId)))
                .returning();

            if (!updated) throw new DomainError('Producto no encontrado', 404);

            // Smart Variant Sync — preserves existing IDs to maintain FK integrity
            if (variants !== undefined) {
                const existingVariants = await tx
                    .select({ id: productVariants.id })
                    .from(productVariants)
                    .where(and(
                        eq(productVariants.product_id, productId),
                        eq(productVariants.company_id, companyId)
                    ));

                const existingIds = new Set(existingVariants.map(v => v.id));
                const incomingIds = new Set(
                    variants.filter(v => v.id != null).map(v => v.id!)
                );

                // Safe DELETE — check references per variant before deletion
                const toDelete = [...existingIds].filter(id => !incomingIds.has(id));
                for (const variantId of toDelete) {
                    const hasRefs = await checkVariantReferences(tx, variantId);
                    if (hasRefs) {
                        // Cannot delete — soft-deactivate to preserve FK integrity
                        await tx.update(productVariants)
                            .set({ is_active: false })
                            .where(eq(productVariants.id, variantId));
                    } else {
                        // Safe to hard-delete (no references anywhere)
                        await tx.delete(productVariants)
                            .where(and(
                                eq(productVariants.id, variantId),
                                eq(productVariants.company_id, companyId)
                            ));
                    }
                }

                // UPSERT existing + INSERT new
                for (const v of variants) {
                    const values = {
                        company_id: companyId,
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

            // Sync BOM components (delete + re-insert)
            if (components !== undefined) {
                // Self-reference guard
                if (components.some(c => c.component_product_id === productId)) {
                    throw new DomainError('Un producto no puede contenerse a sí mismo como componente', 400);
                }

                await tx.delete(productComponents)
                    .where(and(
                        eq(productComponents.parent_product_id, productId),
                        eq(productComponents.company_id, companyId)
                    ));

                if (components.length > 0) {
                    await tx.insert(productComponents).values(
                        components.map(c => ({
                            company_id: companyId,
                            parent_product_id: productId,
                            component_product_id: c.component_product_id,
                            quantity_per_parent: c.quantity_per_parent.toString(),
                            is_reversible: c.is_reversible ?? true,
                            notes: c.notes ?? null,
                        }))
                    );
                }
            }

            cacheService.invalidate(`products:c${companyId}:*`);
            broadcast('product:updated', updated, 'products');

            // Deferred R2 cleanup: delete images that were removed during edit
            if (image_urls !== undefined && oldImageUrls.length > 0) {
                const newUrls = new Set(image_urls ?? []);
                const removedUrls = oldImageUrls.filter(url => !newUrls.has(url));
                if (removedUrls.length > 0) {
                    Promise.allSettled(
                        removedUrls.map(url => publicStorageService.deleteObject(url))
                    ).catch(err => console.warn('[R2] Deferred image cleanup on update failed:', err));
                }
            }

            return updated;
        } catch (err: any) {
            // Convert Postgres unique constraint violations to user-friendly errors
            if (err.code === '23505') {
                if (err.constraint === 'unq_product_slug_company')
                    throw new DomainError('El slug ya está registrado para esta empresa', 409);
                if (err.constraint === 'unq_variant_sku_company')
                    throw new DomainError(`SKU duplicado: ${extractSkuFromDetail(err.detail)}`, 409);
                if (err.constraint === 'unq_prod_component')
                    throw new DomainError('Componente duplicado en la lista de materiales', 409);
            }
            throw err;
        }
    });
}

// =============================================================================
// Deactivate / Restore / Hard Delete — with variant cascade
// =============================================================================

export async function deactivateProduct(productId: number, userId: number, companyId: number) {
    return db.transaction(async (tx) => {
        const [updated] = await tx
            .update(products)
            .set({ is_active: false, updated_at: new Date(), updated_by: userId })
            .where(and(eq(products.id, productId), eq(products.company_id, companyId)))
            .returning();

        if (!updated) throw new DomainError('Producto no encontrado', 404);

        // Cascade is_active to ALL variants
        await tx.update(productVariants)
            .set({ is_active: false })
            .where(and(eq(productVariants.product_id, productId), eq(productVariants.company_id, companyId)));

        cacheService.invalidate(`products:c${companyId}:*`);
        broadcast('product:updated', { id: productId, is_active: false }, 'products');
        return { success: true };
    });
}

export async function restoreProduct(productId: number, userId: number, companyId: number) {
    return db.transaction(async (tx) => {
        const [updated] = await tx
            .update(products)
            .set({ is_active: true, updated_at: new Date(), updated_by: userId })
            .where(and(eq(products.id, productId), eq(products.company_id, companyId)))
            .returning();

        if (!updated) throw new DomainError('Producto no encontrado', 404);

        // Restore ALL variants (user can individually deactivate variants later)
        await tx.update(productVariants)
            .set({ is_active: true })
            .where(and(eq(productVariants.product_id, productId), eq(productVariants.company_id, companyId)));

        cacheService.invalidate(`products:c${companyId}:*`);
        broadcast('product:updated', { id: productId, is_active: true }, 'products');
        return { success: true };
    });
}

export async function hardDeleteProduct(productId: number, companyId: number) {
    // Auto-validate before deleting — prevents raw FK errors
    const refs = await checkProductReferences(productId, companyId);
    if (!refs.canDelete) {
        const details: string[] = [];
        if (refs.inventoryStock > 0) details.push(`stock: ${refs.inventoryStock}`);
        if (refs.inventoryMovements > 0) details.push(`movimientos: ${refs.inventoryMovements}`);
        if (refs.purchaseOrderItems > 0) details.push(`órdenes de compra: ${refs.purchaseOrderItems}`);
        if (refs.invoiceItems > 0) details.push(`facturas: ${refs.invoiceItems}`);
        if (refs.workOrderItems > 0) details.push(`órdenes de trabajo: ${refs.workOrderItems}`);
        if (refs.manufacturingOrders > 0) details.push(`órdenes de manufactura: ${refs.manufacturingOrders}`);
        if (refs.supplierProducts > 0) details.push(`proveedores: ${refs.supplierProducts}`);
        if (refs.materialRequestItems > 0) details.push(`solicitudes: ${refs.materialRequestItems}`);
        throw new DomainError(
            `No se puede eliminar: el producto tiene ${refs.total} referencia(s) en el sistema (${details.join(', ')})`,
            409
        );
    }

    // Fetch image URLs before deletion for R2 cleanup
    const productImages = await db
        .select({ image_urls: products.image_urls })
        .from(products)
        .where(and(eq(products.id, productId), eq(products.company_id, companyId)));
    
    const variantImages = await db
        .select({ image_urls: productVariants.image_urls })
        .from(productVariants)
        .where(eq(productVariants.product_id, productId));

    const [deleted] = await db
        .delete(products)
        .where(and(eq(products.id, productId), eq(products.company_id, companyId)))
        .returning();

    if (!deleted) throw new DomainError('Producto no encontrado', 404);

    // Deferred R2 cleanup (fire-and-forget)
    const allUrls: string[] = [];
    if (productImages[0]?.image_urls) {
        allUrls.push(...(productImages[0].image_urls as string[]));
    }
    for (const v of variantImages) {
        if (v.image_urls && Array.isArray(v.image_urls)) {
            allUrls.push(...(v.image_urls as string[]));
        }
    }
    if (allUrls.length > 0) {
        Promise.allSettled(
            allUrls.map(url => publicStorageService.deleteObject(url))
        ).catch(err => console.warn('[R2] Deferred product image cleanup failed:', err));
    }

    cacheService.invalidate(`products:c${companyId}:*`);
    broadcast('product:deleted', { id: productId }, 'products');
    return { success: true };
}

// =============================================================================
// Bulk Operations — with variant cascade
// =============================================================================

export async function bulkDeactivateProducts(ids: number[], userId: number, companyId: number) {
    await db.transaction(async (tx) => {
        await tx
            .update(products)
            .set({ is_active: false, updated_at: new Date(), updated_by: userId })
            .where(and(inArray(products.id, ids), eq(products.company_id, companyId)));

        // Cascade to variants
        await tx
            .update(productVariants)
            .set({ is_active: false })
            .where(and(inArray(productVariants.product_id, ids), eq(productVariants.company_id, companyId)));
    });

    cacheService.invalidate(`products:c${companyId}:*`);
    broadcast('product:updated', { ids, is_active: false }, 'products');
    return { affected: ids.length };
}

export async function bulkRestoreProducts(ids: number[], userId: number, companyId: number) {
    await db.transaction(async (tx) => {
        await tx
            .update(products)
            .set({ is_active: true, updated_at: new Date(), updated_by: userId })
            .where(and(inArray(products.id, ids), eq(products.company_id, companyId)));

        // Restore variants
        await tx
            .update(productVariants)
            .set({ is_active: true })
            .where(and(inArray(productVariants.product_id, ids), eq(productVariants.company_id, companyId)));
    });

    cacheService.invalidate(`products:c${companyId}:*`);
    broadcast('product:updated', { ids, is_active: true }, 'products');
    return { affected: ids.length };
}

// =============================================================================
// Reference Checks — Exhaustive (covers ALL 14 blocking FK tables)
// =============================================================================

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

/**
 * Check if a single variant has any transactional references.
 * Used by Smart Variant Sync to decide between hard-delete vs soft-deactivate.
 */
async function checkVariantReferences(tx: Tx, variantId: number): Promise<boolean> {
    const [result] = await tx
        .select({
            hasRefs: sql<boolean>`EXISTS(
                SELECT 1 FROM inventory_stock WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM inventory_movements WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM inventory_dimensional_items WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM purchase_order_items WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM invoice_items WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM manufacturing_orders WHERE output_variant_id = ${variantId}
                UNION ALL SELECT 1 FROM manufacturing_order_inputs WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM manufacturing_log WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM supplier_products WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM goods_receipt_items WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM material_request_items WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM material_request_dispatches WHERE variant_id = ${variantId}
                UNION ALL SELECT 1 FROM request_return_items WHERE variant_id = ${variantId}
            )`,
        })
        .from(sql`(SELECT 1) as dummy`);
    return result.hasRefs;
}

// =============================================================================
// SKU Auto-Generation — fixed lexicographic ordering
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

        // Find next sequential number from VARIANTS (where SKUs live now)
        // Uses numeric ordering via regex extraction to prevent lexicographic bugs
        // e.g. "PRD-099" vs "PRD-1000" — numeric sort gives correct max
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
// Variant Lookup by SKU/Barcode — for POS/Scanner workflows
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

