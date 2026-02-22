
import { and, eq, inArray } from '@app/schema';
import { db } from '../db';
import { entities } from '@app/schema/tables';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/ws';
import { WsEvents } from '@app/schema/ws-events';
import type { EntityPayload } from './entities.service';
import { createEntity, updateEntity, deactivateEntity, listEntities, getEntity, getEntityFacets } from './entities.service';

// Re-export shared types
export type { EntityPayload };

/**
 * Service for managing Supplier entities
 * Facade pattern over the generic entities.service for domain-specific operations
 */
export const suppliersService = {
    /**
     * List all active suppliers with filters
     */
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

    /**
     * Get faceted filter values + counts for supplier columns.
     * Accepts current column filters for cross-filtering.
     */
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

    /**
     * Get a supplier by ID
     */
    async get(id: number) {
        const supplier = await getEntity(id);
        if (!supplier.is_supplier) {
            throw new DomainError('Entidad no es un proveedor', 404);
        }
        return supplier;
    },

    /**
     * Create a new supplier
     */
    async create(payload: EntityPayload) {
        return createEntity('supplier', {
            ...payload,
        });
    },

    /**
     * Update an existing supplier
     */
    async update(id: number, payload: Partial<EntityPayload>) {
        const current = await this.get(id);
        return updateEntity(id, 'supplier', payload);
    },

    /**
     * Deactivate a supplier (soft delete)
     */
    async delete(id: number) {
        const current = await this.get(id);
        return deactivateEntity(id, 'supplier');
    },

    /**
     * Bulk delete (deactivate) multiple suppliers
     * Uses transaction for atomicity and single broadcast for efficiency
     */
    async bulkDelete(ids: number[]) {
        if (ids.length === 0) {
            return { success: true, count: 0 };
        }

        return db.transaction(async (tx) => {
            // Verify all IDs are valid suppliers
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

            // Soft delete all valid suppliers
            await tx
                .update(entities)
                .set({
                    is_active: false,
                })
                .where(inArray(entities.id, existingIds));

            // Awaitable cache invalidation — completes before broadcast
            await cacheService.invalidate('suppliers:*');

            // Single WebSocket broadcast for all deleted items
            broadcast(WsEvents.ENTITY.DELETED, {
                type: 'supplier',
                ids: existingIds
            }, 'suppliers');

            return {
                success: true,
                count: existingIds.length,
                deletedIds: existingIds
            };
        });
    }
};
