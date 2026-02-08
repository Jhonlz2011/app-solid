
import { and, desc, eq, ilike, or, sql } from '@app/schema';
import { db } from '../db';
import { entities } from '@app/schema/tables';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/ws';
import type { EntityPayload } from './entities.service';
import { createEntity, updateEntity, deactivateEntity, listEntities, getEntity } from './entities.service';

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
    async list(filters: { search?: string; limit?: number; offset?: number }) {
        return listEntities('supplier', filters);
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
        // Enforce supplier flag
        return createEntity('supplier', {
            ...payload,
            // Ensure business logic correct flags if needed, 
            // though createEntity handles it based on 'type' arg
        });
    },

    /**
     * Update an existing supplier
     */
    async update(id: number, payload: Partial<EntityPayload>) {
        const current = await this.get(id); // Ensure it exists and is a supplier
        return updateEntity(id, 'supplier', payload);
    },

    /**
     * Deactivate a supplier (soft delete)
     */
    async delete(id: number) {
        const current = await this.get(id); // Ensure it exists and is a supplier
        return deactivateEntity(id, 'supplier');
    }
};
