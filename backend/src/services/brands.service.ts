import { and, eq, ilike, or, sql, lt, gt, asc, desc, inArray, type AnyColumn } from '@app/schema';
import { db } from '../db';
import { brands } from '@app/schema/tables';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/sse';
import { createHash } from 'crypto';

// =============================================================================
// Pagination Types
// =============================================================================

interface CursorData { id: number; }

interface BrandColumnFilters {
    isActive?: string[];
}

interface BrandListFilters extends BrandColumnFilters {
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
    id: brands.id,
    name: brands.name,
    website: brands.website,
    is_active: brands.is_active,
    created_at: brands.created_at,
};

// =============================================================================
// Cursor Helpers
// =============================================================================

function encodeCursor(id: number): string {
    return Buffer.from(JSON.stringify({ id })).toString('base64url');
}

function decodeCursor(cursor: string): CursorData | null {
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

function buildWhereConditions(companyId: number, filters: BrandListFilters) {
    const conditions = [eq(brands.company_id, companyId)];

    if (filters.search) {
        const pattern = `%${filters.search}%`;
        conditions.push(
            or(ilike(brands.name, pattern), ilike(brands.website, pattern))!
        );
    }

    if (filters.isActive && filters.isActive.length > 0) {
        const boolValues = filters.isActive.map(v => v === 'true');
        if (boolValues.length === 1) {
            conditions.push(eq(brands.is_active, boolValues[0]));
        }
    } else {
        conditions.push(eq(brands.is_active, true));
    }

    return conditions;
}

// =============================================================================
// Brands Service
// =============================================================================

export const brandsService = {
    /** Paginated list with cursor or offset pagination */
    async list(filters: BrandListFilters, companyId: number) {
        const { sortBy } = filters;
        if (sortBy && sortBy !== 'id' && SORTABLE_COLUMNS[sortBy]) {
            return listBrandsSorted(filters, companyId);
        }
        return listBrandsCursor(filters, companyId);
    },

    /** Simple list (all brands, for selectors/autocomplete) */
    async listAll(companyId: number) {
        return cacheService.getOrSet(`brands:c${companyId}:all`, async () => {
            return db.select().from(brands)
                .where(and(eq(brands.company_id, companyId), eq(brands.is_active, true)))
                .orderBy(asc(brands.name));
        }, 3600);
    },

    async create(data: { name: string; website?: string }, companyId: number) {
        const [created] = await db.insert(brands).values({ ...data, company_id: companyId }).returning();
        await cacheService.invalidate(`brands:c${companyId}:*`);
        broadcast('catalog:brand:created', created, 'brands');
        return created;
    },

    async update(id: number, data: Partial<{ name: string; website: string; is_active: boolean }>, companyId: number) {
        const [updated] = await db.update(brands).set(data)
            .where(and(eq(brands.id, id), eq(brands.company_id, companyId))).returning();
        if (!updated) throw new DomainError('Marca no encontrada', 404);
        await cacheService.invalidate(`brands:c${companyId}:*`);
        broadcast('catalog:brand:updated', updated, 'brands');
        return updated;
    },

    async deactivate(id: number, companyId: number) {
        const [updated] = await db.update(brands).set({ is_active: false })
            .where(and(eq(brands.id, id), eq(brands.company_id, companyId))).returning();
        if (!updated) throw new DomainError('Marca no encontrada', 404);
        await cacheService.invalidate(`brands:c${companyId}:*`);
        broadcast('catalog:brand:updated', updated, 'brands');
        return updated;
    },

    async restore(id: number, companyId: number) {
        const [updated] = await db.update(brands).set({ is_active: true })
            .where(and(eq(brands.id, id), eq(brands.company_id, companyId))).returning();
        if (!updated) throw new DomainError('Marca no encontrada', 404);
        await cacheService.invalidate(`brands:c${companyId}:*`);
        broadcast('catalog:brand:updated', updated, 'brands');
        return updated;
    },

    async bulkDeactivate(ids: number[], companyId: number) {
        if (ids.length === 0) return { success: true, count: 0 };
        const updated = await db.update(brands).set({ is_active: false })
            .where(and(eq(brands.company_id, companyId), eq(brands.is_active, true), inArray(brands.id, ids)))
            .returning();
        await cacheService.invalidate(`brands:c${companyId}:*`);
        for (const b of updated) broadcast('catalog:brand:updated', b, 'brands');
        return { success: true, count: updated.length };
    },

    async bulkRestore(ids: number[], companyId: number) {
        if (ids.length === 0) return { success: true, count: 0 };
        const updated = await db.update(brands).set({ is_active: true })
            .where(and(eq(brands.company_id, companyId), eq(brands.is_active, false), inArray(brands.id, ids)))
            .returning();
        await cacheService.invalidate(`brands:c${companyId}:*`);
        for (const b of updated) broadcast('catalog:brand:updated', b, 'brands');
        return { success: true, count: updated.length };
    },
};

// =============================================================================
// Strategy 1: Keyset Cursor Pagination (default, sort by id)
// =============================================================================

async function listBrandsCursor(filters: BrandListFilters, companyId: number) {
    const { cursor, limit: limitRaw = 25, direction = 'first' } = filters;
    const limit = Number(limitRaw);
    const cacheKey = `brands:c${companyId}:list:${hashKey({ cursor, limit, direction, search: filters.search, isActive: filters.isActive })}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const conditions = buildWhereConditions(companyId, filters);
        const total = await getCachedTotal(companyId, filters);
        const { minId, maxId } = await getCachedBounds(companyId, filters);

        let effectiveLimit = limit;
        if (direction === 'last') {
            const remainder = total % limit;
            effectiveLimit = remainder === 0 ? limit : remainder;
        }

        const cursorData = cursor ? decodeCursor(cursor) : null;
        if (cursorData) {
            if (direction === 'next') conditions.push(lt(brands.id, cursorData.id));
            else if (direction === 'prev') conditions.push(gt(brands.id, cursorData.id));
        }

        const fetchLimit = effectiveLimit + 1;
        const isDescending = direction === 'first' || direction === 'next';

        let data = await db.select().from(brands)
            .where(and(...conditions))
            .limit(fetchLimit)
            .orderBy(isDescending ? desc(brands.id) : asc(brands.id));

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
// Strategy 2: Offset Pagination with Deferred Join (custom sort)
// =============================================================================

async function listBrandsSorted(filters: BrandListFilters, companyId: number) {
    const { limit: limitRaw = 25, sortBy = 'name', sortOrder = 'asc', page: pageRaw = 1 } = filters;
    const limit = Number(limitRaw);
    const page = Math.max(1, Number(pageRaw));
    const offset = (page - 1) * limit;
    const cacheKey = `brands:c${companyId}:sorted:${hashKey({ limit, sortBy, sortOrder, page, search: filters.search, isActive: filters.isActive })}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const conditions = buildWhereConditions(companyId, filters);
        const total = await getCachedTotal(companyId, filters);
        const pageCount = Math.ceil(total / limit);

        const sortColumn = SORTABLE_COLUMNS[sortBy]!;
        const orderFn = sortOrder === 'desc' ? desc : asc;
        const orderClauses = [orderFn(sortColumn), orderFn(brands.id)];

        const idRows = await db.select({ id: brands.id }).from(brands)
            .where(and(...conditions)).orderBy(...orderClauses).limit(limit).offset(offset);

        if (idRows.length === 0) {
            return { data: [], meta: { nextCursor: null, prevCursor: null, hasNextPage: false, hasPrevPage: false, total, page, pageCount } as PaginationMeta };
        }

        const ids = idRows.map(r => r.id);
        const rows = await db.select().from(brands).where(inArray(brands.id, ids));
        const idOrder = new Map(ids.map((id, i) => [id, i]));
        const data = rows.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

        return {
            data,
            meta: { nextCursor: null, prevCursor: null, hasNextPage: page < pageCount, hasPrevPage: page > 1, total, page, pageCount } as PaginationMeta,
        };
    }, 120);
}

// =============================================================================
// Shared Cached Helpers
// =============================================================================

async function getCachedTotal(companyId: number, filters: BrandListFilters) {
    const cacheKey = `brands:c${companyId}:total:${hashKey({ search: filters.search || 'all', isActive: filters.isActive })}`;
    return cacheService.getOrSet(cacheKey, async () => {
        const conditions = buildWhereConditions(companyId, filters);
        const [{ count }] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(brands).where(and(...conditions));
        return count;
    }, 120);
}

async function getCachedBounds(companyId: number, filters: BrandListFilters) {
    const cacheKey = `brands:c${companyId}:bounds:${hashKey({ search: filters.search || 'all', isActive: filters.isActive })}`;
    return cacheService.getOrSet(cacheKey, async () => {
        const conditions = buildWhereConditions(companyId, filters);
        const [result] = await db.select({
            minId: sql<number>`min(${brands.id})`.mapWith(Number),
            maxId: sql<number>`max(${brands.id})`.mapWith(Number),
        }).from(brands).where(and(...conditions));
        return result || { minId: 0, maxId: 0 };
    }, 120);
}
