import { and, desc, eq, ilike, or, sql, lt, gt, asc, inArray, type AnyColumn } from '@app/schema';
import { db } from '../db';
import { entities, entityAddresses, employeeDetails, entityContacts } from '@app/schema/tables';
import { DomainError } from './errors';
import { cacheService } from './cache.service';
import { broadcast } from '../plugins/ws';
import { WsEvents } from '@app/schema/ws-events';
import { createHash } from 'crypto';
import type { TaxIdType, PersonType, SriContributorType } from '@app/schema/enums';

// Entity type discriminator
export type EntityType = 'client' | 'supplier' | 'employee' | 'carrier';

// Re-export imported types for consumers of this service
export type { TaxIdType, PersonType, SriContributorType };

export interface EntityPayload {
    taxId: string;
    taxIdType: TaxIdType;
    personType?: PersonType;
    businessName: string;
    tradeName?: string;
    emailBilling: string;
    phone?: string;
    addressFiscal: string;
    sriContributorType?: SriContributorType;
    obligadoContabilidad?: boolean;
    parteRelacionada?: boolean;
    // Employee specific
    department?: string;
    jobTitle?: string;
    salaryBase?: number;
    hireDate?: string;
    costPerHour?: number;
    isCarrier?: boolean;
}

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
    isMain?: boolean;
}

// =============================================================================
// Pagination Types
// =============================================================================

/** Simplified cursor — only needs the sort key (id) */
interface CursorData {
    id: number;
}

interface ColumnFilters {
    personType?: string[];
    taxIdType?: string[];
    isActive?: string[];
    businessName?: string[];
}

interface ListFilters extends ColumnFilters {
    cursor?: string;
    limit?: number;
    search?: string;
    isCarrier?: boolean;
    direction?: 'next' | 'prev' | 'first' | 'last';
    /** Server-side sorting */
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    /** Page number for offset mode (1-indexed) */
    page?: number;
}

interface PaginationMeta {
    // Cursor fields (used when sorting by id / default)
    nextCursor: string | null;
    prevCursor: string | null;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    total: number;
    // Offset fields (used when sorting by custom column)
    page: number | null;
    pageCount: number | null;
}

/** Whitelist of sortable columns to prevent SQL injection */
const SORTABLE_COLUMNS: Record<string, AnyColumn> = {
    id: entities.id,
    business_name: entities.business_name,
    tax_id: entities.tax_id,
    person_type: entities.person_type,
    tax_id_type: entities.tax_id_type,
    is_active: entities.is_active,
    created_at: entities.created_at,
};

// =============================================================================
// Cursor Helpers
// =============================================================================

function encodeCursor(id: number): string {
    return Buffer.from(JSON.stringify({ id })).toString('base64url');
}

function decodeCursor(cursor: string): CursorData | null {
    try {
        const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

/** Generate short hash for cache keys to avoid key explosion */
function hashKey(obj: Record<string, unknown>): string {
    return createHash('md5').update(JSON.stringify(obj)).digest('hex').slice(0, 12);
}

// Helper for numeric conversion
const toDecimal = (val?: number | null): string | undefined =>
    val !== undefined && val !== null ? val.toString() : undefined;

/** Filter out undefined values to prevent Drizzle from setting columns to NULL */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== undefined)
    ) as Partial<T>;
}

// =============================================================================
// Shared Filter Builder (DRY — used by list, count, and facets)
// =============================================================================

interface FilterBuildOptions {
    type: EntityType;
    search?: string;
    isCarrier?: boolean;
    /** Column filters to apply */
    columnFilters?: ColumnFilters;
    /** Column to exclude from filters (for cross-filtering in facets) */
    excludeColumn?: string;
}

/**
 * Build WHERE conditions shared across list, count, and facet queries.
 * Single source of truth for all entity filtering logic.
 */
