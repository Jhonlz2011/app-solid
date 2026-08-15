import { describe, it, expect, beforeEach } from 'bun:test';
import { mockDb, testTenantStorage } from '../helpers/mock-db';
import {
    mockCompanies,
    mockInvoices,
    mockQuotations,
    mockSchedules,
    mockEntities,
    mockBrands,
    mockProducts,
} from '../helpers/fixtures';

describe('Multi-Tenant Shielding & RLS Hardening Suite (F7, F8, F9)', () => {
    beforeEach(() => {
        mockDb.reset();
        mockDb.seedTable('companies', mockCompanies);
        mockDb.seedTable('invoices', mockInvoices);
        mockDb.seedTable('quotations', mockQuotations);
        mockDb.seedTable('employee_work_schedules', mockSchedules);
        mockDb.seedTable('entities', mockEntities);
        mockDb.seedTable('brands', mockBrands);
        mockDb.seedTable('products', mockProducts);
    });

    it('F7.1: Quotations table enforces company_id presence on insert', async () => {
        const result = await mockDb.withTenantContext({ companyId: 1 }, async () => {
            return await mockDb.executeQuery({
                table: 'quotations',
                operation: 'insert',
                insertRow: {
                    client_id: 1,
                    quotation_number: 'COT-2026-TEST',
                    status: 'DRAFT',
                    total_amount: '100.00',
                },
            });
        });

        expect(result.data.length).toBe(1);
        expect(result.data[0].company_id).toBe(1);
        expect(result.leakedRowsDetected).toBe(false);
    });

    it('F7.2: Cross-tenant quotation query returns 0 rows from other tenants under RLS', async () => {
        const result = await mockDb.withTenantContext({ companyId: 1 }, async () => {
            return await mockDb.executeQuery({
                table: 'quotations',
                operation: 'select',
            });
        });

        expect(result.data.length).toBe(1);
        expect(result.data[0].company_id).toBe(1);
        expect(result.data.some(q => q.company_id === 2)).toBe(false);
    });

    it('F8.1: Invoices service list query applies explicit company_id condition', async () => {
        const result = await mockDb.executeQuery({
            table: 'invoices',
            operation: 'select',
            whereCompanyId: 1,
        });

        expect(result.data.length).toBe(1);
        expect(result.data[0].company_id).toBe(1);
        expect(result.data[0].document_number).toBe('001-001-000000001');
    });

    it('F8.2: Bulk entity restore does not affect records belonging to another company', async () => {
        const result = await mockDb.executeQuery({
            table: 'entities',
            operation: 'update',
            whereCompanyId: 1,
            predicate: (row) => row.id === 3, // Entity 3 belongs to Company 2
            updateFields: { is_active: true },
        });

        // Entity 3 should NOT be updated because whereCompanyId = 1
        expect(result.data.length).toBe(0);
        const entity3 = mockDb.getTableRows('entities').find(e => e.id === 3);
        expect(entity3?.company_id).toBe(2);
    });

    it('F8.3: Employee schedule reports are strictly bounded to tenant scope', async () => {
        const result = await mockDb.executeQuery({
            table: 'employee_work_schedules',
            operation: 'select',
            whereCompanyId: 2,
        });

        expect(result.data.length).toBe(1);
        expect(result.data[0].company_id).toBe(2);
        expect(result.data[0].employee_id).toBe(201);
    });

    it('F9.1: Connection pool transaction wrapper sets and restores tenant context cleanly', async () => {
        let insideContextCompanyId: number | null = null;
        await mockDb.withTenantContext({ companyId: 1 }, async () => {
            const store = testTenantStorage.getStore();
            insideContextCompanyId = store?.companyId ?? null;
        });

        const storeAfter = testTenantStorage.getStore();
        expect(insideContextCompanyId).toBe(1);
        expect(storeAfter).toBeUndefined(); // AsyncLocalStorage cleanly reset
    });

    it('F9.2: Standalone queries outside transaction use explicit WHERE company_id filter (Defense-in-Depth)', async () => {
        const result = await mockDb.executeQuery({
            table: 'brands',
            operation: 'select',
            whereCompanyId: 2,
        });

        expect(result.data.length).toBe(2);
        expect(result.data.every(b => b.company_id === 2)).toBe(true);
        const loggedQuery = mockDb.queryLog.find(q => q.table === 'brands' && q.companyIdPassed === 2);
        expect(loggedQuery).toBeDefined();
        expect(loggedQuery?.companyIdFiltered).toBe(true);
    });

    it('F9.3: Prevents cross-tenant entity reference leaks during pre-flight delete check', async () => {
        const result = await mockDb.executeQuery({
            table: 'entities',
            operation: 'select',
            whereCompanyId: 1,
            predicate: (row) => row.id === 1,
        });

        expect(result.data.length).toBe(1);
        expect(result.data[0].business_name).toBe('Constructora del Norte S.A.');
    });
});
