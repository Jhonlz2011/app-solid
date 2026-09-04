import { and, eq, desc, sql } from '@app/schema';
import { db } from '../../core/db';
import { warehouses, warehouseLocations, inventoryStock, inventoryMovements } from '@app/schema/tables';
import { DomainError } from '../../core/errors';
import { withAuditTransaction, type AuditContext } from '../audit/audit.service';
import { broadcastToTenant } from '../../core/sse/events';
import { RealtimeEvents } from '@app/schema/realtime-events';
import type {
    WarehouseBodyType,
    WarehouseUpdateType,
    WarehouseReferencesResponseType,
    WarehouseItem,
} from '@app/schema/dto';

export const warehousesService = {
    async list(companyId: number): Promise<WarehouseItem[]> {
        const rows = await db
            .select({
                id: warehouses.id,
                company_id: warehouses.company_id,
                code: warehouses.code,
                name: warehouses.name,
                address: warehouses.address,
                is_mobile: warehouses.is_mobile,
                manager_id: warehouses.manager_id,
                is_active: warehouses.is_active,
                locationCount: sql<number>`COALESCE((
                    SELECT COUNT(*)::int
                    FROM warehouse_locations wl
                    WHERE wl.warehouse_id = ${warehouses.id}
                ), 0)`.as('locationCount'),
            })
            .from(warehouses)
            .where(eq(warehouses.company_id, companyId))
            .orderBy(desc(warehouses.id));

        return rows as WarehouseItem[];
    },

    async get(companyId: number, id: number): Promise<WarehouseItem> {
        const [warehouse] = await db
            .select({
                id: warehouses.id,
                company_id: warehouses.company_id,
                code: warehouses.code,
                name: warehouses.name,
                address: warehouses.address,
                is_mobile: warehouses.is_mobile,
                manager_id: warehouses.manager_id,
                is_active: warehouses.is_active,
                locationCount: sql<number>`COALESCE((
                    SELECT COUNT(*)::int
                    FROM warehouse_locations wl
                    WHERE wl.warehouse_id = ${warehouses.id}
                ), 0)`.as('locationCount'),
            })
            .from(warehouses)
            .where(and(eq(warehouses.id, id), eq(warehouses.company_id, companyId)));

        if (!warehouse) throw new DomainError('Bodega no encontrada', 404);
        return warehouse as WarehouseItem;
    },

    async create(companyId: number, data: WarehouseBodyType, audit?: AuditContext): Promise<WarehouseItem> {
        return await withAuditTransaction(audit, async (tx) => {
            const normalizedCode = data.code.toUpperCase().trim();

            const [existing] = await tx
                .select({ id: warehouses.id })
                .from(warehouses)
                .where(and(eq(warehouses.company_id, companyId), eq(warehouses.code, normalizedCode)))
                .limit(1);

            if (existing) {
                throw new DomainError(`Ya existe una bodega con el código '${normalizedCode}'`, 409);
            }

            const [created] = await tx
                .insert(warehouses)
                .values({
                    company_id: companyId,
                    code: normalizedCode,
                    name: data.name.trim(),
                    address: data.address || null,
                    is_mobile: data.is_mobile ?? false,
                    manager_id: data.manager_id || null,
                    is_active: true,
                })
                .returning();

            const result: WarehouseItem = {
                ...created,
                locationCount: 0,
            };

            broadcastToTenant(companyId, RealtimeEvents.WAREHOUSE.CREATED, {
                id: created.id,
                warehouse: result,
                clientId: audit?.clientId,
            });

            return result;
        });
    },

    async update(companyId: number, id: number, data: WarehouseUpdateType, audit?: AuditContext): Promise<WarehouseItem> {
        return await withAuditTransaction(audit, async (tx) => {
            const updateSet: Record<string, unknown> = {};

            if (data.code !== undefined) {
                const normalizedCode = data.code.toUpperCase().trim();
                const [existing] = await tx
                    .select({ id: warehouses.id })
                    .from(warehouses)
                    .where(
                        and(
                            eq(warehouses.company_id, companyId),
                            eq(warehouses.code, normalizedCode),
                            sql`${warehouses.id} != ${id}`
                        )
                    )
                    .limit(1);

                if (existing) {
                    throw new DomainError(`Ya existe otra bodega con el código '${normalizedCode}'`, 409);
                }
                updateSet.code = normalizedCode;
            }

            if (data.name !== undefined) updateSet.name = data.name.trim();
            if (data.address !== undefined) updateSet.address = data.address || null;
            if (data.is_mobile !== undefined) updateSet.is_mobile = data.is_mobile;
            if (data.manager_id !== undefined) updateSet.manager_id = data.manager_id || null;
            if (data.is_active !== undefined) updateSet.is_active = data.is_active;

            const [updated] = await tx
                .update(warehouses)
                .set(updateSet)
                .where(and(eq(warehouses.id, id), eq(warehouses.company_id, companyId)))
                .returning();

            if (!updated) throw new DomainError('Bodega no encontrada', 404);

            const [countRes] = await tx
                .select({
                    count: sql<number>`COUNT(*)::int`,
                })
                .from(warehouseLocations)
                .where(eq(warehouseLocations.warehouse_id, id));

            const result: WarehouseItem = {
                ...updated,
                locationCount: countRes?.count ?? 0,
            };

            broadcastToTenant(companyId, RealtimeEvents.WAREHOUSE.UPDATED, {
                id: updated.id,
                warehouse: result,
                clientId: audit?.clientId,
            });

            return result;
        });
    },

    async deactivate(companyId: number, id: number, audit?: AuditContext): Promise<void> {
        await withAuditTransaction(audit, async (tx) => {
            const [updated] = await tx
                .update(warehouses)
                .set({ is_active: false })
                .where(and(eq(warehouses.id, id), eq(warehouses.company_id, companyId)))
                .returning({ id: warehouses.id });

            if (!updated) throw new DomainError('Bodega no encontrada', 404);

            broadcastToTenant(companyId, RealtimeEvents.WAREHOUSE.UPDATED, {
                id,
                is_active: false,
                clientId: audit?.clientId,
            });
        });
    },

    async restore(companyId: number, id: number, audit?: AuditContext): Promise<WarehouseItem> {
        return await withAuditTransaction(audit, async (tx) => {
            const [updated] = await tx
                .update(warehouses)
                .set({ is_active: true })
                .where(and(eq(warehouses.id, id), eq(warehouses.company_id, companyId)))
                .returning();

            if (!updated) throw new DomainError('Bodega no encontrada', 404);

            const [countRes] = await tx
                .select({ count: sql<number>`COUNT(*)::int` })
                .from(warehouseLocations)
                .where(eq(warehouseLocations.warehouse_id, id));

            const result: WarehouseItem = {
                ...updated,
                locationCount: countRes?.count ?? 0,
            };

            broadcastToTenant(companyId, RealtimeEvents.WAREHOUSE.UPDATED, {
                id,
                warehouse: result,
                is_active: true,
                clientId: audit?.clientId,
            });

            return result;
        });
    },

    async checkReferences(companyId: number, id: number): Promise<WarehouseReferencesResponseType> {
        // 1. Locations count
        const [locRes] = await db
            .select({ count: sql<number>`COUNT(*)::int` })
            .from(warehouseLocations)
            .where(and(eq(warehouseLocations.company_id, companyId), eq(warehouseLocations.warehouse_id, id)));
        const locationsCount = locRes?.count ?? 0;

        // 2. Stock count in locations of this warehouse
        const [stockRes] = await db
            .select({ count: sql<number>`COUNT(*)::int` })
            .from(inventoryStock)
            .innerJoin(warehouseLocations, eq(inventoryStock.location_id, warehouseLocations.id))
            .where(
                and(
                    eq(warehouseLocations.company_id, companyId),
                    eq(warehouseLocations.warehouse_id, id),
                    sql`${inventoryStock.quantity_on_hand} > 0`
                )
            );
        const stockCount = stockRes?.count ?? 0;

        // 3. Movements involving locations of this warehouse
        const [movRes] = await db
            .select({ count: sql<number>`COUNT(*)::int` })
            .from(inventoryMovements)
            .innerJoin(
                warehouseLocations,
                sql`${inventoryMovements.source_location_id} = ${warehouseLocations.id} OR ${inventoryMovements.destination_location_id} = ${warehouseLocations.id}`
            )
            .where(and(eq(warehouseLocations.company_id, companyId), eq(warehouseLocations.warehouse_id, id)));
        const movementsCount = movRes?.count ?? 0;

        const total = locationsCount + stockCount + movementsCount;

        return {
            locations: locationsCount,
            stock: stockCount,
            movements: movementsCount,
            total,
        };
    },

    async delete(companyId: number, id: number, audit?: AuditContext): Promise<{ success: boolean }> {
        const refs = await this.checkReferences(companyId, id);
        if (refs.total > 0) {
            throw new DomainError(
                `No se puede eliminar la bodega porque tiene ${refs.locations} ubicaciones, ` +
                `${refs.stock} variantes en stock y ${refs.movements} movimientos asociados. Desactívela en su lugar.`,
                400
            );
        }

        return await withAuditTransaction(audit, async (tx) => {
            const [deleted] = await tx
                .delete(warehouses)
                .where(and(eq(warehouses.id, id), eq(warehouses.company_id, companyId)))
                .returning({ id: warehouses.id });

            if (!deleted) throw new DomainError('Bodega no encontrada', 404);

            broadcastToTenant(companyId, RealtimeEvents.WAREHOUSE.DELETED, {
                id,
                clientId: audit?.clientId,
            });

            return { success: true };
        });
    },
};
