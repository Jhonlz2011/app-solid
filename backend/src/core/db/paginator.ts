import { sql, and, eq, lt, gt, asc, desc, inArray, type AnyColumn, type SQL, type PgColumn, type Table } from '@app/schema';
import type { CursorMetaType, PaginatedResult as SchemaPaginatedResult } from '@app/schema/backend';
import { db } from './db';
import { cacheService } from '../cache/cache.service';
import { createHash } from 'crypto';

export interface PaginationParams<TFilters = Record<string, any>> {
    cursor?: string;
    direction?: 'first' | 'next' | 'prev' | 'last';
    limit?: number;
    page?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
    filters?: TFilters;
}

export type PaginationMetaType = CursorMetaType;
export type PaginatedResult<T> = SchemaPaginatedResult<T>;

export interface CursorPaginatorConfig<TTable extends Table<any> = Table<any>, TFilters = Record<string, any>> {
    table: TTable;
    idColumn: PgColumn<any>;
    companyIdColumn: PgColumn<any>;
    sortableColumns: Record<string, AnyColumn>;
    defaultSortBy?: string;
    cacheNamespace: string;
    ttl?: number;
    buildConditions: (opts: {
        companyId: number;
        search?: string;
        filters?: TFilters;
        excludeFilterKey?: string;
    }) => SQL[];
}

export class CursorPaginator<TTable extends Table<any> = Table<any>, TFilters = Record<string, any>> {
    private readonly table: Table<any>;

    constructor(private config: CursorPaginatorConfig<TTable, TFilters>) {
        this.table = config.table as Table<any>;
    }

    private hashKey(obj: unknown): string {
        return createHash('md5').update(JSON.stringify(obj)).digest('hex').slice(0, 12);
    }

    encodeCursor(id: number | string): string {
        return Buffer.from(JSON.stringify({ id })).toString('base64url');
    }

    decodeCursor(cursor: string): { id: number | string } | null {
        try {
            return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
        } catch {
            return null;
        }
    }

    /** Get cached count(*) strictly filtered by companyId and active filters */
    async getCachedTotal(companyId: number, search?: string, filters?: TFilters): Promise<number> {
        const key = `${this.config.cacheNamespace}:c${companyId}:total:${this.hashKey({ search: search || 'all', filters })}`;
        return cacheService.getOrSet(key, async () => {
            const conditions = this.config.buildConditions({ companyId, search, filters });
            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
            const [{ count } = { count: 0 }] = await db
                .select({ count: sql<number>`count(*)`.mapWith((v) => (v === null || v === undefined ? 0 : Number(v))) })
                .from(this.table)
                .where(whereClause);
            return Number(count) || 0;
        }, this.config.ttl ?? 120);
    }

    /** Get cached min(id) and max(id) bounds */
    async getCachedBounds(companyId: number, search?: string, filters?: TFilters): Promise<{ minId: number | string; maxId: number | string }> {
        const key = `${this.config.cacheNamespace}:c${companyId}:bounds:${this.hashKey({ search: search || 'all', filters })}`;
        return cacheService.getOrSet(key, async () => {
            const conditions = this.config.buildConditions({ companyId, search, filters });
            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
            const [result] = await db
                .select({
                    minId: sql`min(${this.config.idColumn})`,
                    maxId: sql`max(${this.config.idColumn})`,
                })
                .from(this.table)
                .where(whereClause);
            return {
                minId: (result?.minId as number | string) ?? 0,
                maxId: (result?.maxId as number | string) ?? 0,
            };
        }, this.config.ttl ?? 120);
    }

    /** Main paginate dispatcher: picks Keyset vs Deferred Join */
    async paginate<TResult = unknown>(
        params: PaginationParams<TFilters>,
        companyId: number,
        fetchRowsFn?: (ids: Array<number | string>) => Promise<TResult[]>
    ): Promise<PaginatedResult<TResult>> {
        const { sortBy } = params;
        if (sortBy && sortBy !== 'id' && this.config.sortableColumns[sortBy]) {
            return this.paginateSorted<TResult>(params, companyId, fetchRowsFn);
        }
        return this.paginateCursor<TResult>(params, companyId, fetchRowsFn);
    }

