import { and, eq, ilike, or, asc, sql, inArray, type AnyColumn, type SQL } from '@app/schema';
import { db, withTenantContext } from '../../core/db';
import { brands, products } from '@app/schema/tables';
import type { BrandBodyType, BrandUpdateType, BrandItem, BrandFilters, BrandReferencesType } from '@app/schema/dto';
import { DomainError } from '../../core/errors';
import { cacheService } from '../../core/cache';
import { broadcastToTenant } from '../../core/sse/events';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { CursorPaginator, type PaginatedResult } from '../../core/db/paginator';

// =============================================================================
// Pagination Types
// =============================================================================

export interface BrandColumnFilters {
    isActive?: string[];
}

export type BrandListFilters = BrandFilters;

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

        if (search && search.trim()) {
            const pattern = `%${search.trim()}%`;
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
    async list(filters: BrandListFilters, companyId: number): Promise<PaginatedResult<BrandItem>> {
        const { cursor, direction, limit, search, sortBy, sortOrder, page, ...columnFilters } = filters;
        return brandPaginator.paginate<BrandItem>(
            { cursor, direction, limit, search, sortBy, sortOrder, page, filters: columnFilters },
            companyId
        );
    },

    /** Get single brand by ID (regardless of active status) */
    async getById(id: number, companyId: number): Promise<BrandItem> {
        const [brand] = await db.select().from(brands)
            .where(and(eq(brands.id, id), eq(brands.company_id, companyId)));
        if (!brand) throw new DomainError('Marca no encontrada', 404);
        return brand;
    },

    /** Simple list (all active brands, for selectors/autocomplete) */
    async listAll(companyId: number): Promise<BrandItem[]> {
        return cacheService.getOrSet(`brands:c${companyId}:all`, async () => {
            return db.select().from(brands)
                .where(and(eq(brands.company_id, companyId), eq(brands.is_active, true)))
                .orderBy(asc(brands.name));
        }, 3600);
    },

    async create(data: BrandBodyType, companyId: number, clientId?: string): Promise<BrandItem> {
        return withTenantContext({ companyId }, async () => {
            const [created] = await db.insert(brands).values({
                ...data,
                company_id: companyId,
            }).returning();

            await cacheService.invalidate(`brands:c${companyId}:*`);
            broadcastToTenant(
                companyId,
                RealtimeEvents.ENTITY.CREATED,
                { type: 'brand', id: created.id, entity: created, clientId },
                RealtimeEvents.ROOMS.BRANDS
            );
            return created;
        });
    },

    async update(id: number, data: BrandUpdateType, companyId: number, clientId?: string): Promise<BrandItem> {
        return withTenantContext({ companyId }, async () => {
            const [updated] = await db.update(brands)
                .set({ ...data, updated_at: new Date() })
                .where(and(eq(brands.id, id), eq(brands.company_id, companyId)))
                .returning();

            if (!updated) throw new DomainError('Marca no encontrada', 404);
            await cacheService.invalidate(`brands:c${companyId}:*`);
            broadcastToTenant(
                companyId,
                RealtimeEvents.ENTITY.UPDATED,
                { type: 'brand', id: updated.id, entity: updated, clientId },
                RealtimeEvents.ROOMS.BRANDS
            );
            return updated;
        });
    },

    async deactivate(id: number, companyId: number, clientId?: string): Promise<BrandItem> {
        return withTenantContext({ companyId }, async () => {
            const [updated] = await db.update(brands)
                .set({ is_active: false, updated_at: new Date() })
                .where(and(eq(brands.id, id), eq(brands.company_id, companyId)))
                .returning();

            if (!updated) throw new DomainError('Marca no encontrada', 404);
            await cacheService.invalidate(`brands:c${companyId}:*`);
            broadcastToTenant(
                companyId,
                RealtimeEvents.ENTITY.UPDATED,
                { type: 'brand', id: updated.id, entity: updated, clientId },
                RealtimeEvents.ROOMS.BRANDS
            );
            return updated;
        });
    },

    async restore(id: number, companyId: number, clientId?: string): Promise<BrandItem> {
        return withTenantContext({ companyId }, async () => {
            const [updated] = await db.update(brands)
                .set({ is_active: true, updated_at: new Date() })
                .where(and(eq(brands.id, id), eq(brands.company_id, companyId)))
                .returning();

            if (!updated) throw new DomainError('Marca no encontrada', 404);
            await cacheService.invalidate(`brands:c${companyId}:*`);
            broadcastToTenant(
                companyId,
                RealtimeEvents.ENTITY.UPDATED,
                { type: 'brand', id: updated.id, entity: updated, clientId },
                RealtimeEvents.ROOMS.BRANDS
            );
            return updated;
        });
    },

    /** Check references to a brand across products */
    async checkReferences(id: number, companyId: number): Promise<BrandReferencesType> {
        const [brand] = await db.select({ id: brands.id }).from(brands)
            .where(and(eq(brands.id, id), eq(brands.company_id, companyId)));
        if (!brand) throw new DomainError('Marca no encontrada', 404);

        const [{ count }] = await db
            .select({ count: sql<number>`count(*)`.mapWith(Number) })
            .from(products)
            .where(and(eq(products.brand_id, id), eq(products.company_id, companyId)));

        return { products: count, total: count };
    },

    /** Hard delete a brand — blocks if references exist */
    async hardDelete(id: number, companyId: number, clientId?: string): Promise<{ success: boolean }> {
        const [existing] = await db.select().from(brands)
            .where(and(eq(brands.id, id), eq(brands.company_id, companyId)));
        if (!existing) throw new DomainError('Marca no encontrada', 404);

        const refs = await brandsService.checkReferences(id, companyId);
        if (refs.total > 0) {
            throw new DomainError('No se puede eliminar: la marca tiene productos vinculados', 409);
        }

        await db.delete(brands).where(and(eq(brands.id, id), eq(brands.company_id, companyId)));
        await cacheService.invalidate(`brands:c${companyId}:*`);
        broadcastToTenant(
            companyId,
            RealtimeEvents.ENTITY.DELETED,
            { type: 'brand', id, clientId },
            RealtimeEvents.ROOMS.BRANDS
        );
        return { success: true };
    },

    async bulkDeactivate(ids: number[], companyId: number, clientId?: string): Promise<{ success: boolean; count: number }> {
        if (ids.length === 0) return { success: true, count: 0 };
        return withTenantContext({ companyId }, async () => {
            const updated = await db.update(brands)
                .set({ is_active: false, updated_at: new Date() })
                .where(and(eq(brands.company_id, companyId), eq(brands.is_active, true), inArray(brands.id, ids)))
                .returning();

            await cacheService.invalidate(`brands:c${companyId}:*`);
            for (const b of updated) {
                broadcastToTenant(
                    companyId,
                    RealtimeEvents.ENTITY.UPDATED,
                    { type: 'brand', id: b.id, entity: b, clientId },
                    RealtimeEvents.ROOMS.BRANDS
                );
            }
            return { success: true, count: updated.length };
        });
    },

    async bulkRestore(ids: number[], companyId: number, clientId?: string): Promise<{ success: boolean; count: number }> {
        if (ids.length === 0) return { success: true, count: 0 };
        return withTenantContext({ companyId }, async () => {
            const updated = await db.update(brands)
                .set({ is_active: true, updated_at: new Date() })
                .where(and(eq(brands.company_id, companyId), eq(brands.is_active, false), inArray(brands.id, ids)))
                .returning();

            await cacheService.invalidate(`brands:c${companyId}:*`);
            for (const b of updated) {
                broadcastToTenant(
                    companyId,
                    RealtimeEvents.ENTITY.UPDATED,
                    { type: 'brand', id: b.id, entity: b, clientId },
                    RealtimeEvents.ROOMS.BRANDS
                );
            }
            return { success: true, count: updated.length };
        });
    },
};
