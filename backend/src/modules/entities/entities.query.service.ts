import { alias, and, eq, ilike, or, asc, inArray, isNotNull, type AnyColumn, type SQL, type PgColumn } from '@app/schema';
import { db } from '../../core/db';
import { entities, entityAddresses, entityContacts, employeeDetails, carrierVehicles, carrierDrivers, departments, jobTitles } from '@app/schema/tables';
import { DomainError } from '../../core/errors';
import { cacheService } from '../../core/cache';
import { CursorPaginator } from '../../core/db/paginator';
import type { EntityPickerType, EntityFilters } from '@app/schema/dto';
import type { EntityType } from '@app/schema/enums';

export const ROLE_COLUMN_KEYS = {
    client: 'is_client',
    supplier: 'is_supplier',
    employee: 'is_employee',
    carrier: 'is_carrier',
} as const satisfies Record<EntityType, 'is_client' | 'is_supplier' | 'is_employee' | 'is_carrier'>;

export type EntityRoleKey = typeof ROLE_COLUMN_KEYS[EntityType];

export function getRoleKey(type: EntityType): EntityRoleKey {
    return ROLE_COLUMN_KEYS[type];
}

export function getRoleColumn(type: EntityType) {
    return entities[ROLE_COLUMN_KEYS[type]];
}

export function getSortableColumns(type: EntityType): Record<string, AnyColumn> {
    return {
        id: entities.id,
        business_name: entities.business_name,
        tax_id: entities.tax_id,
        person_type: entities.person_type,
        tax_id_type: entities.tax_id_type,
        is_active: getRoleColumn(type),
        created_at: entities.created_at,
    };
}

