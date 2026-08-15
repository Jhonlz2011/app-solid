import { and, eq, or, sql, asc, desc, isNull } from '@app/schema';
import { db } from '../../core/db';
import { uom } from '@app/schema/tables';
import type { UomGroup } from '@app/schema/enums';
import { DomainError } from '../../core/errors';
import { cacheService } from '../../core/cache';
import { broadcast } from '../../core/sse/sse';
import { RealtimeEvents } from '@app/schema/realtime-events';
import type { UomItem, UomPayload, UomUpdatePayload, UomReferences } from '@app/schema/dto';

// =============================================================================
// UOM Service — Tenant-Aware with System Guard
// =============================================================================

export const uomService = {
    /**
     * Simple catalog list (all UOMs).
     * Returns system + tenant's own UOMs, both active and inactive.
     */
    async listUoms(companyId: number): Promise<UomItem[]> {
        return cacheService.getOrSet(`uom:c${companyId}:catalog`, async () => {
            return db.select().from(uom)
                .where(or(isNull(uom.company_id), eq(uom.company_id, companyId))!)
                .orderBy(desc(uom.is_system), asc(uom.code));
        }, 3600);
    },

    /**
     * Get a single UOM by id (accessible if system UOM or owned by company).
     */
    async getById(id: number, companyId: number): Promise<UomItem> {
        const [item] = await db.select().from(uom)
            .where(and(
                eq(uom.id, id),
                or(isNull(uom.company_id), eq(uom.company_id, companyId))!
            ));
        if (!item) throw new DomainError('Unidad no encontrada', 404);
        return item;
    },

    /**
     * Create a tenant-scoped UOM.
     * Always sets company_id and is_system = false.
     */
    async create(data: UomPayload, companyId: number, clientId?: string): Promise<UomItem> {
        const codeUpper = data.code.toUpperCase();

        // Check global uniqueness: system UOM codes can't be shadowed
        const existingSystem = await db.select().from(uom)
            .where(and(eq(uom.code, codeUpper), isNull(uom.company_id)));
        if (existingSystem.length) throw new DomainError('Este código ya existe como unidad del sistema', 409);

        // Check tenant uniqueness
        const existingTenant = await db.select().from(uom)
            .where(and(eq(uom.code, codeUpper), eq(uom.company_id, companyId)));
        if (existingTenant.length) throw new DomainError('Ya existe una unidad con este código en tu empresa', 409);

        const [created] = await db.insert(uom).values({
            code: codeUpper,
            name: data.name,
            uom_group: data.uom_group,
            base_factor: data.base_factor ? String(data.base_factor) : null,
            company_id: companyId,
            is_system: false,
        }).returning();

        await cacheService.invalidate(`uom:c${companyId}:*`);
        broadcast(
            RealtimeEvents.ENTITY.CREATED,
            { type: 'uom', id: created.id, entity: created, clientId },
            RealtimeEvents.ROOMS.UOM
        );
        return created;
    },

    /**
     * Update a UOM by id.
     * BLOCKS updates to system UOMs (is_system = true).
     * Only allows updates to the tenant's own UOMs.
     */
    async update(id: number, data: UomUpdatePayload, companyId: number, clientId?: string): Promise<UomItem> {
        // Fetch the UOM first to check ownership and system flag
        const [existing] = await db.select().from(uom).where(eq(uom.id, id));
        if (!existing) throw new DomainError('Unidad no encontrada', 404);
        if (existing.is_system) throw new DomainError('Las unidades del sistema no pueden ser modificadas', 403);
        if (existing.company_id !== companyId) throw new DomainError('No tienes permisos para modificar esta unidad', 403);

        const updateData: Record<string, unknown> = { updated_at: new Date() };
        if (data.name !== undefined) updateData.name = data.name;
        if (data.uom_group !== undefined) updateData.uom_group = data.uom_group;
        if (data.base_factor !== undefined) updateData.base_factor = data.base_factor ? String(data.base_factor) : null;
        if (data.is_active !== undefined) updateData.is_active = data.is_active;

        const [updated] = await db.update(uom)
            .set(updateData as any)
            .where(and(eq(uom.id, id), eq(uom.company_id, companyId)))
            .returning();

        await cacheService.invalidate(`uom:c${companyId}:*`);
        broadcast(
            RealtimeEvents.ENTITY.UPDATED,
            { type: 'uom', id: updated.id, entity: updated, clientId },
            RealtimeEvents.ROOMS.UOM
        );
        return updated;
    },

    /**
     * Soft delete (deactivate) — sets is_active = false.
     * BLOCKS deactivation of system UOMs.
     */
    async deactivate(id: number, companyId: number, clientId?: string): Promise<UomItem> {
        const [existing] = await db.select().from(uom).where(eq(uom.id, id));
        if (!existing) throw new DomainError('Unidad no encontrada', 404);
        if (existing.is_system) throw new DomainError('Las unidades del sistema no pueden ser desactivadas', 403);
        if (existing.company_id !== companyId) throw new DomainError('No tienes permisos', 403);

        const [updated] = await db.update(uom)
            .set({ is_active: false, updated_at: new Date() })
            .where(and(eq(uom.id, id), eq(uom.company_id, companyId)))
            .returning();

        await cacheService.invalidate(`uom:c${companyId}:*`);
        broadcast(
            RealtimeEvents.ENTITY.UPDATED,
            { type: 'uom', id: updated.id, entity: updated, clientId },
            RealtimeEvents.ROOMS.UOM
        );
        return updated;
    },

    /**
     * Restore a soft-deleted UOM back to active.
     */
    async restore(id: number, companyId: number, clientId?: string): Promise<UomItem> {
        const [existing] = await db.select().from(uom).where(eq(uom.id, id));
        if (!existing) throw new DomainError('Unidad no encontrada', 404);
        if (existing.is_system) throw new DomainError('Las unidades del sistema no pueden ser modificadas', 403);
        if (existing.company_id !== companyId) throw new DomainError('No tienes permisos', 403);

        const [updated] = await db.update(uom)
            .set({ is_active: true, updated_at: new Date() })
            .where(and(eq(uom.id, id), eq(uom.company_id, companyId)))
            .returning();

        await cacheService.invalidate(`uom:c${companyId}:*`);
        broadcast(
            RealtimeEvents.ENTITY.UPDATED,
            { type: 'uom', id: updated.id, entity: updated, clientId },
            RealtimeEvents.ROOMS.UOM
        );
        return updated;
    },

    /**
     * Check references to a UOM across dependent tables.
     * Used by frontend to warn before hard delete.
     *
     * Actual table/column mapping (from Drizzle schema):
     *   products.uom_inventory_id       → products
     *   product_variants.sale_uom_id    → variants
     *   supplier_products.purchase_uom  → supplierProducts
     *   product_uom_conversions.from_uom / to_uom → conversions
     *   work_order_items.requested_uom  → workOrderItems
     *   purchase_quote_items.purchase_uom → quoteItems
     */
    async checkReferences(id: number, companyId?: number): Promise<UomReferences> {
        /** Safe count — returns 0 if the table doesn't exist yet (unmigrated). */
        const countQuery = async (query: ReturnType<typeof db.select>): Promise<number> => {
            try {
                const result = await query;
                return (result as any)[0]?.count ?? 0;
            } catch {
                return 0; // table not migrated yet
            }
        };

        const companyFilter = companyId ? sql` AND company_id = ${companyId}` : sql``;

        const [products, variants, supplierProducts, conversions, workOrderItems, quoteItems] = await Promise.all([
            countQuery(db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(sql`products`).where(sql`uom_inventory_id = ${id}${companyFilter}`)),
            countQuery(db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(sql`product_variants`).where(sql`sale_uom_id = ${id}${companyFilter}`)),
            countQuery(db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(sql`supplier_products`).where(sql`purchase_uom = ${id}${companyFilter}`)),
            countQuery(db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(sql`product_uom_conversions`).where(sql`from_uom = ${id} OR to_uom = ${id}`)),
            countQuery(db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(sql`work_order_items`).where(sql`requested_uom = ${id}${companyFilter}`)),
            countQuery(db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(sql`purchase_quote_items`).where(sql`purchase_uom = ${id}${companyFilter}`)),
        ]);

        const refs = { products, variants, supplierProducts, conversions, workOrderItems, quoteItems };
        return {
            ...refs,
            total: products + variants + supplierProducts + conversions + workOrderItems + quoteItems,
        };
    },

    /**
     * Hard delete a tenant UOM by id.
     * BLOCKS deletion of system UOMs and UOMs with references.
     */
    async hardDelete(id: number, companyId: number, clientId?: string): Promise<{ success: boolean }> {
        const [existing] = await db.select().from(uom).where(eq(uom.id, id));
        if (!existing) throw new DomainError('Unidad no encontrada', 404);
        if (existing.is_system) throw new DomainError('Las unidades del sistema no pueden ser eliminadas', 403);
        if (existing.company_id !== companyId) throw new DomainError('No tienes permisos para eliminar esta unidad', 403);

        // Check references
        const refs = await uomService.checkReferences(id, companyId);
        if (refs.total > 0) throw new DomainError('No se puede eliminar: la unidad tiene registros vinculados', 409);

        await db.delete(uom).where(and(eq(uom.id, id), eq(uom.company_id, companyId)));
        await cacheService.invalidate(`uom:c${companyId}:*`);
        broadcast(
            RealtimeEvents.ENTITY.DELETED,
            { type: 'uom', id, clientId },
            RealtimeEvents.ROOMS.UOM
        );
        return { success: true };
    },
};
