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
async function assertEmployee(id: number) {
    const [row] = await db
        .select({ id: entities.id, is_employee: entities.is_employee })
        .from(entities)
        .where(eq(entities.id, id));
    if (!row) throw new DomainError('Entidad no encontrada', 404);
    if (!row.is_employee) throw new DomainError('Entidad no es un empleado', 404);
    return row;
}

/**
 * Service for managing Employee entities.
 * Facade pattern over the generic entities.service for domain-specific operations.
 */
export const employeesService = {
    /** List all employees with filters */
    async list(filters: {
        search?: string; limit?: number; offset?: number;
        cursor?: string; direction?: string;
        sortBy?: string; sortOrder?: string; page?: number;
        personType?: string[]; taxIdType?: string[]; isActive?: string[]; businessName?: string[];
    }, companyId: number) {
        return listEntities('employee', {
            ...filters,
            direction: filters.direction as any,
            sortOrder: filters.sortOrder as 'asc' | 'desc' | undefined,
        }, companyId);
    },

    /** Get faceted filter values + counts for employee columns */
    async facets(filters: {
        search?: string;
        personType?: string[];
        taxIdType?: string[];
        isActive?: string[];
        businessName?: string[];
    }, companyId: number) {
        return getEntityFacets(
            'employee',
            ['person_type', 'tax_id_type', 'is_active', 'business_name'],
            filters,
            companyId
        );
    },

    /** Get a single employee by ID */
    async get(id: number, companyId: number) {
        const employee = await getEntity(id, companyId);
        if (!employee.is_employee) {
            throw new DomainError('Entidad no es un empleado', 404);
        }
        return employee;
    },

    /** Create a new employee */
    async create(payload: EntityPayload, audit?: AuditContext, companyId?: number) {
        return createEntity('employee', payload, audit, companyId);
    },

    /** Update an existing employee */
    async update(id: number, payload: Partial<EntityPayload>, audit?: AuditContext, companyId?: number) {
        await assertEmployee(id);
        return updateEntity(id, 'employee', payload, audit, companyId);
    },

    /**
     * Soft delete (deactivate) — safe default.
     * Sets is_active=false, deleted_at=now(), deleted_by for audit trail.
     */
    async softDelete(id: number, deletedBy?: number, audit?: AuditContext, companyId?: number) {
        await assertEmployee(id);
        return deactivateEntity(id, 'employee', deletedBy, audit, companyId);
    },

    /**
     * Restore a soft-deleted employee back to active.
     */
    async restore(id: number, audit?: AuditContext, companyId?: number) {
        return restoreEntity(id, 'employee', audit, companyId);
    },

    /**
     * Pre-flight reference check for hard delete UI warning.
     * Returns reference counts so the frontend can warn the user before confirming.
     */
    async checkReferences(id: number): Promise<EntityReferences> {
        await assertEmployee(id);
        return checkEntityReferences(id);
    },

    /**
     * Hard delete — permanently removes the entity.
     * Server always re-validates integrity regardless of client pre-check.
     * Route must be guarded with `employees:destroy` permission.
     */
    async hardDelete(id: number, audit?: AuditContext, companyId?: number) {
        await assertEmployee(id);
        return hardDeleteEntity(id, 'employee', audit, companyId);
    },

    /**
     * Bulk soft-delete (deactivate) multiple employees atomically.
     * Single broadcast for all ids for WS efficiency.
     */
    async bulkDelete(ids: number[], audit?: AuditContext) {
        if (ids.length === 0) return { success: true, count: 0 };
        return withAuditTransaction(audit, async (tx) => {
            const existing = await tx
                .select({ id: entities.id })
                .from(entities)
                .where(and(
                    eq(entities.is_employee, true),
                    eq(entities.is_active, true),
                    inArray(entities.id, ids)
                ));

            const existingIds = existing.map((e: { id: number }) => e.id);
            if (existingIds.length === 0) {
                throw new DomainError('No se encontraron empleados válidos para eliminar', 404);
            }

            // Bulk soft delete with audit timestamps, returning the updated rows
            const updatedEntities = await tx.update(entities).set({
                is_active: false,
                deleted_at: new Date(),
            }).where(inArray(entities.id, existingIds))
              .returning();

            await cacheService.invalidate('employees:*');

            // Broadcast each updated entity individually so the frontend 
            // can cleanly update their caches to `{ is_active: false }`
            for (const entity of updatedEntities) {
                broadcast(RealtimeEvents.ENTITY.UPDATED, {
                    type: 'employee',
                    entity,
                    clientId: audit?.clientId,
                }, 'employees');
            }

            return { success: true, count: existingIds.length, deletedIds: existingIds };
        });
    },

    /**
     * Bulk restore multiple soft-deleted employees atomically.
     */
    async bulkRestore(ids: number[], audit?: AuditContext) {
        if (ids.length === 0) return { success: true, count: 0 };

        return withAuditTransaction(audit, async (tx) => {
            const existing = await tx
                .select({ id: entities.id })
                .from(entities)
                .where(and(
                    eq(entities.is_employee, true),
                    eq(entities.is_active, false),
                    inArray(entities.id, ids)
                ));

            const existingIds = existing.map((e: { id: number }) => e.id);
            if (existingIds.length === 0) {
                throw new DomainError('No se encontraron empleados válidos para restaurar', 404);
            }

            const updatedEntities = await tx.update(entities).set({
                is_active: true,
                deleted_at: null,
                deleted_by: null,
            }).where(inArray(entities.id, existingIds))
              .returning();

            await cacheService.invalidate('employees:*');

            // Broadcast each updated entity individually so the frontend 
            // can cleanly update their caches to `{ is_active: true }`
            for (const entity of updatedEntities) {
                broadcast(RealtimeEvents.ENTITY.UPDATED, {
                    type: 'employee',
                    entity,
                    clientId: audit?.clientId,
                }, 'employees');
            }

            return { success: true, count: existingIds.length, restoredIds: existingIds };
        });
    },
};
