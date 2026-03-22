
import { and, eq, inArray } from '@app/schema';
import { db } from '../db';
import { entities } from '@app/schema/tables';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/sse';
import { RealtimeEvents } from '@app/schema/realtime-events';
import type { EntityPayload } from './entities.service';
import {
    createEntity,
    updateEntity,
    deactivateEntity,
    restoreEntity,
    checkEntityReferences,
    hardDeleteEntity,
    listEntities,
    getEntity,
    getEntityFacets,
    type EntityReferences,
} from './entities.service';
import { withAuditTransaction, type AuditContext } from './audit.service';

// Re-export shared types
export type { EntityPayload, EntityReferences };

/** Lightweight existence + type check (single query, no joins) */
async function assertSupplier(id: number) {
    const [row] = await db
        .select({ id: entities.id, is_supplier: entities.is_supplier })
        .from(entities)
        .where(eq(entities.id, id));
    if (!row) throw new DomainError('Entidad no encontrada', 404);
    if (!row.is_supplier) throw new DomainError('Entidad no es un proveedor', 404);
    return row;
}

/**
 * Service for managing Supplier entities.
 * Facade pattern over the generic entities.service for domain-specific operations.
 */
export const suppliersService = {
    /** List all suppliers with filters */
    async list(filters: {
        search?: string; limit?: number; offset?: number;
        cursor?: string; direction?: string;
        sortBy?: string; sortOrder?: string; page?: number;
        personType?: string[]; taxIdType?: string[]; isActive?: string[]; businessName?: string[];
    }) {
        return listEntities('supplier', {
            ...filters,
            direction: filters.direction as any,
            sortOrder: filters.sortOrder as 'asc' | 'desc' | undefined,
        });
    },

    /** Get faceted filter values + counts for supplier columns */
    async facets(filters: {
        search?: string;
        personType?: string[];
        taxIdType?: string[];
        isActive?: string[];
        businessName?: string[];
    }) {
        return getEntityFacets(
            'supplier',
            ['person_type', 'tax_id_type', 'is_active', 'business_name'],
            filters
        );
    },

    /** Get a single supplier by ID */
    async get(id: number) {
        const supplier = await getEntity(id);
        if (!supplier.is_supplier) {
            throw new DomainError('Entidad no es un proveedor', 404);
        }
        return supplier;
    },

    /** Create a new supplier */
    async create(payload: EntityPayload, audit?: AuditContext) {
        return createEntity('supplier', payload, audit);
    },

    /** Update an existing supplier */
    async update(id: number, payload: Partial<EntityPayload>, audit?: AuditContext) {
        await assertSupplier(id);
        return updateEntity(id, 'supplier', payload, audit);
    },

    /**
     * Soft delete (deactivate) — safe default.
     * Sets is_active=false, deleted_at=now(), deleted_by for audit trail.
     */
    async softDelete(id: number, deletedBy?: number, audit?: AuditContext) {
        await assertSupplier(id);
        return deactivateEntity(id, 'supplier', deletedBy, audit);
    },

    /**
     * Restore a soft-deleted supplier back to active.
     */
    async restore(id: number, audit?: AuditContext) {
        return restoreEntity(id, 'supplier', audit);
    },

    /**
     * Pre-flight reference check for hard delete UI warning.
     * Returns reference counts so the frontend can warn the user before confirming.
     */
    async checkReferences(id: number): Promise<EntityReferences> {
        await assertSupplier(id);
        return checkEntityReferences(id);
    },

    /**
     * Hard delete — permanently removes the entity.
     * Server always re-validates integrity regardless of client pre-check.
     * Route must be guarded with `suppliers:destroy` permission.
     */
    async hardDelete(id: number, audit?: AuditContext) {
        await assertSupplier(id);
        return hardDeleteEntity(id, 'supplier', audit);
    },

    /**
     * Bulk soft-delete (deactivate) multiple suppliers atomically.
     * Single broadcast for all ids for WS efficiency.
     */
    async bulkDelete(ids: number[], audit?: AuditContext) {
        if (ids.length === 0) return { success: true, count: 0 };

        return withAuditTransaction(audit, async (tx) => {
            const existing = await tx
                .select({ id: entities.id })
                .from(entities)
                .where(and(
                    eq(entities.is_supplier, true),
                    eq(entities.is_active, true),
                    inArray(entities.id, ids)
                ));

            const existingIds = existing.map(e => e.id);
            if (existingIds.length === 0) {
                throw new DomainError('No se encontraron proveedores válidos para eliminar', 404);
            }

            // Bulk soft delete with audit timestamps, returning the updated rows
            const updatedEntities = await tx.update(entities).set({
                is_active: false,
                deleted_at: new Date(),
            }).where(inArray(entities.id, existingIds))
              .returning();

            await cacheService.invalidate('suppliers:*');

            // Broadcast each updated entity individually so the frontend 
            // can cleanly update their caches to `{ is_active: false }`
            for (const entity of updatedEntities) {
                broadcast(RealtimeEvents.ENTITY.UPDATED, {
                    type: 'supplier',
                    entity,
                    clientId: audit?.clientId,
                }, 'suppliers');
            }

            return { success: true, count: existingIds.length, deletedIds: existingIds };
        });
    },

    /**
     * Bulk restore multiple soft-deleted suppliers atomically.
     */
    async bulkRestore(ids: number[], audit?: AuditContext) {
        if (ids.length === 0) return { success: true, count: 0 };

        return withAuditTransaction(audit, async (tx) => {
            const existing = await tx
                .select({ id: entities.id })
                .from(entities)
                .where(and(
                    eq(entities.is_supplier, true),
                    eq(entities.is_active, false),
                    inArray(entities.id, ids)
                ));

            const existingIds = existing.map(e => e.id);
            if (existingIds.length === 0) {
                throw new DomainError('No se encontraron proveedores válidos para restaurar', 404);
            }

            const updatedEntities = await tx.update(entities).set({
                is_active: true,
                deleted_at: null,
                deleted_by: null,
            }).where(inArray(entities.id, existingIds))
              .returning();

            await cacheService.invalidate('suppliers:*');

            // Broadcast each updated entity individually so the frontend 
            // can cleanly update their caches to `{ is_active: true }`
            for (const entity of updatedEntities) {
                broadcast(RealtimeEvents.ENTITY.UPDATED, {
                    type: 'supplier',
                    entity,
                    clientId: audit?.clientId,
                }, 'suppliers');
            }

            return { success: true, count: existingIds.length, restoredIds: existingIds };
        });
    },
};