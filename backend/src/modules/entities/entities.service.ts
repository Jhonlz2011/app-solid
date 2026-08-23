import { 
    listEntities, 
    getEntityFacets, 
    getEntity, 
} from './entities.query.service';

import type { EntityBodyType, EntityFilters, EntityType } from '@app/schema/dto';
import { 
    createEntity, 
    updateEntity, 
    deactivateEntity, 
    restoreEntity, 
    hardDeleteEntity, 
    bulkDeactivateEntities, 
    bulkRestoreEntities, 
    checkEntityReferences,
} from './entities.command.service';

import type { AuditContext } from '../audit/audit.service';
import { DomainError } from '../../core/errors';

/**
 * Generic factory for entity services (Suppliers, Clients, Employees, Carriers).
 * Provides standard CRUD operations strictly scoped to tenant and entity type.
 */
export function createEntityService(type: EntityType) {
    return {
        async list(filters: EntityFilters, companyId: number) {
            return listEntities(type, filters, companyId);
        },
        async facets(filters: EntityFilters, companyId: number) {
            return getEntityFacets(type, ['person_type', 'tax_id_type', 'is_active', 'business_name'], filters, companyId);
        },
        async get(id: string, companyId: number) {
            const entity = await getEntity(id, companyId);
            const isValid = type === 'client' ? entity.is_client : type === 'supplier' ? entity.is_supplier : type === 'employee' ? entity.is_employee : entity.is_carrier;
            if (!isValid) throw new DomainError(`Entidad no es un ${type}`, 404);
            return entity;
        },
        async create(payload: EntityBodyType, audit: AuditContext | undefined, companyId: number) {
            return createEntity(type, payload, audit, companyId);
        },
        async update(id: string, payload: Partial<EntityBodyType>, audit: AuditContext | undefined, companyId: number) {
            return updateEntity(id, type, payload, audit, companyId);
        },
        async softDelete(id: string, deletedBy: number | undefined, audit: AuditContext | undefined, companyId: number) {
            return deactivateEntity(id, type, deletedBy, audit, companyId);
        },
        async restore(id: string, audit: AuditContext | undefined, companyId: number) {
            return restoreEntity(id, type, audit, companyId);
        },
        async checkReferences(id: string, companyId: number) {
            return checkEntityReferences(id, companyId);
        },
        async hardDelete(id: string, audit: AuditContext | undefined, companyId: number) {
            return hardDeleteEntity(id, type, audit, companyId);
        },
        async bulkDelete(ids: string[], audit: AuditContext | undefined, companyId: number) {
            return bulkDeactivateEntities(type, ids, audit, companyId);
        },
        async bulkRestore(ids: string[], audit: AuditContext | undefined, companyId: number) {
            return bulkRestoreEntities(type, ids, audit, companyId);
        },
    };
}
