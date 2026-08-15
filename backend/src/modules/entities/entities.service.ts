import { 
    listEntities, 
    getEntityFacets, 
    getEntity, 
    type EntityType,
    type ListFilters,
    type FacetFilters,
} from './entities.query.service';

import type { EntityPayload } from '@app/schema/dto';
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
import { db } from '../../core/db';
import { entities } from '@app/schema/tables';
import { eq, and } from '@app/schema';

async function assertEntity(id: number, type: EntityType, companyId: number) {
    const typeColumn = type === 'client' ? entities.is_client : type === 'supplier' ? entities.is_supplier : type === 'employee' ? entities.is_employee : entities.is_carrier;

    const [row] = await db
        .select({ id: entities.id, isValid: typeColumn })
        .from(entities)
        .where(and(eq(entities.id, id), eq(entities.company_id, companyId)));
    if (!row) throw new DomainError('Entidad no encontrada', 404);
    if (!row.isValid) throw new DomainError(`Entidad no es un ${type}`, 404);
    return row;
}

/**
 * Generic factory for entity services (Suppliers, Clients, Employees, Carriers).
 * Provides standard CRUD operations strictly scoped to tenant.
 */
export function createEntityService(type: EntityType) {
    return {
        async list(filters: ListFilters, companyId: number) {
            return listEntities(type, filters, companyId);
        },
        async facets(filters: FacetFilters, companyId: number) {
            return getEntityFacets(type, ['person_type', 'tax_id_type', 'is_active', 'business_name'], filters, companyId);
        },
        async get(id: number, companyId: number) {
            const entity = await getEntity(id, companyId);
            const isValid = type === 'client' ? entity.is_client : type === 'supplier' ? entity.is_supplier : type === 'employee' ? entity.is_employee : entity.is_carrier;
            if (!isValid) throw new DomainError(`Entidad no es un ${type}`, 404);
            return entity;
        },
        async create(payload: EntityPayload, audit: AuditContext | undefined, companyId: number) {
            return createEntity(type, payload, audit, companyId);
        },
        async update(id: number, payload: Partial<EntityPayload>, audit: AuditContext | undefined, companyId: number) {
            await assertEntity(id, type, companyId);
            return updateEntity(id, type, payload, audit, companyId);
        },
        async softDelete(id: number, deletedBy: number | undefined, audit: AuditContext | undefined, companyId: number) {
            await assertEntity(id, type, companyId);
            return deactivateEntity(id, type, deletedBy, audit, companyId);
        },
        async restore(id: number, audit: AuditContext | undefined, companyId: number) {
            await assertEntity(id, type, companyId);
            return restoreEntity(id, type, audit, companyId);
        },
        async checkReferences(id: number, companyId: number) {
            await assertEntity(id, type, companyId);
            return checkEntityReferences(id, companyId);
        },
        async hardDelete(id: number, audit: AuditContext | undefined, companyId: number) {
            await assertEntity(id, type, companyId);
            return hardDeleteEntity(id, type, audit, companyId);
        },
        async bulkDelete(ids: number[], audit: AuditContext | undefined, companyId: number) {
            return bulkDeactivateEntities(type, ids, audit, companyId);
        },
        async bulkRestore(ids: number[], audit: AuditContext | undefined, companyId: number) {
            return bulkRestoreEntities(type, ids, audit, companyId);
        },
    };
}

/**
 * Concrete domain entity services instantiated directly from the factory.
 */
export const clientsService = createEntityService('client');
export const suppliersService = createEntityService('supplier');
export const employeesService = createEntityService('employee');
