import { and, eq, ilike, or, asc, inArray, count, type AnyColumn } from '@app/schema';
import { db } from '../../core/db';
import { entities, entityAddresses, entityContacts, employeeDetails, carrierVehicles, carrierDrivers } from '@app/schema/tables';
import { DomainError } from '../../core/errors';
import { cacheService } from '../../core/cache';
import type { TaxIdType, PersonType, TaxRegimeType } from '@app/schema/enums';
import type { EntityPayload, EntityContactPayload as ContactPayload, EntityAddressPayload as AddressPayload } from '@app/schema/shared-dto';

// Entity type discriminator
export type EntityType = 'client' | 'supplier' | 'employee' | 'carrier';

// Re-export imported types for consumers
export type { TaxIdType, PersonType, TaxRegimeType };
export type { EntityPayload, ContactPayload, AddressPayload };

// =============================================================================
// Pagination Types
// =============================================================================

export interface CursorData {
    id: number;
}

export interface ColumnFilters {
    personType?: string[];
    taxIdType?: string[];
    isActive?: string[];
    businessName?: string[];
}

export interface ListFilters extends ColumnFilters {
    cursor?: string;
    limit?: number;
    search?: string;
    isCarrier?: boolean;
    direction?: 'next' | 'prev' | 'first' | 'last';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
}

import { CursorPaginator } from '../../core/db/paginator';

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
    filters?: ColumnFilters & { isCarrier?: boolean };
    columnFilters?: ColumnFilters;
    excludeColumn?: string;
    excludeFilterKey?: string;
}