    /** Strategy 1: Keyset Cursor Pagination on ID */
    async paginateCursor<TResult = unknown>(
        params: PaginationParams<TFilters>,
        companyId: number,
        fetchRowsFn?: (ids: Array<number | string>) => Promise<TResult[]>
    ): Promise<PaginatedResult<TResult>> {
        const { cursor, limit: limitRaw = 25, search, direction = 'first', filters } = params;
        const limit = Number(limitRaw);
        const cacheKey = `${this.config.cacheNamespace}:c${companyId}:list:${this.hashKey({ cursor, limit, search, direction, filters })}`;

        return cacheService.getOrSet(cacheKey, async () => {
            const conditions = this.config.buildConditions({ companyId, search, filters });
            const total = await this.getCachedTotal(companyId, search, filters);
            const { minId, maxId } = await this.getCachedBounds(companyId, search, filters);

            let effectiveLimit = limit;
            if (direction === 'last') {
                const remainder = total % limit;
                effectiveLimit = remainder === 0 ? limit : remainder;
            }

            const cursorData = cursor ? this.decodeCursor(cursor) : null;
            if (cursorData) {
                if (direction === 'next') conditions.push(lt(this.config.idColumn, cursorData.id));
                else if (direction === 'prev') conditions.push(gt(this.config.idColumn, cursorData.id));
            }

            const fetchLimit = effectiveLimit + 1;
            const isDescending = direction === 'first' || direction === 'next';

            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
            const idRows = await db
                .select({ id: this.config.idColumn })
                .from(this.table)
                .where(whereClause)
                .limit(fetchLimit)
                .orderBy(isDescending ? desc(this.config.idColumn) : asc(this.config.idColumn));

            let ids: Array<number | string> = idRows.map((r: { id: unknown }) =>
                typeof r.id === 'number' ? r.id : String(r.id)
            );
            const hasMore = ids.length > effectiveLimit;
            if (hasMore) ids = ids.slice(0, effectiveLimit);
            if (direction === 'prev' || direction === 'last') ids = ids.reverse();

            let data: TResult[];
            if (ids.length === 0) {
                data = [];
            } else if (fetchRowsFn) {
                const rows = await fetchRowsFn(ids);
                const idOrder = new Map(ids.map((id, i) => [id, i]));
                data = (rows as Array<Record<string, unknown> & { id: number | string }>).sort(
                    (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0)
                ) as unknown as TResult[];
            } else {
                const rows = await db
                    .select()
                    .from(this.table)
                    .where(and(eq(this.config.companyIdColumn, companyId), inArray(this.config.idColumn, ids)));
                const idOrder = new Map(ids.map((id, i) => [id, i]));
                data = (rows as Array<Record<string, unknown> & { id: number | string }>).sort(
                    (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0)
                ) as unknown as TResult[];
            }

            const meta: PaginationMetaType = {
                nextCursor: null,
                prevCursor: null,
                hasNextPage: false,
                hasPrevPage: false,
                total,
                page: null,
                pageCount: null,
            };

            if (ids.length > 0) {
                const firstId = ids[0];
                const lastId = ids[ids.length - 1];
                meta.hasPrevPage = firstId !== minId;
                meta.prevCursor = meta.hasPrevPage ? this.encodeCursor(firstId) : null;
                meta.hasNextPage = lastId !== maxId;
                meta.nextCursor = meta.hasNextPage ? this.encodeCursor(lastId) : null;
            }

            return { data, meta };
        }, this.config.ttl ?? 120);
    }

    /** Strategy 2: Offset Pagination with Deferred Join (Strict Tenant-Scoped 2nd Query) */
    async paginateSorted<TResult = unknown>(
        params: PaginationParams<TFilters>,
        companyId: number,
        fetchRowsFn?: (ids: Array<number | string>) => Promise<TResult[]>
    ): Promise<PaginatedResult<TResult>> {
        const { limit: limitRaw = 25, search, sortBy = this.config.defaultSortBy || 'id', sortOrder = 'asc', page: pageRaw = 1, filters } = params;
        const limit = Number(limitRaw);
        const page = Math.max(1, Number(pageRaw));
        const offset = (page - 1) * limit;
        const cacheKey = `${this.config.cacheNamespace}:c${companyId}:sorted:${this.hashKey({ limit, search, sortBy, sortOrder, page, filters })}`;

        return cacheService.getOrSet(cacheKey, async () => {
            const conditions = this.config.buildConditions({ companyId, search, filters });
            const total = await this.getCachedTotal(companyId, search, filters);
            const pageCount = Math.ceil(total / limit);

            const sortColumn = this.config.sortableColumns[sortBy] || this.config.idColumn;
            const orderFn = sortOrder === 'desc' ? desc : asc;
            const orderClauses = [orderFn(sortColumn), orderFn(this.config.idColumn)];

            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
            const idRows = await db
                .select({ id: this.config.idColumn })
                .from(this.table)
                .where(whereClause)
                .orderBy(...orderClauses)
                .limit(limit)
                .offset(offset);

            if (idRows.length === 0) {
                return {
                    data: [],
                    meta: {
                        nextCursor: null,
                        prevCursor: null,
                        hasNextPage: false,
                        hasPrevPage: false,
                        total,
                        page,
                        pageCount,
                    },
                };
            }

            const ids: Array<number | string> = idRows.map((r: { id: unknown }) =>
                typeof r.id === 'number' ? r.id : String(r.id)
            );
            let data: TResult[];

            if (fetchRowsFn) {
                const rows = await fetchRowsFn(ids);
                const idOrder = new Map(ids.map((id, i) => [id, i]));
                data = (rows as Array<Record<string, unknown> & { id: number | string }>).sort(
                    (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0)
                ) as unknown as TResult[];
            } else {
                const rows = await db
                    .select()
                    .from(this.table)
                    .where(and(eq(this.config.companyIdColumn, companyId), inArray(this.config.idColumn, ids)));

                const idOrder = new Map(ids.map((id, i) => [id, i]));
                data = (rows as Array<Record<string, unknown> & { id: number | string }>).sort(
                    (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0)
                ) as unknown as TResult[];
            }

            return {
                data,
                meta: {
                    nextCursor: null,
                    prevCursor: null,
                    hasNextPage: page < pageCount,
                    hasPrevPage: page > 1,
                    total,
                    page,
                    pageCount,
                },
            };
        }, this.config.ttl ?? 120);
    }

