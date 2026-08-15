/**
 * Mock Database Layer for Multi-Tenant E2E Testing
 * Simulates Drizzle ORM query proxy, AsyncLocalStorage tenant context,
 * PostgreSQL RLS session variables, and query isolation.
 */
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
    companyId?: number;
    userId?: number;
    ipAddress?: string;
    tx?: any;
}

export const testTenantStorage = new AsyncLocalStorage<TenantContext>();

export interface QueryRecord {
    sql: string;
    table: string;
    operation: 'select' | 'insert' | 'update' | 'delete' | 'count';
    companyIdFiltered: boolean;
    companyIdPassed: number | null;
    rlsContextCompanyId: number | null;
    timestamp: number;
}

export class MockDatabase {
    private tables: Map<string, Array<Record<string, any>>> = new Map();
    public queryLog: QueryRecord[] = [];
    public rlsEnforced: boolean = true;

    constructor() {
        this.reset();
    }

    reset(): void {
        this.tables.clear();
        this.queryLog = [];
        this.rlsEnforced = true;
    }

    seedTable(tableName: string, rows: Array<Record<string, any>>): void {
        this.tables.set(tableName, [...rows]);
    }

    getTableRows(tableName: string): Array<Record<string, any>> {
        return this.tables.get(tableName) || [];
    }

    async executeQuery<T = any>(opts: {
        table: string;
        operation: 'select' | 'insert' | 'update' | 'delete' | 'count';
        whereCompanyId?: number;
        predicate?: (row: Record<string, any>) => boolean;
        insertRow?: Record<string, any>;
        updateFields?: Record<string, any>;
    }): Promise<{ data: T[]; leakedRowsDetected: boolean; rlsViolated: boolean }> {
        const store = testTenantStorage.getStore();
        const rlsCompanyId = store?.companyId || null;
        const companyIdFiltered = opts.whereCompanyId !== undefined;
        const effectiveCompanyId = opts.whereCompanyId ?? rlsCompanyId;

        this.queryLog.push({
            sql: `MOCK_${opts.operation.toUpperCase()}_ON_${opts.table}`,
            table: opts.table,
            operation: opts.operation,
            companyIdFiltered,
            companyIdPassed: opts.whereCompanyId ?? null,
            rlsContextCompanyId: rlsCompanyId,
            timestamp: Date.now(),
        });

        const rows = this.tables.get(opts.table) || [];
        let leakedRowsDetected = false;
        let rlsViolated = false;

        // If query does not filter companyId and no RLS context is set, all rows leak!
        if (!companyIdFiltered && !rlsCompanyId) {
            const distinctCompanies = new Set(rows.map(r => r.company_id).filter(Boolean));
            if (distinctCompanies.size > 1) {
                leakedRowsDetected = true;
            }
        }

        // Under RLS: only rows matching rlsCompanyId (or whereCompanyId) are returned
        let filtered = rows;
        if (this.rlsEnforced && effectiveCompanyId !== null) {
            filtered = rows.filter(r => r.company_id === effectiveCompanyId);
        } else if (!this.rlsEnforced && companyIdFiltered) {
            filtered = rows.filter(r => r.company_id === opts.whereCompanyId);
        }

        if (opts.predicate) {
            filtered = filtered.filter(opts.predicate);
        }

        if (opts.operation === 'insert' && opts.insertRow) {
            const newRow = { id: (rows.length + 1), company_id: effectiveCompanyId, ...opts.insertRow };
            rows.push(newRow);
            this.tables.set(opts.table, rows);
            return { data: [newRow] as unknown as T[], leakedRowsDetected, rlsViolated };
        }

        if (opts.operation === 'update' && opts.updateFields) {
            for (const r of filtered) {
                Object.assign(r, opts.updateFields);
            }
            return { data: filtered as unknown as T[], leakedRowsDetected, rlsViolated };
        }

        if (opts.operation === 'delete') {
            const remaining = rows.filter(r => !filtered.includes(r));
            this.tables.set(opts.table, remaining);
            return { data: filtered as unknown as T[], leakedRowsDetected, rlsViolated };
        }

        return { data: filtered as unknown as T[], leakedRowsDetected, rlsViolated };
    }

    async withTenantContext<T>(
        context: { companyId: number; userId?: number; ipAddress?: string },
        operation: () => Promise<T>
    ): Promise<T> {
        const store = testTenantStorage.getStore();
        if (store?.tx) {
            return await operation();
        }
        return await testTenantStorage.run({ ...context, tx: { active: true } }, operation);
    }
}

export const mockDb = new MockDatabase();
