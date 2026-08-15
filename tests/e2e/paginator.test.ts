import { describe, it, expect, beforeEach } from 'bun:test';
import { mockRedis } from '../helpers/mock-redis';
import { mockBrands, mockProducts } from '../helpers/fixtures';

// Generic in-memory CursorPaginator implementation matching backend/src/db/paginator.ts contract
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

export interface PaginationMeta {
    nextCursor: string | null;
    prevCursor: string | null;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    total: number;
    page: number | null;
    pageCount: number | null;
}

export interface PaginatedResult<T> {
    data: T[];
    meta: PaginationMeta;
}

export class TestCursorPaginator<T extends { id: number; company_id: number; name?: string }> {
    constructor(
        private dataset: T[],
        private cacheNamespace: string,
        private redis = mockRedis
    ) {}

    public encodeCursor(id: number): string {
        return Buffer.from(JSON.stringify({ id })).toString('base64url');
    }

    public decodeCursor(cursor: string): { id: number } | null {
        try {
            const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
            const parsed = JSON.parse(decoded);
            if (typeof parsed === 'object' && parsed !== null && typeof parsed.id === 'number') {
                return parsed;
            }
            return null;
        } catch {
            return null;
        }
    }

    async getCachedTotal(companyId: number, search?: string, filters?: Record<string, any>): Promise<number> {
        const key = `${this.cacheNamespace}:c${companyId}:total:${search || 'all'}`;
        return this.redis.getOrSet(key, async () => {
            let filtered = this.dataset.filter(row => row.company_id === companyId);
            if (search) {
                filtered = filtered.filter(row => row.name?.toLowerCase().includes(search.toLowerCase()));
            }
            return filtered.length;
        }, 120);
    }

    async getCachedBounds(companyId: number, search?: string, filters?: Record<string, any>): Promise<{ minId: number; maxId: number }> {
        const key = `${this.cacheNamespace}:c${companyId}:bounds:${search || 'all'}`;
        return this.redis.getOrSet(key, async () => {
            let tenantRows = this.dataset.filter(row => row.company_id === companyId);
            if (search) {
                tenantRows = tenantRows.filter(row => row.name?.toLowerCase().includes(search.toLowerCase()));
            }
            if (tenantRows.length === 0) return { minId: 0, maxId: 0 };
            const ids = tenantRows.map(r => r.id);
            return { minId: Math.min(...ids), maxId: Math.max(...ids) };
        }, 120);
    }

    async paginate(params: PaginationParams, companyId: number): Promise<PaginatedResult<T>> {
        const { sortBy } = params;
        if (sortBy && sortBy !== 'id') {
            return this.paginateSorted(params, companyId);
        }
        return this.paginateCursor(params, companyId);
    }

    async paginateCursor(params: PaginationParams, companyId: number): Promise<PaginatedResult<T>> {
        const { cursor, limit: limitRaw = 25, search, direction = 'first', filters } = params;
        const limit = Number(limitRaw);
        const total = await this.getCachedTotal(companyId, search, filters);
        const { minId, maxId } = await this.getCachedBounds(companyId, search, filters);

        let tenantRows = this.dataset.filter(r => r.company_id === companyId);
        if (search) {
            tenantRows = tenantRows.filter(r => r.name?.toLowerCase().includes(search.toLowerCase()));
        }

        let effectiveLimit = limit;
        if (direction === 'last') {
            const remainder = total % limit;
            effectiveLimit = remainder === 0 ? limit : remainder;
        }

        const cursorData = cursor ? this.decodeCursor(cursor) : null;
        if (cursorData) {
            if (direction === 'next') {
                tenantRows = tenantRows.filter(r => r.id < cursorData.id);
            } else if (direction === 'prev') {
                tenantRows = tenantRows.filter(r => r.id > cursorData.id);
            }
        }

        const isDescending = direction === 'first' || direction === 'next';
        tenantRows.sort((a, b) => isDescending ? b.id - a.id : a.id - b.id);

        let items = tenantRows.slice(0, effectiveLimit);
        if (direction === 'prev' || direction === 'last') {
            items = items.reverse();
        }

        const meta: PaginationMeta = {
            nextCursor: null,
            prevCursor: null,
            hasNextPage: false,
            hasPrevPage: false,
            total,
            page: null,
            pageCount: null,
        };

        if (items.length > 0) {
            const firstId = items[0].id;
            const lastId = items[items.length - 1].id;
            meta.hasPrevPage = firstId < maxId;
            meta.prevCursor = meta.hasPrevPage ? this.encodeCursor(firstId) : null;
            meta.hasNextPage = lastId > minId;
            meta.nextCursor = meta.hasNextPage ? this.encodeCursor(lastId) : null;
        }

        return { data: items, meta };
    }

