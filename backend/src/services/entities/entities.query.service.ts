import { and, desc, eq, ilike, or, sql, lt, gt, asc, inArray, count, type AnyColumn } from '@app/schema';
import { db } from '../../db';
import { entities, entityAddresses, entityContacts, employeeDetails } from '@app/schema/tables';
import { DomainError } from '../errors';
import { cacheService } from '../cache.service';
import { createHash } from 'crypto';
import type { TaxIdType, PersonType, TaxRegimeType } from '@app/schema/enums';

// Entity type discriminator
export type EntityType = 'client' | 'supplier' | 'employee' | 'carrier';

// Re-export imported types for consumers
export type { TaxIdType, PersonType, TaxRegimeType };

export interface ContactPayload {
    name: string;
    position?: string;
    email?: string;
    phone?: string;
    isPrimary?: boolean;
}

export interface AddressPayload {
    addressLine: string;
    city?: string;
    country?: string;
    countryCode?: string;
    postalCode?: string;
    isMain?: boolean;
}

export interface EntityPayload {
    taxId: string;
    taxIdType: TaxIdType;
    personType?: PersonType;
    businessName: string;
    tradeName?: string;
    emailBilling?: string;
    phone?: string;
    taxRegimeType?: TaxRegimeType;
    obligadoContabilidad?: boolean;
    parteRelacionada?: boolean;
    // Employee specific
    department?: string;
    jobTitle?: string;
    salaryBase?: number;
    hireDate?: string;
    costPerHour?: number;
    isClient?: boolean;
    isSupplier?: boolean;
    isEmployee?: boolean;
    isCarrier?: boolean;
    // New relations
    isRetentionAgent?: boolean;
    isSpecialContributor?: boolean;
    contacts?: ContactPayload[];
    addresses?: AddressPayload[];
}

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

export interface PaginationMeta {
    nextCursor: string | null;
    prevCursor: string | null;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    total: number;
    page: number | null;
    pageCount: number | null;
}

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
// Helpers
// =============================================================================

export function encodeCursor(id: number): string {
    return Buffer.from(JSON.stringify({ id })).toString('base64url');
}