    /** Faceted Filter Engine with Label Joins & Disjunctive Facet Counting */
    async getFacets<TColumnKey extends string>(
        columns: TColumnKey[],
        columnMap: Record<TColumnKey, PgColumn<any>>,
        filterKeyMap: Record<TColumnKey, string>,
        labelJoins: Partial<Record<TColumnKey, { table: Table<any>; nameCol: PgColumn<any>; idCol: PgColumn<any> }>> = {},
        filters: { search?: string } & Partial<TFilters> = {},
        companyId: number = 0
    ): Promise<Record<string, { value: string; label?: string; count: number }[]>> {
        const { search, ...restFilters } = filters;
        const cacheKey = `${this.config.cacheNamespace}:c${companyId}:facets:${this.hashKey({ columns, search, restFilters })}`;

        return cacheService.getOrSet(cacheKey, async () => {
            const results: Record<string, { value: string; label?: string; count: number }[]> = {};

            await Promise.all(
                columns.map(async (colKey) => {
                    const dbCol = columnMap[colKey];
                    if (!dbCol) return;

                    const excludeKey = filterKeyMap[colKey];
                    const conditions = this.config.buildConditions({
                        companyId,
                        search,
                        filters: restFilters as TFilters,
                        excludeFilterKey: excludeKey,
                    });

                    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
                    const join = labelJoins[colKey];

                    if (join) {
                        const rows = await db
                            .select({
                                value: sql<string>`CAST(${dbCol} AS TEXT)`,
                                label: join.nameCol,
                                count: sql<number>`count(*)`.mapWith(Number),
                            })
                            .from(this.table)
                            .leftJoin(join.table, eq(dbCol, join.idCol))
                            .where(whereClause)
                            .groupBy(dbCol, join.nameCol)
                            .orderBy(desc(sql`count(*)`));

                        results[colKey] = rows.filter((r: { value: string | null }) => r.value !== null && r.value !== undefined) as { value: string; label?: string; count: number }[];
                    } else {
                        const rows = await db
                            .select({
                                value: sql<string>`CAST(${dbCol} AS TEXT)`,
                                count: sql<number>`count(*)`.mapWith(Number),
                            })
                            .from(this.table)
                            .where(whereClause)
                            .groupBy(dbCol)
                            .orderBy(desc(sql`count(*)`));

                        results[colKey] = rows.filter((r: { value: string | null }) => r.value !== null && r.value !== undefined) as { value: string; label?: string; count: number }[];
                    }
                })
            );

            return results;
        }, this.config.ttl ?? 120);
    }
}

export class FacetedFilterEngine<TTable extends Table<any> = Table<any>, TFilters = Record<string, any>> {
    constructor(private paginator: CursorPaginator<TTable, TFilters>) {}

    async getFacets<TColumnKey extends string>(
        columns: TColumnKey[],
        columnMap: Record<TColumnKey, PgColumn<any>>,
        filterKeyMap: Record<TColumnKey, string>,
        labelJoins: Partial<Record<TColumnKey, { table: Table<any>; nameCol: PgColumn<any>; idCol: PgColumn<any> }>> = {},
        filters: { search?: string } & Partial<TFilters> = {},
        companyId: number = 0
    ) {
        return this.paginator.getFacets(columns, columnMap, filterKeyMap, labelJoins, filters, companyId);
    }
}
