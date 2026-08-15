import { describe, it, expect } from 'bun:test';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const ROOT_DIR = resolve(__dirname, '../../');
const BACKEND_DIR = join(ROOT_DIR, 'backend');
const FRONTEND_DIR = join(ROOT_DIR, 'frontend');
const SCHEMA_DIR = join(ROOT_DIR, 'packages/schema');

function getAllTsFiles(dir: string, fileList: string[] = []): string[] {
    if (!existsSync(dir)) return fileList;
    const files = readdirSync(dir);
    for (const file of files) {
        const fullPath = join(dir, file);
        if (file === 'node_modules' || file === 'dist' || file === '.git') continue;
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            getAllTsFiles(fullPath, fileList);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

describe('Architectural Boundary & Lint Verifications (F3, F14, F15, F16)', () => {
    const backendFiles = getAllTsFiles(join(BACKEND_DIR, 'src'));
    const frontendFiles = getAllTsFiles(join(FRONTEND_DIR, 'src'));

    it('Check 1: Zero "@app/schema/frontend" imports in backend/src/**', () => {
        const violations: Array<{ file: string; line: number; content: string }> = [];
        for (const filePath of backendFiles) {
            const content = readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.includes('@app/schema/frontend')) {
                    violations.push({ file: filePath, line: idx + 1, content: line.trim() });
                }
            });
        }
        expect(violations).toEqual([]);
    });

    it('Check 2: Zero "@app/schema/backend" imports in frontend/src/**', () => {
        const violations: Array<{ file: string; line: number; content: string }> = [];
        for (const filePath of frontendFiles) {
            const content = readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.includes('@app/schema/backend')) {
                    violations.push({ file: filePath, line: idx + 1, content: line.trim() });
                }
            });
        }
        expect(violations).toEqual([]);
    });

    it('Check 3: Zero root "@app/schema" imports in frontend/src/**', () => {
        const violations: Array<{ file: string; line: number; content: string }> = [];
        for (const filePath of frontendFiles) {
            const content = readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                // Matches "from '@app/schema'" or 'from "@app/schema"'
                if (/from\s+['"]@app\/schema['"]/.test(line)) {
                    violations.push({ file: filePath, line: idx + 1, content: line.trim() });
                }
            });
        }
        expect(violations).toEqual([]);
    });

    it('Check 4: Zero dead legacy files (backend/src/listener.ts)', () => {
        const listenerPath = join(BACKEND_DIR, 'src/listener.ts');
        expect(existsSync(listenerPath)).toBe(false);
    });

    it('Check 5: Zero empty modules/ directories in backend/src/modules', () => {
        const modulesPath = join(BACKEND_DIR, 'src/modules');
        expect(existsSync(modulesPath)).toBe(false);
    });

    it('Check 6: Zero unused service wrappers (clients.service.ts, suppliers.service.ts, employees.service.ts)', () => {
        const deadServices = [
            join(BACKEND_DIR, 'src/services/clients.service.ts'),
            join(BACKEND_DIR, 'src/services/suppliers.service.ts'),
            join(BACKEND_DIR, 'src/services/employees.service.ts'),
        ];
        for (const deadService of deadServices) {
            expect(existsSync(deadService)).toBe(false);
        }
    });

    it('Check 7: SQL Syntax Check in Menu Service (no trailing comma before WHERE in CASE)', () => {
        const menuServicePath = join(BACKEND_DIR, 'src/services/menu.service.ts');
        if (existsSync(menuServicePath)) {
            const content = readFileSync(menuServicePath, 'utf-8');
            expect(content).not.toMatch(/END,\s*WHERE/i);
        }
    });

    it('Check 8: Redis Cache Invalidation Key Isolation (no global unisolated uom:*, attributes:*, invoices:*, docs:*)', () => {
        const violations: Array<{ file: string; line: number; pattern: string }> = [];
        const prohibitedPatterns = [
            "invalidate('uom:*')",
            'invalidate("uom:*")',
            "invalidate('attributes:*')",
            'invalidate("attributes:*")',
            "invalidate('invoices:*')",
            'invalidate("invoices:*")',
            "invalidate('docs:*')",
            'invalidate("docs:*")',
            "invalidate('docs:list:*')",
            'invalidate("docs:list:*")',
        ];

        for (const filePath of backendFiles) {
            const content = readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                for (const pat of prohibitedPatterns) {
                    if (line.includes(pat)) {
                        violations.push({ file: filePath, line: idx + 1, pattern: pat });
                    }
                }
            });
        }
        expect(violations).toEqual([]);
    });

    it('Check 9: TypeBox schemas centralized under @app/schema/backend', () => {
        const schemaBackendPath = join(SCHEMA_DIR, 'src/backend.ts');
        expect(existsSync(schemaBackendPath)).toBe(true);
        const content = readFileSync(schemaBackendPath, 'utf-8');
        expect(content).toContain('BrandBodySchema');
        expect(content).toContain('UomBodySchema');
        expect(content).toContain('AttributeBodySchema');
        expect(content).toContain('InvoiceCreateSchema');
        expect(content).toContain('WarehouseBodySchema');
        expect(content).toContain('LocationBodySchema');
    });

    it('Check 10: Pure shared DTO interfaces centralized under @app/schema/shared-dto', () => {
        const sharedDtoPath = join(SCHEMA_DIR, 'src/shared.dto.ts');
        expect(existsSync(sharedDtoPath)).toBe(true);
        const content = readFileSync(sharedDtoPath, 'utf-8');
        expect(content).toContain('export interface PaginationMeta');
        expect(content).toContain('export interface ProductPayload');
        expect(content).toContain('export interface EntityPayload');
    });
});