export function decodeCursor(cursor: string): CursorData | null {
    try {
        const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

export function hashKey(obj: Record<string, unknown>): string {
    return createHash('md5').update(JSON.stringify(obj)).digest('hex').slice(0, 12);
}

// =============================================================================
// Shared Filter Builder
// =============================================================================

export interface FilterBuildOptions {
    companyId: number;
    type: EntityType;
    search?: string;
    isCarrier?: boolean;
    columnFilters?: ColumnFilters;
    excludeColumn?: string;
}

export function buildWhereConditions(opts: FilterBuildOptions) {
    const conditions = [];
    conditions.push(eq(entities.company_id, opts.companyId));

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

    const cf = opts.columnFilters;
    const exclude = opts.excludeColumn;

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
// List Entities
// =============================================================================

export async function listEntities(type: EntityType, filters: ListFilters, companyId: number) {
    const { sortBy } = filters;
    if (sortBy && sortBy !== 'id' && SORTABLE_COLUMNS[sortBy]) {
        return listEntitiesSorted(type, filters, companyId);
    }
    return listEntitiesCursor(type, filters, companyId);
}

export async function listEntitiesCursor(type: EntityType, filters: ListFilters, companyId: number) {
    const { cursor, limit: limitRaw = 25, search, isCarrier, direction = 'first', ...rest } = filters;
    const { sortBy, sortOrder, page, ...columnFilters } = rest;
    const limit = Number(limitRaw);
    const cacheKey = `${type}s:c${companyId}:list:${hashKey({ cursor, limit, search, direction, ...columnFilters })}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const conditions = buildWhereConditions({ companyId, type, search, isCarrier, columnFilters });

        const total = await getCachedTotal(companyId, type, search, isCarrier, columnFilters);

        let effectiveLimit = limit;
        if (direction === 'last') {
            const remainder = total % limit;
            effectiveLimit = remainder === 0 ? limit : remainder;
        }

        const { minId, maxId } = await getCachedBounds(companyId, type, search, isCarrier, columnFilters);

        const cursorData = cursor ? decodeCursor(cursor) : null;
        if (cursorData) {
            if (direction === 'next') conditions.push(lt(entities.id, cursorData.id));
            else if (direction === 'prev') conditions.push(gt(entities.id, cursorData.id));
        }

        const whereClause = and(...conditions);
        const fetchLimit = effectiveLimit + 1;
        const isDescending = direction === 'first' || direction === 'next';

        let data = await db
            .select()
            .from(entities)
            .where(whereClause)
            .limit(fetchLimit)
            .orderBy(isDescending ? desc(entities.id) : asc(entities.id));

        const hasMore = data.length > effectiveLimit;
        if (hasMore) data = data.slice(0, effectiveLimit);
        if (direction === 'prev' || direction === 'last') data = data.reverse();

        const meta: PaginationMeta = {
            nextCursor: null, prevCursor: null,
            hasNextPage: false, hasPrevPage: false,
            total, page: null, pageCount: null,
        };

        if (data.length > 0) {
            const firstItem = data[0];
            const lastItem = data[data.length - 1];
            const firstCursor = encodeCursor(firstItem.id);
            const lastCursor = encodeCursor(lastItem.id);

            meta.hasPrevPage = firstItem.id < maxId;
            meta.prevCursor = meta.hasPrevPage ? firstCursor : null;
            meta.hasNextPage = lastItem.id > minId;
            meta.nextCursor = meta.hasNextPage ? lastCursor : null;
        }

        return { data, meta };
    }, 120);
}

export async function listEntitiesSorted(type: EntityType, filters: ListFilters, companyId: number) {
    const {
        limit: limitRaw = 25, search, isCarrier,
        sortBy = 'business_name', sortOrder = 'asc',
        page: pageRaw = 1,
        ...rest
    } = filters;
    const { cursor, direction, ...columnFilters } = rest;
    const limit = Number(limitRaw);
    const page = Math.max(1, Number(pageRaw));
    const offset = (page - 1) * limit;

    const cacheKey = `${type}s:c${companyId}:sorted:${hashKey({ limit, search, sortBy, sortOrder, page, ...columnFilters })}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const conditions = buildWhereConditions({ companyId, type, search, isCarrier, columnFilters });

        const total = await getCachedTotal(companyId, type, search, isCarrier, columnFilters);
        const pageCount = Math.ceil(total / limit);

        const sortColumn = SORTABLE_COLUMNS[sortBy]!;
        const orderFn = sortOrder === 'desc' ? desc : asc;
        const orderClauses = [orderFn(sortColumn), orderFn(entities.id)]; 

        const idRows = await db
            .select({ id: entities.id })
            .from(entities)
            .where(and(...conditions))
            .orderBy(...orderClauses)
            .limit(limit)
            .offset(offset);

        if (idRows.length === 0) {
            return {
                data: [],
                meta: {
                    nextCursor: null, prevCursor: null,
                    hasNextPage: false, hasPrevPage: false,
                    total, page, pageCount,
                } as PaginationMeta,
            };
        }

        const ids = idRows.map(r => r.id);

        const rows = await db
            .select()
            .from(entities)
            .where(inArray(entities.id, ids));

        const idOrder = new Map(ids.map((id, i) => [id, i]));
        const data = rows.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

        const meta: PaginationMeta = {
            nextCursor: null,
            prevCursor: null,
            hasNextPage: page < pageCount,
            hasPrevPage: page > 1,
            total,
            page,
            pageCount,
        };

        return { data, meta };
    }, 120);
}

export async function getCachedTotal(
    companyId: number, type: EntityType, search?: string, isCarrier?: boolean, columnFilters?: ColumnFilters
) {
    const totalCacheKey = `${type}s:c${companyId}:total:${hashKey({ search: search || 'all', ...columnFilters })}`;
    return cacheService.getOrSet(totalCacheKey, async () => {
        const conditions = buildWhereConditions({ companyId, type, search, isCarrier, columnFilters });
        const [{ count: cnt }] = await db
            .select({ count: sql<number>`count(*)`.mapWith(Number) })
            .from(entities)
            .where(and(...conditions));
        return cnt;
    }, 120);
}

export async function getCachedBounds(
    companyId: number, type: EntityType, search?: string, isCarrier?: boolean, columnFilters?: ColumnFilters
) {
    const boundaryCacheKey = `${type}s:c${companyId}:bounds:${hashKey({ search: search || 'all', ...columnFilters })}`;
    return cacheService.getOrSet(boundaryCacheKey, async () => {
        const conditions = buildWhereConditions({ companyId, type, search, isCarrier, columnFilters });
        const [result] = await db
            .select({
                minId: sql<number>`min(\${entities.id})`.mapWith(Number),
                maxId: sql<number>`max(\${entities.id})`.mapWith(Number),
            })
            .from(entities)
            .where(and(...conditions));
        return result || { minId: 0, maxId: 0 };
    }, 120);
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
    const { search, isCarrier, ...columnFilters } = filters;
    const cacheKey = `${type}s:c${companyId}:facets:${hashKey({ columns, search, ...columnFilters })}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const columnMap: Record<FacetColumn, any> = {
            person_type: entities.person_type,
            tax_id_type: entities.tax_id_type,
            is_active: entities.is_active,
            business_name: entities.business_name,
        };

        const results: Record<string, { value: string; count: number }[]> = {};

        await Promise.all(
            columns.map(async (col) => {
                const dbCol = columnMap[col];
                if (!dbCol) return;

                const excludeKey = FACET_TO_FILTER_KEY[col];
                const conditions = buildWhereConditions({
                    companyId,
                    type,
                    search,
                    isCarrier,
                    columnFilters,
                    excludeColumn: excludeKey,
                });

                const rows = await db
                    .select({
                        value: sql<string>`CAST(${dbCol} AS TEXT)`,
                        count: sql<number>`count(*)`.mapWith(Number),
                    })
                    .from(entities)
                    .where(and(...conditions))
                    .groupBy(dbCol)
                    .orderBy(desc(sql`count(*)`));

                results[col] = rows.filter(r => r.value !== null);
            })
        );

        return results;
    }, 300);
}

// =============================================================================
// Get Single Entity
// =============================================================================

export async function getEntity(id: number, companyId?: number) {
    const cacheKey = `entity:${id}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const conditions = [eq(entities.id, id)];
        if (companyId) conditions.push(eq(entities.company_id, companyId));
        const [entity] = await db.select().from(entities).where(and(...conditions));
        if (!entity) throw new DomainError('Entidad no encontrada', 404);

        const [addresses, contacts] = await Promise.all([
            db.select().from(entityAddresses).where(eq(entityAddresses.entity_id, id)),
            db.select().from(entityContacts).where(eq(entityContacts.entity_id, id)),
        ]);

        let details = null;
        if (entity.is_employee) {
            const [empDetails] = await db
                .select()
                .from(employeeDetails)
                .where(eq(employeeDetails.entity_id, id));
            details = empDetails || null;
        }

        return { ...entity, addresses, contacts, employeeDetails: details };
    }, 3600);
}

export async function getContacts(entityId: number) {
    return db.select().from(entityContacts).where(eq(entityContacts.entity_id, entityId));
}

export async function getAddresses(entityId: number) {
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