function buildWhereConditions(opts: FilterBuildOptions) {
    const conditions = [];

    // Type filter
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

    // Search filter
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

    // is_active filter (default to active-only if not filtered)
    if (exclude !== 'isActive') {
        if (cf?.isActive && cf.isActive.length > 0) {
            const boolValues = cf.isActive.map(v => v === 'true');
            if (boolValues.length === 1) {
                conditions.push(eq(entities.is_active, boolValues[0]));
            }
            // If both true and false are selected, no filter needed
        } else {
            conditions.push(eq(entities.is_active, true));
        }
    }

    // Column filters
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
// List Entities — Router (delegates to cursor or offset strategy)
// =============================================================================

/**
 * List entities by type with hybrid pagination:
 * - Default (sort by id): Keyset/cursor pagination (O(1))
 * - Custom sort column: Offset pagination with Deferred Join
 */
export async function listEntities(type: EntityType, filters: ListFilters) {
    const { sortBy } = filters;

    // If sorting by a custom column (not id), use offset pagination
    if (sortBy && sortBy !== 'id' && SORTABLE_COLUMNS[sortBy]) {
        return listEntitiesSorted(type, filters);
    }

    // Default: keyset cursor pagination
    return listEntitiesCursor(type, filters);
}

// =============================================================================
// Strategy 1: Keyset Cursor Pagination (default, sort by id)
// =============================================================================

async function listEntitiesCursor(type: EntityType, filters: ListFilters) {
    const { cursor, limit: limitRaw = 25, search, isCarrier, direction = 'first', ...rest } = filters;
    const { sortBy, sortOrder, page, ...columnFilters } = rest;
    const limit = Number(limitRaw);
    const cacheKey = `${type}s:list:${hashKey({ cursor, limit, search, direction, ...columnFilters })}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const conditions = buildWhereConditions({ type, search, isCarrier, columnFilters });

        // 1. Total count
        const total = await getCachedTotal(type, search, isCarrier, columnFilters);

        // 2. Adjust limit for 'last' page
        let effectiveLimit = limit;
        if (direction === 'last') {
            const remainder = total % limit;
            effectiveLimit = remainder === 0 ? limit : remainder;
        }

        // 3. Boundary checks (min/max ID)
        const { minId, maxId } = await getCachedBounds(type, search, isCarrier, columnFilters);

        // Cursor condition
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

        // Build meta
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

// =============================================================================
// Strategy 2: Offset Pagination with Deferred Join (custom sort column)
// =============================================================================

/**
 * Offset-based pagination using the Deferred Join pattern:
 * Step 1: SELECT id FROM entities WHERE ... ORDER BY <sort>, id LIMIT x OFFSET y
 * Step 2: SELECT * FROM entities WHERE id IN (...ids) ORDER BY <sort>, id
 * 
 * This avoids reading full rows for skipped offset rows.
 */
async function listEntitiesSorted(type: EntityType, filters: ListFilters) {
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

    const cacheKey = `${type}s:sorted:${hashKey({ limit, search, sortBy, sortOrder, page, ...columnFilters })}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const conditions = buildWhereConditions({ type, search, isCarrier, columnFilters });

        // Total count (shared cache)
        const total = await getCachedTotal(type, search, isCarrier, columnFilters);
        const pageCount = Math.ceil(total / limit);

        // Resolve sort column reference (safe — already validated via SORTABLE_COLUMNS)
        const sortColumn = SORTABLE_COLUMNS[sortBy]!;
        const orderFn = sortOrder === 'desc' ? desc : asc;
        const orderClauses = [orderFn(sortColumn), orderFn(entities.id)]; // tiebreaker

        // Step 1: Deferred Join — lightweight ID-only scan
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

        // Step 2: Full row fetch by known IDs, then re-sort in application
        const rows = await db
            .select()
            .from(entities)
            .where(inArray(entities.id, ids));

        // Re-apply sort order in memory (SQL IN doesn't guarantee order)
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

// =============================================================================
// Shared Cached Helpers (DRY — used by both cursor and offset strategies)
// =============================================================================

async function getCachedTotal(
    type: EntityType, search?: string, isCarrier?: boolean, columnFilters?: ColumnFilters
) {
    const totalCacheKey = `${type}s:total:${hashKey({ search: search || 'all', ...columnFilters })}`;
    return cacheService.getOrSet(totalCacheKey, async () => {
        const conditions = buildWhereConditions({ type, search, isCarrier, columnFilters });
        const [{ count }] = await db
            .select({ count: sql<number>`count(*)`.mapWith(Number) })
            .from(entities)
            .where(and(...conditions));
        return count;
    }, 120);
}

async function getCachedBounds(
    type: EntityType, search?: string, isCarrier?: boolean, columnFilters?: ColumnFilters
) {
    const boundaryCacheKey = `${type}s:bounds:${hashKey({ search: search || 'all', ...columnFilters })}`;
    return cacheService.getOrSet(boundaryCacheKey, async () => {
        const conditions = buildWhereConditions({ type, search, isCarrier, columnFilters });
        const [result] = await db
            .select({
                minId: sql<number>`min(${entities.id})`.mapWith(Number),
                maxId: sql<number>`max(${entities.id})`.mapWith(Number),
            })
            .from(entities)
            .where(and(...conditions));
        return result || { minId: 0, maxId: 0 };
    }, 120);
}

// =============================================================================
// Get Entity Facets (Filter option values + counts)
// =============================================================================

type FacetColumn = 'person_type' | 'tax_id_type' | 'is_active' | 'business_name';

/** Map facet column names to their ColumnFilters key for cross-filtering */
const FACET_TO_FILTER_KEY: Record<FacetColumn, keyof ColumnFilters> = {
    person_type: 'personType',
    tax_id_type: 'taxIdType',
    is_active: 'isActive',
    business_name: 'businessName',
};

interface FacetFilters extends ColumnFilters {
    search?: string;
    isCarrier?: boolean;
}

/**
 * Get distinct values + counts for filterable columns.
 * Uses cross-filtering: each column's facet excludes its own filter
 * to show available options that would produce results.
 */
export async function getEntityFacets(
    type: EntityType,
    columns: FacetColumn[],
    filters: FacetFilters
): Promise<Record<string, { value: string; count: number }[]>> {
    const { search, isCarrier, ...columnFilters } = filters;
    const cacheKey = `${type}s:facets:${hashKey({ columns, search, ...columnFilters })}`;

    return cacheService.getOrSet(cacheKey, async () => {
        // Column mapping to drizzle columns
        const columnMap: Record<FacetColumn, any> = {
            person_type: entities.person_type,
            tax_id_type: entities.tax_id_type,
            is_active: entities.is_active,
            business_name: entities.business_name,
        };

        const results: Record<string, { value: string; count: number }[]> = {};

        // Run one query per facet column in parallel, each cross-filtered
        await Promise.all(
            columns.map(async (col) => {
                const dbCol = columnMap[col];
                if (!dbCol) return;

                // Cross-filter: apply all filters EXCEPT this column's own filter
                const excludeKey = FACET_TO_FILTER_KEY[col];
                const conditions = buildWhereConditions({
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

/**
 * Get single entity by ID with addresses and contacts
 */
export async function getEntity(id: number) {
    const cacheKey = `entity:${id}`;

    return cacheService.getOrSet(cacheKey, async () => {
        const [entity] = await db.select().from(entities).where(eq(entities.id, id));
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

// =============================================================================
// Create Entity
// =============================================================================

/**
 * Create entity with type flags
 */
export async function createEntity(type: EntityType, payload: EntityPayload) {
    const existing = await db
        .select({ id: entities.id })
        .from(entities)
        .where(eq(entities.tax_id, payload.taxId));

    if (existing.length) {
        throw new DomainError('El número de identificación ya está registrado', 409);
    }

    return db.transaction(async (tx) => {
        const [created] = await tx
            .insert(entities)
            .values({
                tax_id: payload.taxId,
                tax_id_type: payload.taxIdType,
                person_type: payload.personType ?? 'NATURAL',
                business_name: payload.businessName,
                trade_name: payload.tradeName,
                email_billing: payload.emailBilling,
                phone: payload.phone,
                address_fiscal: payload.addressFiscal,
                sri_contributor_type: payload.sriContributorType,
                obligado_contabilidad: payload.obligadoContabilidad ?? false,
                is_client: type === 'client',
                is_supplier: type === 'supplier',
                is_employee: type === 'employee' || type === 'carrier',
                is_carrier: type === 'carrier' || payload.isCarrier,
            })
            .returning();

        if (type === 'employee' || type === 'carrier') {
            await tx.insert(employeeDetails).values({
                entity_id: created.id,
                department: payload.department,
                job_title: payload.jobTitle,
                salary_base: toDecimal(payload.salaryBase),
                hire_date: payload.hireDate,
                cost_per_hour: toDecimal(payload.costPerHour),
            });
        }

        // Invalidate list and total caches (awaitable now)
        await cacheService.invalidate(`${type}s:*`);
        broadcast(WsEvents.ENTITY.CREATED, { type, entity: created }, `${type}s`);

        return created;
    });
}

// =============================================================================
// Update Entity
// =============================================================================

/**
 * Update entity
 */
export async function updateEntity(id: number, type: EntityType, payload: Partial<EntityPayload>) {
    return db.transaction(async (tx) => {
        const [updated] = await tx
            .update(entities)
            .set(stripUndefined({
                business_name: payload.businessName,
                trade_name: payload.tradeName,
                email_billing: payload.emailBilling,
                phone: payload.phone,
                address_fiscal: payload.addressFiscal,
                sri_contributor_type: payload.sriContributorType,
                obligado_contabilidad: payload.obligadoContabilidad,
                parte_relacionada: payload.parteRelacionada,
                is_carrier: payload.isCarrier,
            }))
            .where(eq(entities.id, id))
            .returning();

        if (!updated) throw new DomainError('Entidad no encontrada', 404);

        if ((type === 'employee' || type === 'carrier') &&
            (payload.department || payload.jobTitle || payload.salaryBase || payload.costPerHour)) {
            await tx
                .update(employeeDetails)
                .set({
                    department: payload.department,
                    job_title: payload.jobTitle,
                    salary_base: toDecimal(payload.salaryBase),
                    cost_per_hour: toDecimal(payload.costPerHour),
                })
                .where(eq(employeeDetails.entity_id, id));
        }

        await cacheService.invalidate(`entity:${id}`);
        await cacheService.invalidate(`${type}s:*`);
        broadcast(WsEvents.ENTITY.UPDATED, { type, entity: updated }, `${type}s`);

        return updated;
    });
}

// =============================================================================
// Deactivate Entity (Soft Delete)
// =============================================================================

/**
 * Soft delete entity
 */
export async function deactivateEntity(id: number, type: EntityType) {
    const [updated] = await db
        .update(entities)
        .set({ is_active: false })
        .where(eq(entities.id, id))
        .returning();

    if (!updated) throw new DomainError('Entidad no encontrada', 404);

    await cacheService.invalidate(`entity:${id}`);
    await cacheService.invalidate(`${type}s:*`);
    broadcast(WsEvents.ENTITY.DELETED, { type, id }, `${type}s`);

    return { success: true };
}

// =============================================================================
// Contacts CRUD
// =============================================================================

export async function addContact(entityId: number, payload: ContactPayload) {
    if (payload.isPrimary) {
        await db
            .update(entityContacts)
            .set({ is_primary: false })
            .where(eq(entityContacts.entity_id, entityId));
    }

    const [contact] = await db
        .insert(entityContacts)
        .values({
            entity_id: entityId,
            name: payload.name,
            position: payload.position,
            email: payload.email,
            phone: payload.phone,
            is_primary: payload.isPrimary ?? false,
        })
        .returning();

    cacheService.invalidate(`entity:${entityId}`);
    return contact;
}

export async function updateContact(contactId: number, payload: Partial<ContactPayload>) {
    const [contact] = await db
        .select()
        .from(entityContacts)
        .where(eq(entityContacts.id, contactId));

    if (!contact) throw new DomainError('Contacto no encontrado', 404);

    if (payload.isPrimary) {
        await db
            .update(entityContacts)
            .set({ is_primary: false })
            .where(eq(entityContacts.entity_id, contact.entity_id));
    }

    const [updated] = await db
        .update(entityContacts)
        .set({
            name: payload.name,
            position: payload.position,
            email: payload.email,
            phone: payload.phone,
            is_primary: payload.isPrimary,
        })
        .where(eq(entityContacts.id, contactId))
        .returning();

    cacheService.invalidate(`entity:${contact.entity_id}`);
    return updated;
}

export async function deleteContact(contactId: number) {
    const [contact] = await db
        .select()
        .from(entityContacts)
        .where(eq(entityContacts.id, contactId));

    if (!contact) throw new DomainError('Contacto no encontrado', 404);

    await db.delete(entityContacts).where(eq(entityContacts.id, contactId));
    cacheService.invalidate(`entity:${contact.entity_id}`);

    return { success: true };
}

export async function getContacts(entityId: number) {
    return db.select().from(entityContacts).where(eq(entityContacts.entity_id, entityId));
}

// =============================================================================
// Addresses CRUD
// =============================================================================

export async function addAddress(entityId: number, payload: AddressPayload) {
    if (payload.isMain) {
        await db
            .update(entityAddresses)
            .set({ is_main: false })
            .where(eq(entityAddresses.entity_id, entityId));
    }

    const [address] = await db
        .insert(entityAddresses)
        .values({
            entity_id: entityId,
            address_line: payload.addressLine,
            city: payload.city,
            is_main: payload.isMain ?? false,
        })
        .returning();

    cacheService.invalidate(`entity:${entityId}`);
    return address;
}

export async function getAddresses(entityId: number) {
    return db.select().from(entityAddresses).where(eq(entityAddresses.entity_id, entityId));
}
