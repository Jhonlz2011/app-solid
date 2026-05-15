import { eq, asc, sql, and, ne } from '@app/schema';
import { db } from '../db';
import { warehouses, warehouseLocations } from '@app/schema/tables';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/sse';

// =============================================================================
// LOCATIONS SERVICE — Warehouse Locations CRUD with Hierarchy
// =============================================================================

function locationCacheKey(warehouseId?: number) {
    return warehouseId ? `locations:wh:${warehouseId}` : 'locations:all';
}

function invalidateAll(warehouseId?: number | null) {
    if (warehouseId) cacheService.invalidate(locationCacheKey(warehouseId));
    cacheService.invalidate(locationCacheKey());
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
     * Ordered by path for consistent tree rendering.
     */
    async list(warehouseId?: number) {
        const key = locationCacheKey(warehouseId);
        return cacheService.getOrSet(key, async () => {
            const query = db
                .select()
                .from(warehouseLocations)
                .orderBy(asc(warehouseLocations.path));

            if (warehouseId) {
                return query.where(eq(warehouseLocations.warehouse_id, warehouseId));
            }
            return query;
        }, 3600);
    },

    /**
     * Create a new location with parent_id + derived ltree path.
     */
    async create(data: {
        warehouse_id?: number | null;
        parent_id?: number | null;
        name: string;
        barcode?: string | null;
        type?: 'VIEW' | 'INTERNAL';
    }) {
        let parentPath: string | null = null;
        let depth = 0;
        let warehouseId = data.warehouse_id ?? null;

        if (data.parent_id) {
            const [parent] = await db.select().from(warehouseLocations).where(eq(warehouseLocations.id, data.parent_id));
            if (!parent) throw new DomainError('Ubicación padre no encontrada', 404);
            parentPath = parent.path;
            depth = parent.depth + 1;
            // Inherit warehouse from parent if not specified
            if (!warehouseId) warehouseId = parent.warehouse_id;
        } else if (warehouseId) {
            const [wh] = await db.select().from(warehouses).where(eq(warehouses.id, warehouseId));
            if (!wh) throw new DomainError('Bodega no encontrada', 404);
        }

        const path = buildPath(parentPath, slugify(data.name));

        const [created] = await db.insert(warehouseLocations).values({
            warehouse_id: warehouseId,
            parent_id: data.parent_id ?? null,
            name: data.name,
            path,
            barcode: data.barcode ?? null,
            type: data.type ?? 'INTERNAL',
            depth,
        }).returning();

        invalidateAll(warehouseId);
        broadcast('inventory:location:created', created, 'inventory');
        return created;
    },

    /**
     * Update a location by id.
     * If name changes, rebuilds path for this node (children paths are NOT cascaded here — use reparent for that).
     */
    async update(id: number, data: Partial<{ name: string; barcode: string | null; type: 'VIEW' | 'INTERNAL'; is_active: boolean }>) {
        const [existing] = await db.select().from(warehouseLocations).where(eq(warehouseLocations.id, id));
        if (!existing) throw new DomainError('Ubicación no encontrada', 404);

        const updateValues: Record<string, any> = { ...data };

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
                SET path = ${newPath} || substr(path::text, ${oldPath.length + 1})::ltree
                WHERE path <@ ${oldPath}::ltree AND id != ${id}
            `);
        }

        const [updated] = await db.update(warehouseLocations).set(updateValues).where(eq(warehouseLocations.id, id)).returning();
        invalidateAll(existing.warehouse_id);
        broadcast('inventory:location:updated', updated, 'inventory');
        return updated;
    },

    /**
     * Reparent a location — move it under a new parent (or to root).
     * Validates against circular dependencies.
     * Cascades path + depth to all descendants.
     */
    async reparent(id: number, newParentId: number | null) {
        const [node] = await db.select().from(warehouseLocations).where(eq(warehouseLocations.id, id));
        if (!node) throw new DomainError('Ubicación no encontrada', 404);

        // Skip if same parent
        if (node.parent_id === newParentId) return node;

        let newParentPath: string | null = null;
        let newDepth = 0;
        let newWarehouseId = node.warehouse_id;

        if (newParentId !== null) {
            const [newParent] = await db.select().from(warehouseLocations).where(eq(warehouseLocations.id, newParentId));
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

        // Update this node
        const [updated] = await db.update(warehouseLocations).set({
            parent_id: newParentId,
            path: newPath,
            depth: newDepth,
            warehouse_id: newWarehouseId,
        }).where(eq(warehouseLocations.id, id)).returning();

        // Cascade to all descendants: update path prefix + adjust depth
        await db.execute(sql`
            UPDATE warehouse_locations 
            SET path = ${newPath} || substr(path::text, ${oldPath.length + 1})::ltree,
                depth = depth + ${depthDiff},
                warehouse_id = ${newWarehouseId}
            WHERE path <@ ${oldPath}::ltree AND id != ${id}
        `);

        invalidateAll(node.warehouse_id);
        if (newWarehouseId !== node.warehouse_id) invalidateAll(newWarehouseId);
        broadcast('inventory:location:updated', updated, 'inventory');
        return updated;
    },

    /**
     * Soft delete (deactivate) a location.
     */
    async deactivate(id: number) {
        const [existing] = await db.select().from(warehouseLocations).where(eq(warehouseLocations.id, id));
        if (!existing) throw new DomainError('Ubicación no encontrada', 404);

        const [updated] = await db.update(warehouseLocations).set({ is_active: false }).where(eq(warehouseLocations.id, id)).returning();
        invalidateAll(existing.warehouse_id);
        broadcast('inventory:location:updated', updated, 'inventory');
        return updated;
    },

    /**
     * Restore a soft-deleted location.
     */
    async restore(id: number) {
        const [existing] = await db.select().from(warehouseLocations).where(eq(warehouseLocations.id, id));
        if (!existing) throw new DomainError('Ubicación no encontrada', 404);

        const [updated] = await db.update(warehouseLocations).set({ is_active: true }).where(eq(warehouseLocations.id, id)).returning();
        invalidateAll(existing.warehouse_id);
        broadcast('inventory:location:updated', updated, 'inventory');
        return updated;
    },

    /**
     * Check references to a location across dependent tables.
     */
    async checkReferences(id: number) {
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
    async hardDelete(id: number) {
        const [existing] = await db.select().from(warehouseLocations).where(eq(warehouseLocations.id, id));
        if (!existing) throw new DomainError('Ubicación no encontrada', 404);

        const refs = await locationsService.checkReferences(id);
        if (refs.total > 0) throw new DomainError('No se puede eliminar: la ubicación tiene registros vinculados', 409);

        // Check for children
        const children = await db.select({ id: warehouseLocations.id }).from(warehouseLocations).where(eq(warehouseLocations.parent_id, id));
        if (children.length > 0) throw new DomainError('No se puede eliminar: la ubicación tiene sub-ubicaciones', 409);

        await db.delete(warehouseLocations).where(eq(warehouseLocations.id, id));
        invalidateAll(existing.warehouse_id);
        broadcast('inventory:location:deleted', { id }, 'inventory');
        return { success: true };
    },
};
