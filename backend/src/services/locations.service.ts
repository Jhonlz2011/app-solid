import { eq, asc, sql, and, inArray } from '@app/schema';
import { db } from '../db';
import { warehouses, warehouseLocations, productVariants, inventoryStock } from '@app/schema/tables';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/sse';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { withAuditTransaction, type AuditContext } from './audit.service';

// =============================================================================
// LOCATIONS SERVICE — Warehouse Locations CRUD with Hierarchy (Multi-tenant)
// =============================================================================

function locationCacheKey(companyId: number, warehouseId?: number) {
    return warehouseId ? `locations:c${companyId}:wh:${warehouseId}` : `locations:c${companyId}:all`;
}

async function invalidateAll(companyId: number, warehouseId?: number | null) {
    const promises = [cacheService.invalidate(locationCacheKey(companyId))];
    if (warehouseId) {
        promises.push(cacheService.invalidate(locationCacheKey(companyId, warehouseId)));
    }
    await Promise.all(promises);
}

/** Build an ltree-safe slug from a name */
function slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

/** Build full ltree path from parent path + slug */
function buildPath(parentPath: string | null, slug: string): string {
    return parentPath ? `${parentPath}.${slug}` : slug;
}

export const locationsService = {
    /**
     * List all locations as flat array (frontend builds tree via buildSubRows).
     * Scoped by company_id. Ordered by path for consistent tree rendering.
     */
    async list(companyId: number, warehouseId?: number) {
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
     * Create a new location with parent_id + derived ltree path.
     */
    async create(data: {
        name: string;
        parent_id: number | null;
        warehouse_id?: number | null;
        type: 'VIEW' | 'INTERNAL';
    }, companyId: number, clientId?: string) {
        let parentPath: string | null = null;
        let depth = 0;
        let warehouseId = data.warehouse_id;

        if (data.parent_id) {
            const [parent] = await db.select().from(warehouseLocations)
                .where(and(eq(warehouseLocations.id, data.parent_id), eq(warehouseLocations.company_id, companyId)));
            if (!parent) throw new DomainError('Ubicación padre no encontrada', 404);
            parentPath = parent.path;
            depth = parent.depth + 1;
            // Inherit warehouse from parent if not specified (undefined)
            if (warehouseId === undefined) {
                warehouseId = parent.warehouse_id;
            }
        } else if (warehouseId) {
            const [wh] = await db.select().from(warehouses)
                .where(and(eq(warehouses.id, warehouseId), eq(warehouses.company_id, companyId)));
            if (!wh) throw new DomainError('Bodega no encontrada', 404);
        }

        const path = buildPath(parentPath, slugify(data.name));

        const [created] = await db.insert(warehouseLocations).values({
            company_id: companyId,
            warehouse_id: warehouseId ?? null,
            parent_id: data.parent_id ?? null,
            name: data.name,
            path,
            type: data.type ?? 'INTERNAL',
            depth,
        }).returning();

        await invalidateAll(companyId, warehouseId ?? null);
        broadcast(RealtimeEvents.ENTITY.CREATED, { id: created.id, entity: created, clientId }, 'locations');
        return created;
    },

    /**
     * Update a location by id.
     * If name changes, rebuilds path for this node and cascades to descendants.
     */
    async update(id: number, data: Partial<{
        name: string;
        type: 'VIEW' | 'INTERNAL';
        warehouse_id: number | null;
        parent_id: number | null;
        is_active: boolean;
    }>, companyId: number, clientId?: string) {
        const [existing] = await db.select().from(warehouseLocations)
            .where(and(eq(warehouseLocations.id, id), eq(warehouseLocations.company_id, companyId)));
        if (!existing) throw new DomainError('Ubicación no encontrada', 404);

        const updateValues: Record<string, any> = { ...data };

        // Handle reparenting if parent_id changed
        if (data.parent_id !== undefined && data.parent_id !== existing.parent_id) {
            const reparented = await locationsService.reparent(id, data.parent_id, companyId, clientId);
            existing.parent_id = reparented.parent_id;
            existing.path = reparented.path;
            existing.depth = reparented.depth;
            existing.warehouse_id = reparented.warehouse_id;
            delete updateValues.parent_id;

            // If data.warehouse_id wasn't explicitly changed in the update body,
            // align with the newly inherited warehouse from parent
            if (data.warehouse_id === undefined) {
                data.warehouse_id = reparented.warehouse_id;
                updateValues.warehouse_id = reparented.warehouse_id;
            }
        }

        // If warehouse_id is updated, cascade it to all descendants BEFORE changing paths
        if (data.warehouse_id !== undefined && data.warehouse_id !== existing.warehouse_id) {
            const newWarehouseId = data.warehouse_id;
            const oldPath = existing.path;
            if (newWarehouseId !== null) {
                await db.execute(sql`
                    UPDATE warehouse_locations 
                    SET warehouse_id = ${newWarehouseId}
                    WHERE path <@ ${oldPath}::ltree AND id != ${id}
                `);
            } else {
                await db.execute(sql`
                    UPDATE warehouse_locations 
                    SET warehouse_id = NULL
                    WHERE path <@ ${oldPath}::ltree AND id != ${id}
                `);
            }
        }

        // If name changed, rebuild this node's path segment
        if (data.name && data.name !== existing.name) {
            const parts = existing.path.split('.');
            parts[parts.length - 1] = slugify(data.name);
            const newPath = parts.join('.');
            updateValues.path = newPath;

            // Cascade path change to all descendants
            const oldPath = existing.path;
            await db.execute(sql`
                UPDATE warehouse_locations 
                SET path = (${newPath} || substr(path::text, ${oldPath.length + 1}))::ltree
                WHERE path <@ ${oldPath}::ltree AND id != ${id}
            `);
        }

        const [updated] = await db.update(warehouseLocations).set(updateValues)
            .where(and(eq(warehouseLocations.id, id), eq(warehouseLocations.company_id, companyId))).returning();
        
        await invalidateAll(companyId, existing.warehouse_id);
        if (data.warehouse_id !== undefined && data.warehouse_id !== existing.warehouse_id) {
            await invalidateAll(companyId, data.warehouse_id);
        }
        
        broadcast(RealtimeEvents.ENTITY.UPDATED, { id: updated.id, entity: updated, clientId }, 'locations');
        return updated;
    },

    /**
     * Reparent a location — move it under a new parent (or to root).
     * Validates against circular dependencies.
     * Cascades path + depth + warehouse_id to all descendants.
     */
    async reparent(id: number, newParentId: number | null, companyId: number, clientId?: string) {
        const [node] = await db.select().from(warehouseLocations)
            .where(and(eq(warehouseLocations.id, id), eq(warehouseLocations.company_id, companyId)));
        if (!node) throw new DomainError('Ubicación no encontrada', 404);

        // Skip if same parent
        if (node.parent_id === newParentId) return node;

        let newParentPath: string | null = null;
        let newDepth = 0;
        let newWarehouseId: number | null = node.warehouse_id;

        if (newParentId !== null) {
            const [newParent] = await db.select().from(warehouseLocations)
                .where(and(eq(warehouseLocations.id, newParentId), eq(warehouseLocations.company_id, companyId)));
            if (!newParent) throw new DomainError('Ubicación padre no encontrada', 404);

            // Anti-circular: check the new parent is NOT a descendant of this node
            const isDescendant = newParent.path.startsWith(node.path + '.');
            if (isDescendant || newParentId === id) {
                throw new DomainError('Acción inválida: no puedes mover una ubicación dentro de sus propios descendientes', 400);
            }

            newParentPath = newParent.path;
            newDepth = newParent.depth + 1;
            newWarehouseId = newParent.warehouse_id;
        }

        const oldPath = node.path;
        const newPath = buildPath(newParentPath, slugify(node.name));
        const depthDiff = newDepth - node.depth;

        // Update this node via Drizzle ORM (handles NULL correctly)
        const [updated] = await db.update(warehouseLocations).set({
            parent_id: newParentId,
            path: newPath,
            depth: newDepth,
            warehouse_id: newWarehouseId,
        }).where(eq(warehouseLocations.id, id)).returning();

        // Cascade to all descendants: update path prefix + adjust depth
        // Use separate queries to avoid raw SQL NULL issues with warehouse_id
        if (newWarehouseId !== null) {
            await db.execute(sql`
                UPDATE warehouse_locations 
                SET path = (${newPath} || substr(path::text, ${oldPath.length + 1}))::ltree,
                    depth = depth + ${depthDiff},
                    warehouse_id = ${newWarehouseId}
                WHERE path <@ ${oldPath}::ltree AND id != ${id}
            `);
        } else {
            await db.execute(sql`
                UPDATE warehouse_locations 
                SET path = (${newPath} || substr(path::text, ${oldPath.length + 1}))::ltree,
                    depth = depth + ${depthDiff},
                    warehouse_id = NULL
                WHERE path <@ ${oldPath}::ltree AND id != ${id}
            `);
        }

        await invalidateAll(companyId, node.warehouse_id);
        if (newWarehouseId !== node.warehouse_id) await invalidateAll(companyId, newWarehouseId);
        broadcast(RealtimeEvents.ENTITY.UPDATED, { id: updated.id, entity: updated, clientId }, 'locations');
        return updated;
    },

    /**
     * Soft delete (deactivate) a location.
     * Cascades deactivation to all descendants via ltree path.
     */
    async deactivate(id: number, companyId: number, clientId?: string, audit?: AuditContext) {
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

            const [updated] = await tx.select().from(warehouseLocations)
                .where(eq(warehouseLocations.id, id));

            await invalidateAll(companyId, existing.warehouse_id);
            broadcast(RealtimeEvents.ENTITY.UPDATED, { id: updated.id, entity: updated, clientId }, 'locations');
            return updated;
        });
    },

    /**
     * Restore a soft-deleted location.
     */
    async restore(id: number, companyId: number, clientId?: string, audit?: AuditContext) {
        return withAuditTransaction(audit, async (tx) => {
            const [existing] = await tx.select().from(warehouseLocations)
                .where(and(eq(warehouseLocations.id, id), eq(warehouseLocations.company_id, companyId)));
            if (!existing) throw new DomainError('Ubicación no encontrada', 404);

            const [updated] = await tx.update(warehouseLocations).set({ is_active: true })
                .where(eq(warehouseLocations.id, id)).returning();
            await invalidateAll(companyId, existing.warehouse_id);
            broadcast(RealtimeEvents.ENTITY.UPDATED, { id: updated.id, entity: updated, clientId }, 'locations');
            return updated;
        });
    },

    /**
     * Check references to a location across dependent tables.
     */
    async checkReferences(id: number, companyId: number) {
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
            countQuery(sql`inventory_stock WHERE location_id = ${id}`),
            countQuery(sql`inventory_movements WHERE source_location_id = ${id}`),
            countQuery(sql`inventory_movements WHERE destination_location_id = ${id}`),
            countQuery(sql`inventory_dimensional_items WHERE location_id = ${id}`),
        ]);

        return {
            stock, movementsSrc, movementsDest, dimensionalItems,
            total: stock + movementsSrc + movementsDest + dimensionalItems,
        };
    },

    /**
     * Hard delete a location. Blocks if references exist.
     */
    async hardDelete(id: number, companyId: number, clientId?: string) {
        const [existing] = await db.select().from(warehouseLocations)
            .where(and(eq(warehouseLocations.id, id), eq(warehouseLocations.company_id, companyId)));
        if (!existing) throw new DomainError('Ubicación no encontrada', 404);

        const refs = await locationsService.checkReferences(id, companyId);
        if (refs.total > 0) throw new DomainError('No se puede eliminar: la ubicación tiene registros vinculados', 409);

        // Check for children
        const children = await db.select({ id: warehouseLocations.id }).from(warehouseLocations).where(eq(warehouseLocations.parent_id, id));
        if (children.length > 0) throw new DomainError('No se puede eliminar: la ubicación tiene sub-ubicaciones', 409);

        await db.delete(warehouseLocations).where(eq(warehouseLocations.id, id));
        await invalidateAll(companyId, existing.warehouse_id);
        broadcast(RealtimeEvents.ENTITY.DELETED, { id, clientId }, 'locations');
        return { success: true };
    },

    /**
     * Bulk soft-delete (deactivate) multiple locations atomically.
     * Cascades deactivation to descendants of each location.
     */
    async bulkDeactivate(ids: number[], companyId: number, audit?: AuditContext) {
        if (ids.length === 0) return { success: true, count: 0 };
        return withAuditTransaction(audit, async (tx) => {
            const existing = await tx
                .select({ id: warehouseLocations.id, path: warehouseLocations.path, warehouse_id: warehouseLocations.warehouse_id })
                .from(warehouseLocations)
                .where(and(
                    eq(warehouseLocations.company_id, companyId),
                    eq(warehouseLocations.is_active, true),
                    inArray(warehouseLocations.id, ids)
                ));

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

            // Invalidate all relevant caches
            const warehouseIds = new Set(existing.map(l => l.warehouse_id).filter(Boolean));
            await invalidateAll(companyId);
            for (const whId of warehouseIds) {
                await invalidateAll(companyId, whId!);
            }

            // Broadcast for each item so frontend cache updates correctly
            for (const loc of existing) {
                broadcast(RealtimeEvents.ENTITY.UPDATED, {
                    id: loc.id,
                    entity: { ...loc, is_active: false },
                    clientId: audit?.clientId,
                }, 'locations');
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
            const existing = await tx
                .select({ id: warehouseLocations.id, warehouse_id: warehouseLocations.warehouse_id })
                .from(warehouseLocations)
                .where(and(
                    eq(warehouseLocations.company_id, companyId),
                    eq(warehouseLocations.is_active, false),
                    inArray(warehouseLocations.id, ids)
                ));

            if (existing.length === 0) {
                throw new DomainError('No se encontraron ubicaciones válidas para restaurar', 404);
            }

            const existingIds = existing.map(l => l.id);
            const updated = await tx.update(warehouseLocations)
                .set({ is_active: true })
                .where(inArray(warehouseLocations.id, existingIds))
                .returning();

            // Invalidate caches
            const warehouseIds = new Set(existing.map(l => l.warehouse_id).filter(Boolean));
            await invalidateAll(companyId);
            for (const whId of warehouseIds) {
                await invalidateAll(companyId, whId!);
            }

            // Broadcast each
            for (const entity of updated) {
                broadcast(RealtimeEvents.ENTITY.UPDATED, {
                    id: entity.id,
                    entity,
                    clientId: audit?.clientId,
                }, 'locations');
            }

            return { success: true, count: existingIds.length, restoredIds: existingIds };
        });
    },
};
