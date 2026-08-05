
export * from './entities/entities.query.service';
export * from './entities/entities.command.service';
import { 
    listEntities, 
    getEntityFacets, 
    getEntity, 
    type EntityType,
    type EntityPayload
} from './entities/entities.query.service';

import { 
    createEntity, 
    updateEntity, 
    deactivateEntity, 
    restoreEntity, 
    hardDeleteEntity, 
    bulkDeactivateEntities, 
    bulkRestoreEntities, 
    checkEntityReferences,
} from './entities/entities.command.service';

import type { AuditContext } from './audit.service';
import { DomainError } from './errors';
import { db } from '../db';
import { entities } from '@app/schema/tables';
import { eq } from '@app/schema';

async function assertEntity(id: number, type: EntityType) {
    const typeColumn = type === 'client' ? entities.is_client : type === 'supplier' ? entities.is_supplier : type === 'employee' ? entities.is_employee : entities.is_carrier;
    const [row] = await db
        .select({ id: entities.id, isValid: typeColumn })
        .from(entities)
        .where(eq(entities.id, id));
    if (!row) throw new DomainError('Entidad no encontrada', 404);
    if (!row.isValid) throw new DomainError(`Entidad no es un ${type}`, 404);
    return row;
}

/**
 * Generic factory for entity services (Suppliers, Clients, Employees).
 * Replaces boilerplate service files with a single generic implementation.
 */
export function createEntityService(type: EntityType) {
    return {
        async list(filters: any, companyId: number) {
            return listEntities(type, {
                ...filters,
                direction: filters.direction as any,
                sortOrder: filters.sortOrder as 'asc' | 'desc' | undefined,
            }, companyId);
        },
        async facets(filters: any, companyId: number) {
            return getEntityFacets(type, ['person_type', 'tax_id_type', 'is_active', 'business_name'], filters, companyId);
        },
        async get(id: number, companyId: number) {
            const entity = await getEntity(id, companyId);
            const isValid = type === 'client' ? entity.is_client : type === 'supplier' ? entity.is_supplier : type === 'employee' ? entity.is_employee : entity.is_carrier;
            if (!isValid) throw new DomainError(`Entidad no es un ${type}`, 404);
            return entity;
        },
        async create(payload: EntityPayload, audit?: AuditContext, companyId?: number) {
            return createEntity(type, payload, audit, companyId);
        },
        async update(id: number, payload: Partial<EntityPayload>, audit?: AuditContext, companyId?: number) {
            await assertEntity(id, type);
            return updateEntity(id, type, payload, audit, companyId);
        },
        async softDelete(id: number, deletedBy?: number, audit?: AuditContext, companyId?: number) {
            await assertEntity(id, type);
            return deactivateEntity(id, type, deletedBy, audit, companyId);
        },
        async restore(id: number, audit?: AuditContext, companyId?: number) {
            return restoreEntity(id, type, audit, companyId);
        },
        async checkReferences(id: number) {
            await assertEntity(id, type);
            return checkEntityReferences(id);
        },
        async hardDelete(id: number, audit?: AuditContext, companyId?: number) {
            await assertEntity(id, type);
            return hardDeleteEntity(id, type, audit, companyId);
        },
        async bulkDelete(ids: number[], audit?: AuditContext) {
            return bulkDeactivateEntities(type, ids, audit);
        },
        async bulkRestore(ids: number[], audit?: AuditContext) {
            return bulkRestoreEntities(type, ids, audit);
        },
    };
}