export function buildWhereConditions(opts: FilterBuildOptions) {
    const conditions = [];
    conditions.push(eq(entities.company_id, opts.companyId));

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
        conditions.push(
            or(
                ilike(entities.business_name, pattern),
                ilike(entities.tax_id, pattern),
                ilike(entities.trade_name, pattern)
            )
        );
    }

    const cf = opts.filters || opts.columnFilters;
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
        conditions.push(inArray(entities.person_type, cf.personType as any));
    }
    if (exclude !== 'taxIdType' && cf?.taxIdType && cf.taxIdType.length > 0) {
        conditions.push(inArray(entities.tax_id_type, cf.taxIdType as any));
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
    return new CursorPaginator<typeof entities, ColumnFilters & { isCarrier?: boolean }>({
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

const entityPaginators: Record<EntityType, CursorPaginator<typeof entities, ColumnFilters & { isCarrier?: boolean }>> = {
    client: createEntityPaginator('client'),
    supplier: createEntityPaginator('supplier'),
    employee: createEntityPaginator('employee'),
    carrier: createEntityPaginator('carrier'),
};

// =============================================================================
// List Entities
// =============================================================================

export async function listEntities(type: EntityType, filters: ListFilters, companyId: number) {
    const paginator = entityPaginators[type] || createEntityPaginator(type);
    const { cursor, direction, limit, search, isCarrier, sortBy, sortOrder, page, ...columnFilters } = filters;
    return paginator.paginate(
        { cursor, direction, limit, search, sortBy, sortOrder, page, filters: { ...columnFilters, isCarrier } },
        companyId
    );
}

export async function listEntitiesCursor(type: EntityType, filters: ListFilters, companyId: number) {
    const paginator = entityPaginators[type] || createEntityPaginator(type);
    const { cursor, direction, limit, search, isCarrier, sortBy, sortOrder, page, ...columnFilters } = filters;
    return paginator.paginateCursor(
        { cursor, direction, limit, search, sortBy, sortOrder, page, filters: { ...columnFilters, isCarrier } },
        companyId
    );
}

export async function listEntitiesSorted(type: EntityType, filters: ListFilters, companyId: number) {
    const paginator = entityPaginators[type] || createEntityPaginator(type);
    const { cursor, direction, limit, search, isCarrier, sortBy, sortOrder, page, ...columnFilters } = filters;
    return paginator.paginateSorted(
        { cursor, direction, limit, search, sortBy, sortOrder, page, filters: { ...columnFilters, isCarrier } },
        companyId
    );
}

export async function getCachedTotal(
    companyId: number, type: EntityType, search?: string, isCarrier?: boolean, columnFilters?: ColumnFilters
) {
    const paginator = entityPaginators[type] || createEntityPaginator(type);
    return paginator.getCachedTotal(companyId, search, { ...columnFilters, isCarrier });
}

export async function getCachedBounds(
    companyId: number, type: EntityType, search?: string, isCarrier?: boolean, columnFilters?: ColumnFilters
) {
    const paginator = entityPaginators[type] || createEntityPaginator(type);
    return paginator.getCachedBounds(companyId, search, { ...columnFilters, isCarrier });
}

// =============================================================================
// Get Entity Facets
// =============================================================================

export type FacetColumn = 'person_type' | 'tax_id_type' | 'is_active' | 'business_name';

export const FACET_TO_FILTER_KEY: Record<FacetColumn, keyof ColumnFilters> = {
    person_type: 'personType',
    tax_id_type: 'taxIdType',
    is_active: 'isActive',
    business_name: 'businessName',
};

export interface FacetFilters extends ColumnFilters {
    search?: string;
    isCarrier?: boolean;
}

export async function getEntityFacets(
    type: EntityType,
    columns: FacetColumn[],
    filters: FacetFilters,
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

export async function getEntity(id: number, companyId?: number) {
    const cacheKey = companyId ? `entity:c${companyId}:${id}` : `entity:${id}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const conditions = [eq(entities.id, id)];
        if (companyId) conditions.push(eq(entities.company_id, companyId));
        const [entity] = await db.select().from(entities).where(and(...conditions));
        if (!entity) throw new DomainError('Entidad no encontrada', 404);

        const [addresses, contacts, vehicles, drivers] = await Promise.all([
            db.select().from(entityAddresses).where(eq(entityAddresses.entity_id, id)),
            db.select().from(entityContacts).where(eq(entityContacts.entity_id, id)),
            entity.is_carrier ? db.select().from(carrierVehicles).where(eq(carrierVehicles.carrier_id, id)) : Promise.resolve([]),
            entity.is_carrier ? db.select().from(carrierDrivers).where(eq(carrierDrivers.carrier_id, id)) : Promise.resolve([]),
        ]);

        let details = null;
        if (entity.is_employee) {
            const [empDetails] = await db
                .select()
                .from(employeeDetails)
                .where(eq(employeeDetails.entity_id, id));
            details = empDetails || null;
        }

        return { ...entity, addresses, contacts, employeeDetails: details, vehicles, drivers };
    }, 3600);
}

export async function getContacts(entityId: number, companyId?: number) {
    if (companyId) {
        const [ent] = await db
            .select({ id: entities.id })
            .from(entities)
            .where(and(eq(entities.id, entityId), eq(entities.company_id, companyId)));
        if (!ent) throw new DomainError('Entidad no encontrada', 404);
    }
    return db.select().from(entityContacts).where(eq(entityContacts.entity_id, entityId));
}

export async function getAddresses(entityId: number, companyId?: number) {
    if (companyId) {
        const [ent] = await db
            .select({ id: entities.id })
            .from(entities)
            .where(and(eq(entities.id, entityId), eq(entities.company_id, companyId)));
        if (!ent) throw new DomainError('Entidad no encontrada', 404);
    }
    return db.select().from(entityAddresses).where(eq(entityAddresses.entity_id, entityId));
}

export async function listForPicker(companyId: number, search?: string, limit: number = 200) {
    const conditions = [eq(entities.company_id, companyId), eq(entities.is_active, true)];

    if (search && search.length >= 1) {
        const term = `%${search}%`;
        conditions.push(
            or(
                ilike(entities.business_name, term),
                ilike(entities.tax_id, term),
            )!,
        );
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
