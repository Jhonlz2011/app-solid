import { and, eq, or, sql, asc, desc, isNull } from '@app/schema';
import { db } from '../db';
import { uom } from '@app/schema/tables';
import type { UomGroup } from '@app/schema/enums';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/sse';
import { RealtimeEvents } from '@app/schema/realtime-events';

// =============================================================================
// UOM Service — Tenant-Aware with System Guard
// =============================================================================

export const uomService = {
    /**
     * Simple catalog list (all UOMs).
     * Returns system + tenant's own UOMs, both active and inactive.
     */
    async listUoms(companyId: number) {
        return cacheService.getOrSet(`uom:c${companyId}:catalog`, async () => {
            return db.select().from(uom)
                .where(or(isNull(uom.company_id), eq(uom.company_id, companyId))!)
                .orderBy(desc(uom.is_system), asc(uom.code));
        }, 3600);
    },

    /**
     * Create a tenant-scoped UOM.
     * Always sets company_id and is_system = false.
     */
    async create(data: { code: string; name: string; uom_group: string; base_factor?: string }, companyId: number) {
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
            uom_group: data.uom_group as UomGroup,
            base_factor: data.base_factor,
            company_id: companyId,
            is_system: false,
        }).returning();

        await cacheService.invalidate('uom:*');
        broadcast(RealtimeEvents.ENTITY.CREATED, { id: created.id, entity: created }, 'uom');
        return created;
    },

    /**
     * Update a UOM by id.
     * BLOCKS updates to system UOMs (is_system = true).
     * Only allows updates to the tenant's own UOMs.
     */
    async update(id: number, data: Partial<{ name: string; uom_group: string; base_factor: string; is_active: boolean }>, companyId: number) {
        // Fetch the UOM first to check ownership and system flag
        const [existing] = await db.select().from(uom).where(eq(uom.id, id));
        if (!existing) throw new DomainError('Unidad no encontrada', 404);
        if (existing.is_system) throw new DomainError('Las unidades del sistema no pueden ser modificadas', 403);
        if (existing.company_id !== companyId) throw new DomainError('No tienes permisos para modificar esta unidad', 403);

        const updateData: Record<string, unknown> = { ...data, updated_at: new Date() };
        if (data.uom_group) updateData.uom_group = data.uom_group as UomGroup;

        const [updated] = await db.update(uom)
            .set(updateData as any)
            .where(eq(uom.id, id))
            .returning();

        await cacheService.invalidate('uom:*');
        broadcast(RealtimeEvents.ENTITY.UPDATED, { id: updated.id, entity: updated }, 'uom');
        return updated;
    },

    /**
     * Soft delete (deactivate) — sets is_active = false.
     * BLOCKS deactivation of system UOMs.
     */
    async deactivate(id: number, companyId: number) {
        const [existing] = await db.select().from(uom).where(eq(uom.id, id));
        if (!existing) throw new DomainError('Unidad no encontrada', 404);
        if (existing.is_system) throw new DomainError('Las unidades del sistema no pueden ser desactivadas', 403);
        if (existing.company_id !== companyId) throw new DomainError('No tienes permisos', 403);

        const [updated] = await db.update(uom)
            .set({ is_active: false, updated_at: new Date() })
            .where(eq(uom.id, id))
            .returning();

        await cacheService.invalidate('uom:*');
        broadcast(RealtimeEvents.ENTITY.UPDATED, { id: updated.id, entity: updated }, 'uom');
        return updated;
    },

    /**
     * Restore a soft-deleted UOM back to active.
     */
    async restore(id: number, companyId: number) {
        const [existing] = await db.select().from(uom).where(eq(uom.id, id));
        if (!existing) throw new DomainError('Unidad no encontrada', 404);
        if (existing.is_system) throw new DomainError('Las unidades del sistema no pueden ser modificadas', 403);
        if (existing.company_id !== companyId) throw new DomainError('No tienes permisos', 403);

        const [updated] = await db.update(uom)
            .set({ is_active: true, updated_at: new Date() })
            .where(eq(uom.id, id))
            .returning();

        await cacheService.invalidate('uom:*');
        broadcast(RealtimeEvents.ENTITY.UPDATED, { id: updated.id, entity: updated }, 'uom');
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
    async checkReferences(id: number) {
        /** Safe count — returns 0 if the table doesn't exist yet (unmigrated). */
        const countQuery = async (query: ReturnType<typeof db.select>): Promise<number> => {
            try {
                const result = await query;
                return (result as any)[0]?.count ?? 0;
            } catch {
                return 0; // table not migrated yet
            }
        };

        const [products, variants, supplierProducts, conversions, workOrderItems, quoteItems] = await Promise.all([
            countQuery(db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(sql`products`).where(sql`uom_inventory_id = ${id}`)),
            countQuery(db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(sql`product_variants`).where(sql`sale_uom_id = ${id}`)),
            countQuery(db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(sql`supplier_products`).where(sql`purchase_uom = ${id}`)),
            countQuery(db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(sql`product_uom_conversions`).where(sql`from_uom = ${id} OR to_uom = ${id}`)),
            countQuery(db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(sql`work_order_items`).where(sql`requested_uom = ${id}`)),
            countQuery(db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(sql`purchase_quote_items`).where(sql`purchase_uom = ${id}`)),
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
    async hardDelete(id: number, companyId: number) {
        const [existing] = await db.select().from(uom).where(eq(uom.id, id));
        if (!existing) throw new DomainError('Unidad no encontrada', 404);
        if (existing.is_system) throw new DomainError('Las unidades del sistema no pueden ser eliminadas', 403);
        if (existing.company_id !== companyId) throw new DomainError('No tienes permisos para eliminar esta unidad', 403);

        // Check references
        const refs = await uomService.checkReferences(id);
        if (refs.total > 0) throw new DomainError('No se puede eliminar: la unidad tiene registros vinculados', 409);

        await db.delete(uom).where(eq(uom.id, id));
        await cacheService.invalidate('uom:*');
        broadcast(RealtimeEvents.ENTITY.DELETED, { id }, 'uom');
        return { success: true };
    },
};
