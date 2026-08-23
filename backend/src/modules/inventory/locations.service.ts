import { eq, asc, sql, and, inArray } from '@app/schema';
import { db } from '../../core/db';
import { warehouses, warehouseLocations } from '@app/schema/tables';
import { DomainError } from '../../core/errors';
import { cacheService } from '../../core/cache/cache.service';
import { broadcast } from '../../core/sse/events';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { withAuditTransaction, type AuditContext } from '../audit/audit.service';
import type {
    LocationItem,
    LocationBodyType,
    LocationUpdateType,
    LocationReferences,
} from '@app/schema/dto';

// =============================================================================
// LOCATIONS SERVICE — Warehouse Locations CRUD with Hierarchy (Multi-tenant)
// =============================================================================

function locationCacheKey(companyId: number, warehouseId?: number) {
    return warehouseId ? `locations:c${companyId}:wh:${warehouseId}` : `locations:c${companyId}:all`;
}

async function invalidateAll(companyId: number) {
    await cacheService.invalidate(`locations:c${companyId}:*`);
}

export const locationsService = {
    /**
     * List all locations as flat array (frontend builds tree via buildSubRows).
     * Scoped by company_id. Ordered by path for consistent tree rendering.
     */
    async list(companyId: number, warehouseId?: number): Promise<LocationItem[]> {
        const key = locationCacheKey(companyId, warehouseId);
        return cacheService.getOrSet(key, async () => {
            const conditions = [eq(warehouseLocations.company_id, companyId)];
            if (warehouseId) {
                conditions.push(eq(warehouseLocations.warehouse_id, warehouseId));
            }

            return db
                .select({
                    id: warehouseLocations.id,
                    company_id: warehouseLocations.company_id,
                    warehouse_id: warehouseLocations.warehouse_id,
                    parent_id: warehouseLocations.parent_id,
                    name: warehouseLocations.name,
                    path: warehouseLocations.path,
                    type: warehouseLocations.type,
                    depth: warehouseLocations.depth,
                    is_active: warehouseLocations.is_active,
                    // Joined warehouse info
                    warehouse_name: warehouses.name,
                    warehouse_code: warehouses.code,
                    // Subquery to count distinct products in stock at this location
                    product_count: sql<number>`COALESCE((
                        SELECT COUNT(DISTINCT pv.product_id)::int 
                        FROM inventory_stock IS_STOCK
                        JOIN product_variants pv ON pv.id = IS_STOCK.variant_id
                        WHERE IS_STOCK.location_id = ${warehouseLocations.id}
                          AND IS_STOCK.quantity_on_hand > '0'::numeric
                    ), 0)`.as('product_count'),
                })
                .from(warehouseLocations)
                .leftJoin(warehouses, eq(warehouseLocations.warehouse_id, warehouses.id))
                .where(and(...conditions))
                .orderBy(asc(warehouseLocations.path));
        }, 3600);
    },

    /**
     * Get a single location by id (with joined warehouse information).
     */
    async getById(id: number, companyId: number): Promise<LocationItem> {
        const [location] = await db
            .select({
                id: warehouseLocations.id,
                company_id: warehouseLocations.company_id,
                warehouse_id: warehouseLocations.warehouse_id,
                parent_id: warehouseLocations.parent_id,
                name: warehouseLocations.name,
                path: warehouseLocations.path,
                type: warehouseLocations.type,
                depth: warehouseLocations.depth,
                is_active: warehouseLocations.is_active,
                warehouse_name: warehouses.name,
                warehouse_code: warehouses.code,
                product_count: sql<number>`COALESCE((
                    SELECT COUNT(DISTINCT pv.product_id)::int 
                    FROM inventory_stock IS_STOCK
                    JOIN product_variants pv ON pv.id = IS_STOCK.variant_id
                    WHERE IS_STOCK.location_id = ${warehouseLocations.id}
                      AND IS_STOCK.quantity_on_hand > '0'::numeric
                ), 0)`.as('product_count'),
            })
            .from(warehouseLocations)
            .leftJoin(warehouses, eq(warehouseLocations.warehouse_id, warehouses.id))
            .where(and(
                eq(warehouseLocations.id, id),
                eq(warehouseLocations.company_id, companyId)
            ));

        if (!location) throw new DomainError('Ubicación no encontrada', 404);
        return location;
    },

    /**
     * Create a new location with parent_id + derived ltree path.
     */
    async create(data: LocationBodyType, companyId: number, clientId?: string): Promise<LocationItem> {
        if (data.type && data.type !== 'INTERNAL' && data.type !== 'VIEW') {
            throw new DomainError('No está permitido crear ubicaciones virtuales manualmente', 400);
        }

        if (data.parent_id) {
            const [parent] = await db.select().from(warehouseLocations)
                .where(and(eq(warehouseLocations.id, data.parent_id), eq(warehouseLocations.company_id, companyId)));
            if (!parent) throw new DomainError('Ubicación padre no encontrada', 404);
        } else if (data.warehouse_id) {
            const [wh] = await db.select().from(warehouses)
                .where(and(eq(warehouses.id, data.warehouse_id), eq(warehouses.company_id, companyId)));
            if (!wh) throw new DomainError('Bodega no encontrada', 404);
        }

        // Just insert! The BEFORE trigger will automatically compute:
        // - path: parent.path + slugified(name)
        // - depth: parent.depth + 1
        // - warehouse_id: parent.warehouse_id (if not explicitly provided)
        const [created] = await db.insert(warehouseLocations).values({
            company_id: companyId,
            warehouse_id: data.warehouse_id ?? null,
            parent_id: data.parent_id ?? null,
            name: data.name,
            path: '', // Trigger overrides this
            type: data.type ?? 'INTERNAL',
            depth: 0, // Trigger overrides this
        }).returning();

        await invalidateAll(companyId);
        broadcast(
            RealtimeEvents.ENTITY.CREATED,
            { type: 'location', id: created.id, entity: created, clientId },
            RealtimeEvents.ROOMS.LOCATIONS
        );
        return this.getById(created.id, companyId);
    },

    /**
     * Update a location by id.
     * Delegates all cascading path and warehouse updates to PostgreSQL trigger.
     */
    async update(id: number, data: LocationUpdateType, companyId: number, clientId?: string): Promise<LocationItem> {
        const [existing] = await db.select().from(warehouseLocations)
            .where(and(eq(warehouseLocations.id, id), eq(warehouseLocations.company_id, companyId)));
        if (!existing) throw new DomainError('Ubicación no encontrada', 404);

        if (data.type && data.type !== 'INTERNAL' && data.type !== 'VIEW') {
            throw new DomainError('No está permitido cambiar el tipo de una ubicación a un tipo virtual', 400);
        }

        if (existing.type !== 'INTERNAL' && existing.type !== 'VIEW') {
            // It's a virtual location! Restrict modifications to maintain structural integrity.
            if (data.type !== undefined) {
                throw new DomainError('No se puede modificar el tipo de una ubicación del sistema', 400);
            }
            if (data.parent_id !== undefined && data.parent_id !== null) {
                throw new DomainError('Las ubicaciones del sistema deben ser ubicaciones raíz (sin padre)', 400);
            }
            if (data.warehouse_id !== undefined && data.warehouse_id !== null) {
                throw new DomainError('Las ubicaciones del sistema no pueden pertenecer a una bodega física', 400);
            }
        }

        // Circular check if parent_id is being updated
        if (data.parent_id !== undefined && data.parent_id !== existing.parent_id) {
            if (data.parent_id !== null) {
                const [newParent] = await db.select().from(warehouseLocations)
                    .where(and(eq(warehouseLocations.id, data.parent_id), eq(warehouseLocations.company_id, companyId)));
                if (!newParent) throw new DomainError('Ubicación padre no encontrada', 404);

                const isDescendant = newParent.path.startsWith(existing.path + '.');
                if (isDescendant || data.parent_id === id) {
                    throw new DomainError('Acción inválida: no puedes mover una ubicación dentro de sus propios descendientes', 400);
                }
            }
        }

        const [updated] = await db.update(warehouseLocations).set(data)
            .where(and(eq(warehouseLocations.id, id), eq(warehouseLocations.company_id, companyId))).returning();
        
        await invalidateAll(companyId);
        broadcast(
            RealtimeEvents.ENTITY.UPDATED,
            { type: 'location', id: updated.id, entity: updated, clientId },
            RealtimeEvents.ROOMS.LOCATIONS
        );
        return this.getById(updated.id, companyId);
    },

    /**
     * Reparent a location — move it under a new parent (or to root).
     * Validates against circular dependencies.
     * Relies on PostgreSQL trigger to cascade path and depth updates.
     */
    async reparent(id: number, newParentId: number | null, companyId: number, clientId?: string): Promise<LocationItem> {
        const [node] = await db.select().from(warehouseLocations)
            .where(and(eq(warehouseLocations.id, id), eq(warehouseLocations.company_id, companyId)));
        if (!node) throw new DomainError('Ubicación no encontrada', 404);

        // Skip if same parent
        if (node.parent_id === newParentId) return this.getById(id, companyId);

        if (newParentId !== null) {
            const [newParent] = await db.select().from(warehouseLocations)
                .where(and(eq(warehouseLocations.id, newParentId), eq(warehouseLocations.company_id, companyId)));
            if (!newParent) throw new DomainError('Ubicación padre no encontrada', 404);

            // Anti-circular: check the new parent is NOT a descendant of this node
            const isDescendant = newParent.path.startsWith(node.path + '.');
            if (isDescendant || newParentId === id) {
                throw new DomainError('Acción inválida: no puedes mover una ubicación dentro de sus propios descendientes', 400);
            }
        }

        // Just update parent_id. The trigger handles all path/depth cascades.
        const [updated] = await db.update(warehouseLocations).set({
            parent_id: newParentId,
        }).where(and(eq(warehouseLocations.id, id), eq(warehouseLocations.company_id, companyId))).returning();

        await invalidateAll(companyId);
        broadcast(
            RealtimeEvents.ENTITY.UPDATED,
            { type: 'location', id: updated.id, entity: updated, clientId },
            RealtimeEvents.ROOMS.LOCATIONS
        );
        return this.getById(updated.id, companyId);
    },

    /**
     * Soft delete (deactivate) a location.
     * Cascades deactivation to all descendants via ltree path.
     */
    async deactivate(id: number, companyId: number, clientId?: string, audit?: AuditContext): Promise<LocationItem> {
        return withAuditTransaction(audit, async (tx) => {
            const [existing] = await tx.select().from(warehouseLocations)
                .where(and(eq(warehouseLocations.id, id), eq(warehouseLocations.company_id, companyId)));
            if (!existing) throw new DomainError('Ubicación no encontrada', 404);

            // Cascade: deactivate this node + all descendants via ltree
            await tx.execute(sql`
                UPDATE warehouse_locations
                SET is_active = false
                WHERE company_id = ${companyId}
                  AND path <@ ${existing.path}::ltree
            `);

            await invalidateAll(companyId);
            broadcast(
                RealtimeEvents.ENTITY.UPDATED,
                { type: 'location', id: existing.id, entity: { ...existing, is_active: false }, clientId },
                RealtimeEvents.ROOMS.LOCATIONS
            );
            return this.getById(id, companyId);
        });
    },

    /**
     * Restore a soft-deleted location.
     */
    async restore(id: number, companyId: number, clientId?: string, audit?: AuditContext): Promise<LocationItem> {
        return withAuditTransaction(audit, async (tx) => {
            const [existing] = await tx.select().from(warehouseLocations)
                .where(and(eq(warehouseLocations.id, id), eq(warehouseLocations.company_id, companyId)));
            if (!existing) throw new DomainError('Ubicación no encontrada', 404);

            const [updated] = await tx.update(warehouseLocations).set({ is_active: true })
                .where(and(eq(warehouseLocations.id, id), eq(warehouseLocations.company_id, companyId))).returning();

            await invalidateAll(companyId);
            broadcast(
                RealtimeEvents.ENTITY.UPDATED,
                { type: 'location', id: updated.id, entity: updated, clientId },
                RealtimeEvents.ROOMS.LOCATIONS
            );
            return this.getById(id, companyId);
        });
    },

    /**
     * Check references to a location across dependent tables.
     */
    async checkReferences(id: number, companyId: number): Promise<LocationReferences> {
        const [existing] = await db.select({ id: warehouseLocations.id }).from(warehouseLocations)
            .where(and(eq(warehouseLocations.id, id), eq(warehouseLocations.company_id, companyId)));
        if (!existing) throw new DomainError('Ubicación no encontrada', 404);

        const countQuery = async (tableSql: ReturnType<typeof sql>): Promise<number> => {
            try {
                const result = await db.execute(sql`SELECT count(*)::int as count FROM ${tableSql}`);
                return (result as any).rows?.[0]?.count ?? 0;
            } catch {
                return 0;
            }
        };

        const [stock, movementsSrc, movementsDest, dimensionalItems] = await Promise.all([
            countQuery(sql`inventory_stock WHERE location_id = ${id} AND company_id = ${companyId}`),
            countQuery(sql`inventory_movements WHERE source_location_id = ${id} AND company_id = ${companyId}`),
            countQuery(sql`inventory_movements WHERE destination_location_id = ${id} AND company_id = ${companyId}`),
            countQuery(sql`inventory_dimensional_items WHERE location_id = ${id} AND company_id = ${companyId}`),
        ]);

        return {
            stock,
            movementsSrc,
            movementsDest,
            dimensionalItems,
            total: stock + movementsSrc + movementsDest + dimensionalItems,
        };
    },

    /**
     * Hard delete a location. Blocks if references exist.
     */
    async hardDelete(id: number, companyId: number, clientId?: string): Promise<{ success: boolean }> {
        const [existing] = await db.select().from(warehouseLocations)
            .where(and(eq(warehouseLocations.id, id), eq(warehouseLocations.company_id, companyId)));
        if (!existing) throw new DomainError('Ubicación no encontrada', 404);

        const refs = await locationsService.checkReferences(id, companyId);
        if (refs.total > 0) throw new DomainError('No se puede eliminar: la ubicación tiene registros vinculados', 409);

        // Check for children
        const children = await db.select({ id: warehouseLocations.id }).from(warehouseLocations)
            .where(and(eq(warehouseLocations.parent_id, id), eq(warehouseLocations.company_id, companyId)));
        if (children.length > 0) throw new DomainError('No se puede eliminar: la ubicación tiene sub-ubicaciones', 409);

        await db.delete(warehouseLocations).where(and(eq(warehouseLocations.id, id), eq(warehouseLocations.company_id, companyId)));
        await invalidateAll(companyId);
        broadcast(
            RealtimeEvents.ENTITY.DELETED,
            { type: 'location', id, clientId },
            RealtimeEvents.ROOMS.LOCATIONS
        );
        return { success: true };
    },

    /**
     * Bulk soft-delete (deactivate) multiple locations atomically.
     * Cascades deactivation to descendants of each location.
     */
    async bulkDeactivate(ids: number[], companyId: number, audit?: AuditContext) {
        if (ids.length === 0) return { success: true, count: 0 };
        return withAuditTransaction(audit, async (tx) => {
            const existing = (await tx
                .select({ id: warehouseLocations.id, path: warehouseLocations.path, warehouse_id: warehouseLocations.warehouse_id })
                .from(warehouseLocations)
                .where(and(
                    eq(warehouseLocations.company_id, companyId),
                    eq(warehouseLocations.is_active, true),
                    inArray(warehouseLocations.id, ids)
                ))) as Array<{ id: number; path: string; warehouse_id: number | null }>;

            if (existing.length === 0) {
                throw new DomainError('No se encontraron ubicaciones válidas para desactivar', 404);
            }

            // Cascade deactivation to each node + its descendants
            for (const loc of existing) {
                await tx.execute(sql`
                    UPDATE warehouse_locations
                    SET is_active = false
                    WHERE company_id = ${companyId}
                      AND path <@ ${loc.path}::ltree
                `);
            }

            await invalidateAll(companyId);

            // Broadcast for each item so frontend cache updates correctly
            for (const loc of existing) {
                broadcast(RealtimeEvents.ENTITY.UPDATED, {
                    type: 'location',
                    id: loc.id,
                    entity: { ...loc, is_active: false },
                    clientId: audit?.clientId,
                }, RealtimeEvents.ROOMS.LOCATIONS);
            }

            return { success: true, count: existing.length, deactivatedIds: existing.map(l => l.id) };
        });
    },

    /**
     * Bulk restore multiple soft-deleted locations atomically.
     */
    async bulkRestore(ids: number[], companyId: number, audit?: AuditContext) {
        if (ids.length === 0) return { success: true, count: 0 };
        return withAuditTransaction(audit, async (tx) => {
            const existing = (await tx
                .select({ id: warehouseLocations.id, warehouse_id: warehouseLocations.warehouse_id })
                .from(warehouseLocations)
                .where(and(
                    eq(warehouseLocations.company_id, companyId),
                    eq(warehouseLocations.is_active, false),
                    inArray(warehouseLocations.id, ids)
                ))) as Array<{ id: number; warehouse_id: number | null }>;

            if (existing.length === 0) {
                throw new DomainError('No se encontraron ubicaciones válidas para restaurar', 404);
            }

            const existingIds = existing.map(l => l.id);
            const updated = await tx.update(warehouseLocations)
                .set({ is_active: true })
                .where(and(
                    eq(warehouseLocations.company_id, companyId),
                    inArray(warehouseLocations.id, existingIds)
                ))
                .returning();

            await invalidateAll(companyId);

            // Broadcast each
            for (const entity of updated) {
                broadcast(RealtimeEvents.ENTITY.UPDATED, {
                    type: 'location',
                    id: entity.id,
                    entity,
                    clientId: audit?.clientId,
                }, RealtimeEvents.ROOMS.LOCATIONS);
            }

            return { success: true, count: existingIds.length, restoredIds: existingIds };
        });
    },
};
