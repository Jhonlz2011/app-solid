import { eq, asc, sql, and, count } from '@app/schema';
import { db } from '../db';
import { warehouses, warehouseLocations } from '@app/schema/tables';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/sse';

// =============================================================================
// WAREHOUSES
// =============================================================================

function warehouseCacheKey(companyId: number) {
    return `inventory:warehouses:c${companyId}`;
}

export async function listWarehouses(companyId: number) {
    return cacheService.getOrSet(warehouseCacheKey(companyId), async () => {
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
            .where(eq(warehouses.company_id, companyId))
            .groupBy(warehouses.id)
            .orderBy(asc(warehouses.code));
        return rows;
    }, 3600);
}

export async function getWarehouse(id: number, companyId: number) {
    const [row] = await db.select().from(warehouses).where(
        and(
            eq(warehouses.id, id),
            eq(warehouses.company_id, companyId)
        )
    );
    if (!row) throw new DomainError('Bodega no encontrada', 404);
    return row;
}

export async function createWarehouse(
    data: { code: string; name: string; address?: string; is_mobile?: boolean; manager_id?: number },
    companyId: number
) {
    // Check unique code within the company
    const existing = await db.select().from(warehouses).where(
        and(
            eq(warehouses.code, data.code),
            eq(warehouses.company_id, companyId)
        )
    );
    if (existing.length) throw new DomainError('El código de bodega ya existe', 409);

    const [created] = await db.insert(warehouses).values({
        company_id: companyId,
        code: data.code,
        name: data.name,
        address: data.address ?? null,
        is_mobile: data.is_mobile ?? false,
        manager_id: data.manager_id ?? null,
    }).returning();

    cacheService.invalidate(warehouseCacheKey(companyId));
    broadcast('inventory:warehouse:created', created, 'inventory');
    return created;
}

export async function updateWarehouse(
    id: number,
    data: Partial<{ code: string; name: string; address: string | null; is_mobile: boolean; manager_id: number | null; is_active: boolean }>,
    companyId: number
) {
    // If code changed, check uniqueness within the same company
    if (data.code) {
        const existing = await db.select().from(warehouses).where(
            and(
                eq(warehouses.code, data.code),
                eq(warehouses.company_id, companyId),
                sql`${warehouses.id} != ${id}`
            )
        );
        if (existing.length) throw new DomainError('El código de bodega ya existe', 409);
    }

    const [updated] = await db.update(warehouses)
        .set(data)
        .where(
            and(
                eq(warehouses.id, id),
                eq(warehouses.company_id, companyId)
            )
        )
        .returning();
    if (!updated) throw new DomainError('Bodega no encontrada', 404);

    cacheService.invalidate(warehouseCacheKey(companyId));
    broadcast('inventory:warehouse:updated', updated, 'inventory');
    return updated;
}

export async function deactivateWarehouse(id: number, companyId: number) {
    const [updated] = await db.update(warehouses)
        .set({ is_active: false })
        .where(
            and(
                eq(warehouses.id, id),
                eq(warehouses.company_id, companyId)
            )
        )
        .returning();
    if (!updated) throw new DomainError('Bodega no encontrada', 404);

    cacheService.invalidate(warehouseCacheKey(companyId));
    broadcast('inventory:warehouse:updated', updated, 'inventory');
    return updated;
}

export async function restoreWarehouse(id: number, companyId: number) {
    const [updated] = await db.update(warehouses)
        .set({ is_active: true })
        .where(
            and(
                eq(warehouses.id, id),
                eq(warehouses.company_id, companyId)
            )
        )
        .returning();
    if (!updated) throw new DomainError('Bodega no encontrada', 404);

    cacheService.invalidate(warehouseCacheKey(companyId));
    broadcast('inventory:warehouse:updated', updated, 'inventory');
    return updated;
}

