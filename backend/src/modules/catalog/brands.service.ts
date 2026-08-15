import { and, eq, ilike, or, asc, inArray, type AnyColumn, type SQL } from '@app/schema';
import { db, withTenantContext } from '../../core/db';
import { brands } from '@app/schema/tables';
import { DomainError } from '../../core/errors';
import { cacheService } from '../../core/cache';
import { broadcast } from '../../core/sse/sse';
import { CursorPaginator } from '../../core/db/paginator';

// =============================================================================
// Pagination Types
// =============================================================================

export interface BrandColumnFilters {
    isActive?: string[];
}

export interface BrandListFilters extends BrandColumnFilters {
    cursor?: string;
    limit?: number;
    search?: string;
    direction?: 'next' | 'prev' | 'first' | 'last';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
}


/** Whitelist of sortable columns */
export const SORTABLE_COLUMNS: Record<string, AnyColumn> = {
    id: brands.id,
    name: brands.name,
    website: brands.website,
    is_active: brands.is_active,
    created_at: brands.created_at,
};

// =============================================================================
// Brand Cursor Paginator
// =============================================================================

export const brandPaginator = new CursorPaginator<typeof brands, BrandColumnFilters>({
    table: brands,
    idColumn: brands.id,
    companyIdColumn: brands.company_id,
    sortableColumns: SORTABLE_COLUMNS,
    defaultSortBy: 'name',
    cacheNamespace: 'brands',
    ttl: 120,
    buildConditions: ({ companyId, search, filters }) => {
        const conditions: SQL[] = [eq(brands.company_id, companyId)];

        if (search) {
            const pattern = `%${search}%`;
            conditions.push(
                or(ilike(brands.name, pattern), ilike(brands.website, pattern))!
            );
        }

        if (filters?.isActive && filters.isActive.length > 0) {
            const boolValues = filters.isActive.map(v => v === 'true');
            if (boolValues.length === 1) {
                conditions.push(eq(brands.is_active, boolValues[0]));
            }
        } else {
            conditions.push(eq(brands.is_active, true));
        }

        return conditions;
    },
});

// =============================================================================
// Brands Service
// =============================================================================

export const brandsService = {
    /** Paginated list with cursor or offset pagination */
    async list(filters: BrandListFilters, companyId: number) {
        return withTenantContext({ companyId }, async () => {
            const { cursor, direction, limit, search, sortBy, sortOrder, page, ...columnFilters } = filters;
            return brandPaginator.paginate(
                { cursor, direction, limit, search, sortBy, sortOrder, page, filters: columnFilters },
                companyId
            );
        });
    },

    /** Simple list (all brands, for selectors/autocomplete) */
    async listAll(companyId: number) {
        return cacheService.getOrSet(`brands:c${companyId}:all`, async () => {
            return withTenantContext({ companyId }, async () => {
                return db.select().from(brands)
                    .where(and(eq(brands.company_id, companyId), eq(brands.is_active, true)))
                    .orderBy(asc(brands.name));
            });
        }, 3600);
    },

    async create(data: { name: string; website?: string }, companyId: number) {
        return withTenantContext({ companyId }, async () => {
            const [created] = await db.insert(brands).values({ ...data, company_id: companyId }).returning();
            await cacheService.invalidate(`brands:c${companyId}:*`);
            broadcast('catalog:brand:created', created, 'brands');
            return created;
        });
    },

    async update(id: number, data: Partial<{ name: string; website: string; is_active: boolean }>, companyId: number) {
        return withTenantContext({ companyId }, async () => {
            const [updated] = await db.update(brands).set(data)
                .where(and(eq(brands.id, id), eq(brands.company_id, companyId))).returning();
            if (!updated) throw new DomainError('Marca no encontrada', 404);
            await cacheService.invalidate(`brands:c${companyId}:*`);
            broadcast('catalog:brand:updated', updated, 'brands');
            return updated;
        });
    },

    async deactivate(id: number, companyId: number) {
        return withTenantContext({ companyId }, async () => {
            const [updated] = await db.update(brands).set({ is_active: false })
                .where(and(eq(brands.id, id), eq(brands.company_id, companyId))).returning();
            if (!updated) throw new DomainError('Marca no encontrada', 404);
            await cacheService.invalidate(`brands:c${companyId}:*`);
            broadcast('catalog:brand:updated', updated, 'brands');
            return updated;
        });
    },

    async restore(id: number, companyId: number) {
        return withTenantContext({ companyId }, async () => {
            const [updated] = await db.update(brands).set({ is_active: true })
                .where(and(eq(brands.id, id), eq(brands.company_id, companyId))).returning();
            if (!updated) throw new DomainError('Marca no encontrada', 404);
            await cacheService.invalidate(`brands:c${companyId}:*`);
            broadcast('catalog:brand:updated', updated, 'brands');
            return updated;
        });
    },

    async bulkDeactivate(ids: number[], companyId: number) {
        if (ids.length === 0) return { success: true, count: 0 };
        return withTenantContext({ companyId }, async () => {
            const updated = await db.update(brands).set({ is_active: false })
                .where(and(eq(brands.company_id, companyId), eq(brands.is_active, true), inArray(brands.id, ids)))
                .returning();
            await cacheService.invalidate(`brands:c${companyId}:*`);
            for (const b of updated) broadcast('catalog:brand:updated', b, 'brands');
            return { success: true, count: updated.length };
        });
    },

    async bulkRestore(ids: number[], companyId: number) {
        if (ids.length === 0) return { success: true, count: 0 };
        return withTenantContext({ companyId }, async () => {
            const updated = await db.update(brands).set({ is_active: true })
                .where(and(eq(brands.company_id, companyId), eq(brands.is_active, false), inArray(brands.id, ids)))
                .returning();
            await cacheService.invalidate(`brands:c${companyId}:*`);
            for (const b of updated) broadcast('catalog:brand:updated', b, 'brands');
            return { success: true, count: updated.length };
        });
    },
};