export const SORTABLE_COLUMNS = getSortableColumns('client');

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

    const cf = opts.filters;
    const exclude = opts.excludeFilterKey || opts.excludeColumn;

    if (opts.type) {
        const roleCol = getRoleColumn(opts.type);

        if (opts.type === 'employee' && opts.isCarrier !== undefined) {
            conditions.push(eq(entities.is_carrier, opts.isCarrier));
        }

        if (exclude !== 'isActive') {
            const activeFilters = cf?.isActive;
            if (activeFilters && activeFilters.length > 0) {
                const hasTrue = activeFilters.includes('true');
                const hasFalse = activeFilters.includes('false');

                if (hasTrue && hasFalse) {
                    // Muestra tanto activos como inactivos de este rol
                    conditions.push(isNotNull(roleCol));
                } else if (hasTrue) {
                    conditions.push(eq(roleCol, true));
                } else if (hasFalse) {
                    conditions.push(eq(roleCol, false));
                }
            } else {
                // Por defecto (sin filtro explícito): solo activos
                conditions.push(eq(roleCol, true));
            }
        } else {
            // Durante cálculo de facetas para isActive: incluir todos los que tienen este rol (true o false)
            conditions.push(isNotNull(roleCol));
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
        sortableColumns: getSortableColumns(type),
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

export function mapEntityRow<T extends Record<string, unknown>>(row: T, type: EntityType) {
    const roleKey = ROLE_COLUMN_KEYS[type];
    const roleValue = row[roleKey];

    return {
        ...row,
        is_active: roleValue === true,
    };
}

export async function listEntities(type: EntityType, filters: EntityFilters, companyId: number) {
    const paginator = entityPaginators[type] || createEntityPaginator(type);
    const { cursor, direction, limit, search, isCarrier, sortBy, sortOrder, page, ...columnFilters } = filters;
    const result = await paginator.paginate(
        { cursor, direction, limit, search, sortBy, sortOrder, page, filters: { ...columnFilters, isCarrier } },
        companyId
    );
    return {
        ...result,
        data: result.data.map(item => mapEntityRow(item as Record<string, unknown>, type)),
    };
}

export async function listEntitiesCursor(type: EntityType, filters: EntityFilters, companyId: number) {
    const paginator = entityPaginators[type] || createEntityPaginator(type);
    const { cursor, direction, limit, search, isCarrier, sortBy, sortOrder, page, ...columnFilters } = filters;
    const result = await paginator.paginateCursor(
        { cursor, direction, limit, search, sortBy, sortOrder, page, filters: { ...columnFilters, isCarrier } },
        companyId
    );
    return {
        ...result,
        data: result.data.map(item => mapEntityRow(item as Record<string, unknown>, type)),
    };
}

export async function listEntitiesSorted(type: EntityType, filters: EntityFilters, companyId: number) {
    const paginator = entityPaginators[type] || createEntityPaginator(type);
    const { cursor, direction, limit, search, isCarrier, sortBy, sortOrder, page, ...columnFilters } = filters;
    const result = await paginator.paginateSorted(
        { cursor, direction, limit, search, sortBy, sortOrder, page, filters: { ...columnFilters, isCarrier } },
        companyId
    );
    return {
        ...result,
        data: result.data.map(item => mapEntityRow(item as Record<string, unknown>, type)),
    };
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
    const roleCol = getRoleColumn(type);
    const columnMap: Record<FacetColumn, PgColumn<any>> = {
        person_type: entities.person_type,
        tax_id_type: entities.tax_id_type,
        is_active: roleCol,
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

        const supervisors = alias(entities, 'supervisors');
        const [addresses, contacts, vehicles, drivers, [empDetails]] = await Promise.all([
            db.select().from(entityAddresses).where(eq(entityAddresses.entity_id, id)),
            db.select().from(entityContacts).where(eq(entityContacts.entity_id, id)),
            entity.is_carrier != null ? db.select().from(carrierVehicles).where(eq(carrierVehicles.carrier_id, id)) : Promise.resolve([]),
            entity.is_carrier != null ? db.select().from(carrierDrivers).where(eq(carrierDrivers.carrier_id, id)) : Promise.resolve([]),
            entity.is_employee != null ? db
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
                    salary_type: employeeDetails.salary_type,
                    salary_base: employeeDetails.salary_base,
                    cost_per_hour: employeeDetails.cost_per_hour,
                    accumulate_thirteenth: employeeDetails.accumulate_thirteenth,
                    accumulate_fourteenth: employeeDetails.accumulate_fourteenth,
                    accumulate_reserve_funds: employeeDetails.accumulate_reserve_funds,
                    iess_code: employeeDetails.iess_code,
                    dependents_count: employeeDetails.dependents_count,
                    bank_name: employeeDetails.bank_name,
                    bank_account_type: employeeDetails.bank_account_type,
                    bank_account_number: employeeDetails.bank_account_number,
                    notes: employeeDetails.notes,
                })
                .from(employeeDetails)
                .leftJoin(departments, eq(employeeDetails.department_id, departments.id))
                .leftJoin(jobTitles, eq(employeeDetails.job_title_id, jobTitles.id))
                .leftJoin(supervisors, eq(employeeDetails.reports_to, supervisors.id))
                .where(eq(employeeDetails.entity_id, id)) : Promise.resolve([]),
        ]);

        const isEntityActive = (
            entity.is_client === true ||
            entity.is_supplier === true ||
            entity.is_employee === true ||
            entity.is_carrier === true
        );

        return { ...entity, is_active: isEntityActive, addresses, contacts, employeeDetails: empDetails || null, vehicles, drivers };
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

export interface ListForPickerOptions {
    search?: string;
    limit?: number;
    type?: EntityType;
    isClient?: boolean;
    isSupplier?: boolean;
    isEmployee?: boolean;
    isCarrier?: boolean;
    isActive?: boolean;
}

export async function listForPicker(companyId: number, options: ListForPickerOptions = {}): Promise<EntityPickerType[]> {
    const {
        search,
        limit = 200,
        type,
        isClient,
        isSupplier,
        isEmployee,
        isCarrier,
        isActive = true,
    } = options;

    const conditions: SQL[] = [eq(entities.company_id, companyId)];

    if (type) {
        const roleCol = getRoleColumn(type);
        conditions.push(isActive ? eq(roleCol, true) : isNotNull(roleCol));
    } else if (isActive) {
        const activeRole = or(
            eq(entities.is_client, true),
            eq(entities.is_supplier, true),
            eq(entities.is_employee, true),
            eq(entities.is_carrier, true)
        );
        if (activeRole) conditions.push(activeRole);
    }

    if (isClient !== undefined) conditions.push(eq(entities.is_client, isClient));
    if (isSupplier !== undefined) conditions.push(eq(entities.is_supplier, isSupplier));
    if (isEmployee !== undefined) conditions.push(eq(entities.is_employee, isEmployee));
    if (isCarrier !== undefined) conditions.push(eq(entities.is_carrier, isCarrier));

    if (search && search.length >= 1) {
        const term = `%${search.trim()}%`;
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
            taxIdType: entities.tax_id_type,
            personType: entities.person_type,
            isClient: entities.is_client,
            isSupplier: entities.is_supplier,
            isEmployee: entities.is_employee,
            isCarrier: entities.is_carrier,
        })
        .from(entities)
        .where(and(...conditions))
        .orderBy(asc(entities.business_name))
        .limit(Math.min(limit, 500));

    return rows;
}
