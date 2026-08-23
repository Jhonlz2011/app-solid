import {  alias, and, eq, ilike, or, asc, inArray, type AnyColumn, type SQL } from '@app/schema';
import { db } from '../../core/db';
import { entities, entityAddresses, entityContacts, employeeDetails, carrierVehicles, carrierDrivers, departments, jobTitles } from '@app/schema/tables';
import { DomainError } from '../../core/errors';
import { cacheService } from '../../core/cache';
import { CursorPaginator } from '../../core/db/paginator';
import type { EntityPickerType, EntityFilters } from '@app/schema/dto';
import type { EntityType } from '@app/schema/enums';

export const SORTABLE_COLUMNS: Record<string, AnyColumn> = {
    id: entities.id,
    business_name: entities.business_name,
    tax_id: entities.tax_id,
    person_type: entities.person_type,
    tax_id_type: entities.tax_id_type,
    is_active: entities.is_active,
    created_at: entities.created_at,
};

// =============================================================================
// Shared Filter Builder
// =============================================================================

export interface FilterBuildOptions {
    companyId: number;
    type?: EntityType;
    search?: string;
    isCarrier?: boolean;
    filters?: EntityFilters;
    excludeColumn?: string;
    excludeFilterKey?: string;
}

export function buildWhereConditions(opts: FilterBuildOptions): SQL[] {
    const conditions: SQL[] = [eq(entities.company_id, opts.companyId)];

    if (opts.type) {
        switch (opts.type) {
            case 'client':
                conditions.push(eq(entities.is_client, true));
                break;
            case 'supplier':
                conditions.push(eq(entities.is_supplier, true));
                break;
            case 'employee':
                conditions.push(eq(entities.is_employee, true));
                if (opts.isCarrier !== undefined) {
                    conditions.push(eq(entities.is_carrier, opts.isCarrier));
                }
                break;
            case 'carrier':
                conditions.push(eq(entities.is_carrier, true));
                break;
        }
    }

    if (opts.isCarrier !== undefined && opts.type !== 'employee') {
        conditions.push(eq(entities.is_carrier, opts.isCarrier));
    }

    if (opts.search) {
        const pattern = `%${opts.search}%`;
        const searchCondition = or(
            ilike(entities.business_name, pattern),
            ilike(entities.tax_id, pattern),
            ilike(entities.trade_name, pattern)
        );
        if (searchCondition) conditions.push(searchCondition);
    }

    const cf = opts.filters;
    const exclude = opts.excludeFilterKey || opts.excludeColumn;

    if (exclude !== 'isActive') {
        if (cf?.isActive && cf.isActive.length > 0) {
            const boolValues = cf.isActive.map(v => v === 'true');
            if (boolValues.length === 1) {
                conditions.push(eq(entities.is_active, boolValues[0]));
            }
        } else {
            conditions.push(eq(entities.is_active, true));
        }
    }

    if (exclude !== 'personType' && cf?.personType && cf.personType.length > 0) {
        conditions.push(inArray(entities.person_type, cf.personType));
    }
    if (exclude !== 'taxIdType' && cf?.taxIdType && cf.taxIdType.length > 0) {
        conditions.push(inArray(entities.tax_id_type, cf.taxIdType));
    }
    if (exclude !== 'businessName' && cf?.businessName && cf.businessName.length > 0) {
        conditions.push(inArray(entities.business_name, cf.businessName));
    }

    return conditions;
}

// =============================================================================
// Entity Cursor Paginators
// =============================================================================

function createEntityPaginator(type: EntityType) {
    return new CursorPaginator<typeof entities, EntityFilters>({
        table: entities,
        idColumn: entities.id,
        companyIdColumn: entities.company_id,
        sortableColumns: SORTABLE_COLUMNS,
        defaultSortBy: 'business_name',
        cacheNamespace: `${type}s`,
        ttl: 120,
        buildConditions: (opts) => buildWhereConditions({
            companyId: opts.companyId,
            type,
            search: opts.search,
            filters: opts.filters,
            excludeFilterKey: opts.excludeFilterKey,
            isCarrier: opts.filters?.isCarrier,
        }),
    });
}

const entityPaginators: Record<EntityType, CursorPaginator<typeof entities, EntityFilters>> = {
    client: createEntityPaginator('client'),
    supplier: createEntityPaginator('supplier'),
    employee: createEntityPaginator('employee'),
    carrier: createEntityPaginator('carrier'),
};

