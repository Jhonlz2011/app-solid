import { eq, asc, sql, and, count } from '@app/schema';
import { db } from '../db';
import { warehouses, warehouseLocations } from '@app/schema/tables';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/sse';

// =============================================================================
// WAREHOUSES
// =============================================================================

export async function listWarehouses() {
    return cacheService.getOrSet('inventory:warehouses', async () => {
        const rows = await db
            .select({
                id: warehouses.id,
                code: warehouses.code,
                name: warehouses.name,
                address: warehouses.address,
                is_mobile: warehouses.is_mobile,
                manager_id: warehouses.manager_id,
                is_active: warehouses.is_active,
                locationCount: count(warehouseLocations.id),
            })
            .from(warehouses)
            .leftJoin(warehouseLocations, and(
                eq(warehouseLocations.warehouse_id, warehouses.id),
                eq(warehouseLocations.is_active, true),
            ))
            .groupBy(warehouses.id)
            .orderBy(asc(warehouses.code));
        return rows;
    }, 3600);
}

export async function getWarehouse(id: number) {
    const [row] = await db.select().from(warehouses).where(eq(warehouses.id, id));
    if (!row) throw new DomainError('Bodega no encontrada', 404);
    return row;
}

export async function createWarehouse(data: { code: string; name: string; address?: string; is_mobile?: boolean; manager_id?: number }) {
    // Check unique code
    const existing = await db.select().from(warehouses).where(eq(warehouses.code, data.code));
    if (existing.length) throw new DomainError('El código de bodega ya existe', 409);

    const [created] = await db.insert(warehouses).values({
        code: data.code,
        name: data.name,
        address: data.address ?? null,
        is_mobile: data.is_mobile ?? false,
        manager_id: data.manager_id ?? null,
    }).returning();

    cacheService.invalidate('inventory:warehouses');
    broadcast('inventory:warehouse:created', created, 'inventory');
    return created;
}

export async function updateWarehouse(id: number, data: Partial<{ code: string; name: string; address: string | null; is_mobile: boolean; manager_id: number | null; is_active: boolean }>) {
    // If code changed, check uniqueness
    if (data.code) {
        const existing = await db.select().from(warehouses).where(and(eq(warehouses.code, data.code), sql`${warehouses.id} != ${id}`));
        if (existing.length) throw new DomainError('El código de bodega ya existe', 409);
    }

    const [updated] = await db.update(warehouses).set(data).where(eq(warehouses.id, id)).returning();
    if (!updated) throw new DomainError('Bodega no encontrada', 404);
    cacheService.invalidate('inventory:warehouses');
    broadcast('inventory:warehouse:updated', updated, 'inventory');
    return updated;
}

export async function deactivateWarehouse(id: number) {
    const [updated] = await db.update(warehouses).set({ is_active: false }).where(eq(warehouses.id, id)).returning();
    if (!updated) throw new DomainError('Bodega no encontrada', 404);
    cacheService.invalidate('inventory:warehouses');
    return updated;
}

export async function restoreWarehouse(id: number) {
    const [updated] = await db.update(warehouses).set({ is_active: true }).where(eq(warehouses.id, id)).returning();
    if (!updated) throw new DomainError('Bodega no encontrada', 404);
    cacheService.invalidate('inventory:warehouses');
    return updated;
}

// =============================================================================
// WAREHOUSE LOCATIONS
// =============================================================================

function locationCacheKey(warehouseId?: number) {
    return warehouseId ? `inventory:locations:${warehouseId}` : 'inventory:locations:all';
}

export async function listLocations(warehouseId?: number) {
    const key = locationCacheKey(warehouseId);
    return cacheService.getOrSet(key, async () => {
        let query = db
            .select()
            .from(warehouseLocations)
            .orderBy(asc(warehouseLocations.path));

        if (warehouseId) {
            return query.where(eq(warehouseLocations.warehouse_id, warehouseId));
        }
        return query;
    }, 3600);
}

/** Build an ltree path from parent + slug */
function buildPath(parentPath: string | null, slug: string): string {
    const sanitized = slug.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    return parentPath ? `${parentPath}.${sanitized}` : sanitized;
}

export async function createLocation(data: {
    warehouse_id: number;
    name: string;
    parent_id?: number | null;
    barcode?: string | null;
    type?: 'VIEW' | 'INTERNAL';
}) {
    // Resolve parent path
    let parentPath: string | null = null;
    let depth = 0;

    if (data.parent_id) {
        const [parent] = await db.select().from(warehouseLocations).where(eq(warehouseLocations.id, data.parent_id));
        if (!parent) throw new DomainError('Ubicación padre no encontrada', 404);
        parentPath = parent.path;
        depth = parent.depth + 1;
    } else {
        // Root location — use warehouse code as base path
        const [wh] = await db.select().from(warehouses).where(eq(warehouses.id, data.warehouse_id));
        if (!wh) throw new DomainError('Bodega no encontrada', 404);
        parentPath = null;
    }

    const path = buildPath(parentPath, data.name);

    const [created] = await db.insert(warehouseLocations).values({
        warehouse_id: data.warehouse_id,
        name: data.name,
        path,
        barcode: data.barcode ?? null,
        type: data.type ?? 'INTERNAL',
        depth,
    }).returning();

    // Invalidate all location caches for this warehouse
    cacheService.invalidate(locationCacheKey(data.warehouse_id));
    cacheService.invalidate(locationCacheKey());
    broadcast('inventory:location:created', created, 'inventory');
    return created;
}

export async function updateLocation(id: number, data: Partial<{ name: string; barcode: string | null; type: 'VIEW' | 'INTERNAL'; is_active: boolean }>) {
    const [existing] = await db.select().from(warehouseLocations).where(eq(warehouseLocations.id, id));
    if (!existing) throw new DomainError('Ubicación no encontrada', 404);

    // If name changed, rebuild path
    const updateValues: Record<string, any> = { ...data };
    if (data.name && data.name !== existing.name) {
        // Rebuild just this node's path segment
        const parts = existing.path.split('.');
        const slug = data.name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
        parts[parts.length - 1] = slug;
        updateValues.path = parts.join('.');
    }

    const [updated] = await db.update(warehouseLocations).set(updateValues).where(eq(warehouseLocations.id, id)).returning();
    if (existing.warehouse_id) {
        cacheService.invalidate(locationCacheKey(existing.warehouse_id));
    }
    cacheService.invalidate(locationCacheKey());
    broadcast('inventory:location:updated', updated, 'inventory');
    return updated;
}

export async function deactivateLocation(id: number) {
    const [existing] = await db.select().from(warehouseLocations).where(eq(warehouseLocations.id, id));
    if (!existing) throw new DomainError('Ubicación no encontrada', 404);

    const [updated] = await db.update(warehouseLocations).set({ is_active: false }).where(eq(warehouseLocations.id, id)).returning();
    if (existing.warehouse_id) cacheService.invalidate(locationCacheKey(existing.warehouse_id));
    cacheService.invalidate(locationCacheKey());
    return updated;
}

export async function restoreLocation(id: number) {
    const [existing] = await db.select().from(warehouseLocations).where(eq(warehouseLocations.id, id));
    if (!existing) throw new DomainError('Ubicación no encontrada', 404);

    const [updated] = await db.update(warehouseLocations).set({ is_active: true }).where(eq(warehouseLocations.id, id)).returning();
    if (existing.warehouse_id) cacheService.invalidate(locationCacheKey(existing.warehouse_id));
    cacheService.invalidate(locationCacheKey());
    return updated;
}
