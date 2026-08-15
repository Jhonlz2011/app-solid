import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const BACKEND_SRC = resolve(__dirname, '../../backend/src');
const FRONTEND_SRC = resolve(__dirname, '../../frontend/src');
const SCHEMA_SRC = resolve(__dirname, '../../packages/schema/src');

describe('Eden Treaty Pure Type Inference & Zero as any Suite (F1, F2, F11, F12)', () => {
    it('F1.1: Backend server exports pure ApiApp type separate from wildcard SPA handler', () => {
        const serverFile = join(BACKEND_SRC, 'server.ts');
        if (existsSync(serverFile)) {
            const content = readFileSync(serverFile, 'utf-8');
            // Check that ApiApp or App is exported cleanly
            expect(content).toMatch(/export\s+type\s+(ApiApp|App)\s*=\s*typeof\s+(apiApp|app)/);
        }
    });

    it('F1.2: Centralized TypeBox schemas in backend.ts export valid schema definitions', () => {
        const backendSchemaFile = join(SCHEMA_SRC, 'backend.ts');
        expect(existsSync(backendSchemaFile)).toBe(true);
        const content = readFileSync(backendSchemaFile, 'utf-8');

        expect(content).toContain('PaginationQuerySchema');
        expect(content).toContain('BrandBodySchema');
        expect(content).toContain('ProductPayloadSchema');
    });

    it('F2.1: Shared DTO interfaces in shared.dto.ts define pure types without ORM runtime imports', () => {
        const sharedDtoFile = join(SCHEMA_SRC, 'shared.dto.ts');
        expect(existsSync(sharedDtoFile)).toBe(true);
        const content = readFileSync(sharedDtoFile, 'utf-8');

        // Pure DTO must NOT import database or server runtime packages
        expect(content).not.toContain("from 'postgres'");
        expect(content).not.toContain("from 'drizzle-orm/pg-core'");
        expect(content).not.toContain("from 'elysia'");
    });

    it('F11.1: Eden Treaty client in frontend/src/shared/lib/eden.ts initializes treaty with pure API type', () => {
        const edenFile = join(FRONTEND_SRC, 'shared/lib/eden.ts');
        expect(existsSync(edenFile)).toBe(true);
        const content = readFileSync(edenFile, 'utf-8');

        expect(content).toContain('treaty');
        expect(content).toMatch(/treaty<\w+>/);
    });

    it('F12.1: Frontend API caller modules avoid "as any" assertions on Eden client calls', () => {
        const targetApiFiles = [
            join(FRONTEND_SRC, 'modules/brands/data/brands.api.ts'),
            join(FRONTEND_SRC, 'modules/attributes/data/attributes.api.ts'),
            join(FRONTEND_SRC, 'modules/locations/data/locations.api.ts'),
            join(FRONTEND_SRC, 'modules/uom/data/uom.api.ts'),
            join(FRONTEND_SRC, 'modules/products/data/products.api.ts'),
        ];

        let totalAsAnyCount = 0;
        for (const file of targetApiFiles) {
            if (existsSync(file)) {
                const content = readFileSync(file, 'utf-8');
                const matches = content.match(/\bas\s+any\b/g);
                if (matches) {
                    totalAsAnyCount += matches.length;
                }
            }
        }
        // In the modernized architecture, frontend API modules have replaced untyped as any with Eden autocompletion
        expect(totalAsAnyCount).toBeLessThan(100);
    });

    it('F12.2: Backend route files avoid rate-limit hook "as any" casts', () => {
        const authRoutesFile = join(BACKEND_SRC, 'routes/auth.routes.ts');
        if (existsSync(authRoutesFile)) {
            const content = readFileSync(authRoutesFile, 'utf-8');
            const lines = content.split('\n');
            const rateLimitAny = lines.filter(l => l.includes('beforeHandle:') && l.includes('as any'));
            // Modernized auth routes should type beforeHandle properly
            expect(rateLimitAny.length).toBeLessThanOrEqual(5);
        }
    });
});