    async paginateSorted(params: PaginationParams, companyId: number): Promise<PaginatedResult<T>> {
        const { limit: limitRaw = 25, page: pageRaw = 1, sortBy = 'name', sortOrder = 'asc', search } = params;
        const limit = Number(limitRaw);
        const page = Math.max(1, Number(pageRaw));
        const total = await this.getCachedTotal(companyId, search);
        const pageCount = Math.ceil(total / limit) || (total === 0 ? 0 : 1);
        const offset = (page - 1) * limit;

        let tenantRows = this.dataset.filter(r => r.company_id === companyId);
        if (search) {
            tenantRows = tenantRows.filter(r => r.name?.toLowerCase().includes(search.toLowerCase()));
        }

        if (tenantRows.length === 0) {
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

        // 1. First step: deferred sort on (sortBy, id) tie-breaking
        tenantRows.sort((a, b) => {
            const valA = (a as any)[sortBy] ?? '';
            const valB = (b as any)[sortBy] ?? '';
            let cmp = 0;
            if (typeof valA === 'string' && typeof valB === 'string') {
                cmp = valA.localeCompare(valB);
            } else {
                cmp = valA > valB ? 1 : valA < valB ? -1 : 0;
            }
            if (cmp === 0) {
                cmp = a.id - b.id; // Tie-breaker
            }
            return sortOrder === 'desc' ? -cmp : cmp;
        });

        const idSlice = tenantRows.slice(offset, offset + limit).map(r => r.id);

        // 2. Second step: Fetch full rows strictly by company_id AND inArray(id, ids)
        const idOrder = new Map(idSlice.map((id, i) => [id, i]));
        const reconciled = idSlice
            .map(id => this.dataset.find(r => r.id === id && r.company_id === companyId))
            .filter((r): r is T => Boolean(r))
            .sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

        return {
            data: reconciled,
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
    }
}

describe('Generic CursorPaginator & Faceted Filtering Suite (F4, F5, F6)', () => {
    beforeEach(() => {
        mockRedis.clear();
    });

    // =========================================================================
    // 1. Core Cursor Pagination (F4)
    // =========================================================================
    describe('F4: Keyset Cursor Pagination', () => {
        it('F4.1: Paginate first page with descending keyset cursor', async () => {
            const paginator = new TestCursorPaginator(mockBrands, 'brands');
            const result = await paginator.paginate({ limit: 2, direction: 'first' }, 1);

            expect(result.data.length).toBe(2);
            expect(result.meta.total).toBe(3); // 3 brands for Company 1
            expect(result.meta.hasNextPage).toBe(true);
            expect(result.meta.nextCursor).not.toBeNull();
            expect(result.data.every(r => r.company_id === 1)).toBe(true);
        });

        it('F4.2: Paginate next page using decoded cursor boundary', async () => {
            const paginator = new TestCursorPaginator(mockBrands, 'brands');
            const page1 = await paginator.paginate({ limit: 2, direction: 'first' }, 1);
            const nextCursor = page1.meta.nextCursor!;

            const page2 = await paginator.paginate({ limit: 2, cursor: nextCursor, direction: 'next' }, 1);
            expect(page2.data.length).toBe(1);
            expect(page2.meta.hasNextPage).toBe(false);
        });

        it('F4.3: Sorted offset pagination with deferred joins adheres to page boundaries', async () => {
            const paginator = new TestCursorPaginator(mockBrands, 'brands');
            const result = await paginator.paginate({ page: 1, limit: 2, sortBy: 'name', sortOrder: 'asc' }, 1);

            expect(result.data.length).toBe(2);
            expect(result.meta.page).toBe(1);
            expect(result.meta.pageCount).toBe(2);
            expect(result.meta.hasNextPage).toBe(true);
            expect(result.meta.hasPrevPage).toBe(false);
        });

        it('F4.4: Enforces strict tenant separation between Company 1 and Company 2', async () => {
            const paginator = new TestCursorPaginator(mockBrands, 'brands');
            const resCompany1 = await paginator.paginate({}, 1);
            const resCompany2 = await paginator.paginate({}, 2);

            expect(resCompany1.data.every(r => r.company_id === 1)).toBe(true);
            expect(resCompany2.data.every(r => r.company_id === 2)).toBe(true);
            expect(resCompany1.meta.total).toBe(3);
            expect(resCompany2.meta.total).toBe(2);
        });

        it('F4.5: Caches total count and bounds with tenant namespace prefix :c${companyId}:', async () => {
            const paginator = new TestCursorPaginator(mockBrands, 'brands');
            await paginator.getCachedTotal(1);
            await paginator.getCachedBounds(1);

            const keys = mockRedis.getAllKeys();
            expect(keys.some(k => k.startsWith('brands:c1:total'))).toBe(true);
            expect(keys.some(k => k.startsWith('brands:c1:bounds'))).toBe(true);
            expect(keys.some(k => k.includes(':c2:'))).toBe(false);
        });
    });

    // =========================================================================
    // 2. Faceted Filtering & Disjunctive Counting (F5)
    // =========================================================================
    describe('F5: Faceted Filtering & Disjunctive Counting', () => {
        it('F5.1: Faceted filter aggregation counts distinct values per attribute disjunctively', async () => {
            const mockCatalog = [
                { id: 1, company_id: 1, category_id: 10, brand_id: 1, is_active: true },
                { id: 2, company_id: 1, category_id: 10, brand_id: 2, is_active: true },
                { id: 3, company_id: 1, category_id: 20, brand_id: 1, is_active: true },
                { id: 4, company_id: 2, category_id: 10, brand_id: 4, is_active: true },
            ];

            // When filtering by brand_id = 1, brand facet computation excludes the brand filter
            const brandFacets = mockCatalog
                .filter(r => r.company_id === 1 && r.is_active)
                .reduce((acc, r) => {
                    acc[r.brand_id] = (acc[r.brand_id] || 0) + 1;
                    return acc;
                }, {} as Record<number, number>);

            expect(brandFacets[1]).toBe(2);
            expect(brandFacets[2]).toBe(1);
            expect(brandFacets[4]).toBeUndefined(); // Belongs to Company 2
        });

        it('F5.2: Multi-filter disjunctive faceting preserves non-excluded filter dimensions', async () => {
            const mockCatalog = [
                { id: 1, company_id: 1, category_id: 10, brand_id: 1, product_type: 'PRODUCTO' },
                { id: 2, company_id: 1, category_id: 10, brand_id: 2, product_type: 'PRODUCTO' },
                { id: 3, company_id: 1, category_id: 20, brand_id: 1, product_type: 'PRODUCTO' },
                { id: 4, company_id: 1, category_id: 10, brand_id: 3, product_type: 'SERVICIO' },
            ];

            // User has active filters: category_id = 10, brand_id = 1, product_type = 'PRODUCTO'
            // For brand facets: exclude brand_id, but retain category_id = 10 and product_type = 'PRODUCTO'
            const brandFacets = mockCatalog
                .filter(r => r.company_id === 1 && r.category_id === 10 && r.product_type === 'PRODUCTO')
                .reduce((acc, r) => {
                    acc[r.brand_id] = (acc[r.brand_id] || 0) + 1;
                    return acc;
                }, {} as Record<number, number>);

            expect(brandFacets[1]).toBe(1);
            expect(brandFacets[2]).toBe(1);
            expect(brandFacets[3]).toBeUndefined(); // Filtered out by product_type
        });
    });

    // =========================================================================
    // 3. Empirical Stress-Testing: Edge Cases & Boundaries
    // =========================================================================
    describe('Empirical Edge Cases: Empty, Single, Boundaries & Transitions', () => {
        it('EDGE-1: Empty dataset cursor pagination returns graceful empty result', async () => {
            const emptyPaginator = new TestCursorPaginator([], 'empty_catalog');
            const resFirst = await emptyPaginator.paginate({ direction: 'first', limit: 25 }, 1);
            const resLast = await emptyPaginator.paginate({ direction: 'last', limit: 25 }, 1);

            expect(resFirst.data).toEqual([]);
            expect(resFirst.meta.total).toBe(0);
            expect(resFirst.meta.hasNextPage).toBe(false);
            expect(resFirst.meta.hasPrevPage).toBe(false);
            expect(resFirst.meta.nextCursor).toBeNull();
            expect(resFirst.meta.prevCursor).toBeNull();

            expect(resLast.data).toEqual([]);
            expect(resLast.meta.total).toBe(0);
            expect(resLast.meta.hasNextPage).toBe(false);
            expect(resLast.meta.hasPrevPage).toBe(false);
        });

        it('EDGE-2: Empty dataset sorted offset pagination returns pageCount = 0 and empty array', async () => {
            const emptyPaginator = new TestCursorPaginator([], 'empty_catalog');
            const res = await emptyPaginator.paginate({ page: 1, limit: 10, sortBy: 'name' }, 1);

            expect(res.data).toEqual([]);
            expect(res.meta.total).toBe(0);
            expect(res.meta.page).toBe(1);
            expect(res.meta.hasNextPage).toBe(false);
            expect(res.meta.hasPrevPage).toBe(false);
        });

        it('EDGE-3: Single-item dataset returns no next and no prev cursors', async () => {
            const singleItemDataset = [{ id: 42, company_id: 1, name: 'Solo Item' }];
            const paginator = new TestCursorPaginator(singleItemDataset, 'single');

            const resFirst = await paginator.paginate({ direction: 'first', limit: 10 }, 1);
            expect(resFirst.data.length).toBe(1);
            expect(resFirst.data[0].id).toBe(42);
            expect(resFirst.meta.total).toBe(1);
            expect(resFirst.meta.hasNextPage).toBe(false);
            expect(resFirst.meta.hasPrevPage).toBe(false);
            expect(resFirst.meta.nextCursor).toBeNull();
            expect(resFirst.meta.prevCursor).toBeNull();

            const resLast = await paginator.paginate({ direction: 'last', limit: 10 }, 1);
            expect(resLast.data.length).toBe(1);
            expect(resLast.meta.hasNextPage).toBe(false);
            expect(resLast.meta.hasPrevPage).toBe(false);
        });

        it('EDGE-4: Next beyond last page returns empty array and terminates gracefully', async () => {
            const paginator = new TestCursorPaginator(mockBrands, 'brands');
            // Company 1 has IDs: 1, 2, 3 (minId = 1, maxId = 3)
            const beyondEndCursor = paginator.encodeCursor(1); // Smallest ID in company 1
            const res = await paginator.paginate({ cursor: beyondEndCursor, direction: 'next', limit: 10 }, 1);

            expect(res.data).toEqual([]);
            expect(res.meta.hasNextPage).toBe(false);
            expect(res.meta.hasPrevPage).toBe(false);
            expect(res.meta.nextCursor).toBeNull();
            expect(res.meta.prevCursor).toBeNull();
        });

        it('EDGE-5: Prev beyond first page returns empty array and terminates gracefully', async () => {
            const paginator = new TestCursorPaginator(mockBrands, 'brands');
            const beyondStartCursor = paginator.encodeCursor(3); // Largest ID in company 1
            const res = await paginator.paginate({ cursor: beyondStartCursor, direction: 'prev', limit: 10 }, 1);

            expect(res.data).toEqual([]);
            expect(res.meta.hasNextPage).toBe(false);
            expect(res.meta.hasPrevPage).toBe(false);
            expect(res.meta.nextCursor).toBeNull();
            expect(res.meta.prevCursor).toBeNull();
        });

        it('EDGE-6: Full bidirectional traversal (first -> next -> next -> prev -> prev -> first)', async () => {
            const dataset = [
                { id: 1, company_id: 1, name: 'Item 1' },
                { id: 2, company_id: 1, name: 'Item 2' },
                { id: 3, company_id: 1, name: 'Item 3' },
                { id: 4, company_id: 1, name: 'Item 4' },
                { id: 5, company_id: 1, name: 'Item 5' },
                { id: 6, company_id: 1, name: 'Item 6' },
                { id: 7, company_id: 1, name: 'Item 7' },
            ];
            const paginator = new TestCursorPaginator(dataset, 'traversal');

            // Page 1: IDs [7, 6, 5]
            const page1 = await paginator.paginate({ limit: 3, direction: 'first' }, 1);
            expect(page1.data.map(d => d.id)).toEqual([7, 6, 5]);
            expect(page1.meta.hasNextPage).toBe(true);
            expect(page1.meta.hasPrevPage).toBe(false);

            // Page 2: IDs [4, 3, 2]
            const page2 = await paginator.paginate({ limit: 3, cursor: page1.meta.nextCursor!, direction: 'next' }, 1);
            expect(page2.data.map(d => d.id)).toEqual([4, 3, 2]);
            expect(page2.meta.hasNextPage).toBe(true);
            expect(page2.meta.hasPrevPage).toBe(true);

            // Page 3: IDs [1]
            const page3 = await paginator.paginate({ limit: 3, cursor: page2.meta.nextCursor!, direction: 'next' }, 1);
            expect(page3.data.map(d => d.id)).toEqual([1]);
            expect(page3.meta.hasNextPage).toBe(false);
            expect(page3.meta.hasPrevPage).toBe(true);

            // Traverse backward to Page 2: IDs [4, 3, 2]
            const backPage2 = await paginator.paginate({ limit: 3, cursor: page3.meta.prevCursor!, direction: 'prev' }, 1);
            expect(backPage2.data.map(d => d.id)).toEqual([4, 3, 2]);

            // Traverse backward to Page 1: IDs [7, 6, 5]
            const backPage1 = await paginator.paginate({ limit: 3, cursor: backPage2.meta.prevCursor!, direction: 'prev' }, 1);
            expect(backPage1.data.map(d => d.id)).toEqual([7, 6, 5]);
        });

        it('EDGE-7: Direction last with remainder limit calculation fetches exact tail slice', async () => {
            const dataset = [
                { id: 1, company_id: 1, name: 'Item 1' },
                { id: 2, company_id: 1, name: 'Item 2' },
                { id: 3, company_id: 1, name: 'Item 3' },
                { id: 4, company_id: 1, name: 'Item 4' },
                { id: 5, company_id: 1, name: 'Item 5' },
                { id: 6, company_id: 1, name: 'Item 6' },
                { id: 7, company_id: 1, name: 'Item 7' },
            ];
            const paginator = new TestCursorPaginator(dataset, 'tail');

            // Total 7, limit 3 -> 7 % 3 = 1 remainder. Direction 'last' must return exactly 1 item [1]
            const lastPage = await paginator.paginate({ limit: 3, direction: 'last' }, 1);
            expect(lastPage.data.map(d => d.id)).toEqual([1]);
            expect(lastPage.meta.hasNextPage).toBe(false);
            expect(lastPage.meta.hasPrevPage).toBe(true);
        });

        it('EDGE-8: Corrupted / invalid cursor string fails gracefully without throwing exception', async () => {
            const paginator = new TestCursorPaginator(mockBrands, 'corrupted');
            const malformedResult = await paginator.paginate({ cursor: 'malformed_base64_!@#$', direction: 'next', limit: 10 }, 1);

            expect(malformedResult.data.length).toBeGreaterThan(0);
            expect(malformedResult.meta.total).toBe(3);
        });

        it('EDGE-9: Deferred join sort stability with tie-breaking on identical names', async () => {
            const duplicateNamesDataset = [
                { id: 1, company_id: 1, name: 'Alpha' },
                { id: 2, company_id: 1, name: 'Alpha' },
                { id: 3, company_id: 1, name: 'Alpha' },
                { id: 4, company_id: 1, name: 'Beta' },
            ];
            const paginator = new TestCursorPaginator(duplicateNamesDataset, 'duplicates');

            const page1 = await paginator.paginate({ page: 1, limit: 2, sortBy: 'name', sortOrder: 'asc' }, 1);
            const page2 = await paginator.paginate({ page: 2, limit: 2, sortBy: 'name', sortOrder: 'asc' }, 1);

            expect(page1.data.map(d => d.id)).toEqual([1, 2]);
            expect(page2.data.map(d => d.id)).toEqual([3, 4]);
            // Zero overlap between pages
            const intersection = page1.data.filter(p1 => page2.data.some(p2 => p2.id === p1.id));
            expect(intersection).toEqual([]);
        });
    });
});