// =============================================================================
// List Entities
// =============================================================================

export async function listEntities(type: EntityType, filters: EntityFilters, companyId: number) {
    const paginator = entityPaginators[type] || createEntityPaginator(type);
    const { cursor, direction, limit, search, isCarrier, sortBy, sortOrder, page, ...columnFilters } = filters;
    return paginator.paginate(
        { cursor, direction, limit, search, sortBy, sortOrder, page, filters: { ...columnFilters, isCarrier } },
        companyId
    );
}

export async function listEntitiesCursor(type: EntityType, filters: EntityFilters, companyId: number) {
    const paginator = entityPaginators[type] || createEntityPaginator(type);
    const { cursor, direction, limit, search, isCarrier, sortBy, sortOrder, page, ...columnFilters } = filters;
    return paginator.paginateCursor(
        { cursor, direction, limit, search, sortBy, sortOrder, page, filters: { ...columnFilters, isCarrier } },
        companyId
    );
}

export async function listEntitiesSorted(type: EntityType, filters: EntityFilters, companyId: number) {
    const paginator = entityPaginators[type] || createEntityPaginator(type);
    const { cursor, direction, limit, search, isCarrier, sortBy, sortOrder, page, ...columnFilters } = filters;
    return paginator.paginateSorted(
        { cursor, direction, limit, search, sortBy, sortOrder, page, filters: { ...columnFilters, isCarrier } },
        companyId
    );
}

export async function getCachedTotal(
    companyId: number, type: EntityType, search?: string, isCarrier?: boolean, columnFilters?: Partial<EntityFilters>
) {
    const paginator = entityPaginators[type] || createEntityPaginator(type);
    return paginator.getCachedTotal(companyId, search, { ...columnFilters, isCarrier });
}

export async function getCachedBounds(
    companyId: number, type: EntityType, search?: string, isCarrier?: boolean, columnFilters?: Partial<EntityFilters>
) {
    const paginator = entityPaginators[type] || createEntityPaginator(type);
    return paginator.getCachedBounds(companyId, search, { ...columnFilters, isCarrier });
}

// =============================================================================
// Get Entity Facets
// =============================================================================

export type FacetColumn = 'person_type' | 'tax_id_type' | 'is_active' | 'business_name';

export const FACET_TO_FILTER_KEY: Record<FacetColumn, keyof EntityFilters> = {
    person_type: 'personType',
    tax_id_type: 'taxIdType',
    is_active: 'isActive',
    business_name: 'businessName',
};

export async function getEntityFacets(
    type: EntityType,
    columns: FacetColumn[],
    filters: EntityFilters,
    companyId: number
): Promise<Record<string, { value: string; count: number }[]>> {
    const paginator = entityPaginators[type] || createEntityPaginator(type);
    const columnMap: Record<FacetColumn, any> = {
        person_type: entities.person_type,
        tax_id_type: entities.tax_id_type,
        is_active: entities.is_active,
        business_name: entities.business_name,
    };

    return paginator.getFacets(
        columns,
        columnMap,
        FACET_TO_FILTER_KEY,
        {},
        filters,
        companyId
    );
}

// =============================================================================
// Get Single Entity
// =============================================================================

export async function getEntity(id: string, companyId: number) {
    const cacheKey = `entity:c${companyId}:${id}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const [entity] = await db.select().from(entities).where(
            and(eq(entities.id, id), eq(entities.company_id, companyId))
        );
        if (!entity) throw new DomainError('Entidad no encontrada', 404);

        const [addresses, contacts, vehicles, drivers] = await Promise.all([
            db.select().from(entityAddresses).where(eq(entityAddresses.entity_id, id)),
            db.select().from(entityContacts).where(eq(entityContacts.entity_id, id)),
            entity.is_carrier ? db.select().from(carrierVehicles).where(eq(carrierVehicles.carrier_id, id)) : Promise.resolve([]),
            entity.is_carrier ? db.select().from(carrierDrivers).where(eq(carrierDrivers.carrier_id, id)) : Promise.resolve([]),
        ]);

        let details = null;
        if (entity.is_employee) {
            const supervisors = alias(entities, 'supervisors');
            const [empDetails] = await db
                .select({
                    entity_id: employeeDetails.entity_id,
                    department_id: employeeDetails.department_id,
                    department_name: departments.name,
                    job_title_id: employeeDetails.job_title_id,
                    job_title_name: jobTitles.name,
                    reports_to: employeeDetails.reports_to,
                    reports_to_name: supervisors.business_name,
                    hire_date: employeeDetails.hire_date,
                    termination_date: employeeDetails.termination_date,
                    contract_type: employeeDetails.contract_type,
                    work_modality: employeeDetails.work_modality,
                    salary_base: employeeDetails.salary_base,
                    cost_per_hour: employeeDetails.cost_per_hour,
                    commission_percentage: employeeDetails.commission_percentage,
                    approval_limit_amount: employeeDetails.approval_limit_amount,
                    accumulate_thirteenth: employeeDetails.accumulate_thirteenth,
                    accumulate_fourteenth: employeeDetails.accumulate_fourteenth,
                    accumulate_reserve_funds: employeeDetails.accumulate_reserve_funds,
                    iess_code: employeeDetails.iess_code,
                    dependents_count: employeeDetails.dependents_count,
                    disability_percentage: employeeDetails.disability_percentage,
                    conadis_id: employeeDetails.conadis_id,
                    bank_name: employeeDetails.bank_name,
                    bank_account_type: employeeDetails.bank_account_type,
                    bank_account_number: employeeDetails.bank_account_number,
                    blood_type: employeeDetails.blood_type,
                })
                .from(employeeDetails)
                .leftJoin(departments, eq(employeeDetails.department_id, departments.id))
                .leftJoin(jobTitles, eq(employeeDetails.job_title_id, jobTitles.id))
                .leftJoin(supervisors, eq(employeeDetails.reports_to, supervisors.id))
                .where(eq(employeeDetails.entity_id, id));
            details = empDetails || null;
        }

        return { ...entity, addresses, contacts, employeeDetails: details, vehicles, drivers };
    }, 3600);
}

export async function lookupEntityByTaxId(taxId: string, companyId: number) {
    const [entity] = await db
        .select({ id: entities.id })
        .from(entities)
        .where(and(eq(entities.company_id, companyId), eq(entities.tax_id, taxId.trim())))
        .limit(1);

    if (!entity) return null;
    return getEntity(entity.id, companyId);
}

export async function listDepartments(companyId: number) {
    return db
        .select({
            id: departments.id,
            name: departments.name,
            code: departments.code,
            is_active: departments.is_active,
        })
        .from(departments)
        .where(and(eq(departments.company_id, companyId), eq(departments.is_active, true)))
        .orderBy(asc(departments.name));
}

export async function listJobTitles(companyId: number, departmentId?: number) {
    const conditions = [
        eq(jobTitles.company_id, companyId),
        eq(jobTitles.is_active, true),
    ];
    if (departmentId) {
        conditions.push(eq(jobTitles.department_id, departmentId));
    }
    return db
        .select({
            id: jobTitles.id,
            name: jobTitles.name,
            department_id: jobTitles.department_id,
            is_active: jobTitles.is_active,
        })
        .from(jobTitles)
        .where(and(...conditions))
        .orderBy(asc(jobTitles.name));
}

export async function getContacts(entityId: string, companyId: number) {
    const [ent] = await db
        .select({ id: entities.id })
        .from(entities)
        .where(and(eq(entities.id, entityId), eq(entities.company_id, companyId)));
    if (!ent) throw new DomainError('Entidad no encontrada', 404);

    return db.select().from(entityContacts).where(eq(entityContacts.entity_id, entityId));
}

export async function getAddresses(entityId: string, companyId: number) {
    const [ent] = await db
        .select({ id: entities.id })
        .from(entities)
        .where(and(eq(entities.id, entityId), eq(entities.company_id, companyId)));
    if (!ent) throw new DomainError('Entidad no encontrada', 404);

    return db.select().from(entityAddresses).where(eq(entityAddresses.entity_id, entityId));
}

export async function listForPicker(companyId: number, search?: string, limit: number = 200): Promise<EntityPickerType[]> {
    const conditions: SQL[] = [eq(entities.company_id, companyId), eq(entities.is_active, true)];

    if (search && search.length >= 1) {
        const term = `%${search}%`;
        const searchCond = or(
            ilike(entities.business_name, term),
            ilike(entities.tax_id, term)
        );
        if (searchCond) conditions.push(searchCond);
    }

    const rows = await db
        .select({
            id: entities.id,
            businessName: entities.business_name,
            taxId: entities.tax_id,
        })
        .from(entities)
        .where(and(...conditions))
        .orderBy(asc(entities.business_name))
        .limit(Math.min(limit, 500));

    return rows;
}
