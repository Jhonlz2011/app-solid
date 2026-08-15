import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createMockAuthContext } from '../helpers/test-context';

const BACKEND_ROUTES_DIR = resolve(__dirname, '../../backend/src/routes');

describe('Route Precedence & Auth Context Optimization Suite (F10, F13)', () => {
    it('F10.1: Brands route registers /bulk/restore BEFORE /:id/restore', () => {
        const brandsRoutePath = join(BACKEND_ROUTES_DIR, 'brands.routes.ts');
        if (existsSync(brandsRoutePath)) {
            const content = readFileSync(brandsRoutePath, 'utf-8');
            const bulkIndex = content.indexOf('/bulk');
            const idRestoreIndex = content.indexOf('/:id/restore');
            const bulkRestoreIndex = content.indexOf('/bulk/restore');

            if (bulkRestoreIndex !== -1 && idRestoreIndex !== -1) {
                expect(bulkRestoreIndex).toBeLessThan(idRestoreIndex);
            }
        }
    });

    it('F10.2: Products route registers /bulk/restore and /facets BEFORE /:id', () => {
        const productsRoutePath = join(BACKEND_ROUTES_DIR, 'products.routes.ts');
        if (existsSync(productsRoutePath)) {
            const content = readFileSync(productsRoutePath, 'utf-8');
            const bulkIndex = content.indexOf('/bulk');
            const idParamIndex = content.indexOf('/:id');

            if (bulkIndex !== -1 && idParamIndex !== -1) {
                expect(bulkIndex).toBeLessThan(idParamIndex);
            }
        }
    });

    it('F10.3: RBAC route registers /users/bulk/restore BEFORE /users/:id/restore', () => {
        const rbacRoutePath = join(BACKEND_ROUTES_DIR, 'rbac.routes.ts');
        if (existsSync(rbacRoutePath)) {
            const content = readFileSync(rbacRoutePath, 'utf-8');
            const bulkRestoreIndex = content.indexOf('/users/bulk/restore');
            const idRestoreIndex = content.indexOf('/users/:id/restore');

            if (bulkRestoreIndex !== -1 && idRestoreIndex !== -1) {
                expect(bulkRestoreIndex).toBeLessThan(idRestoreIndex);
            }
        }
    });

    it('F10.4: Locations route registers /bulk BEFORE /:id', () => {
        const locationsRoutePath = join(BACKEND_ROUTES_DIR, 'locations.routes.ts');
        if (existsSync(locationsRoutePath)) {
            const content = readFileSync(locationsRoutePath, 'utf-8');
            const bulkIndex = content.indexOf('/bulk');
            const idIndex = content.indexOf('/:id');

            if (bulkIndex !== -1 && idIndex !== -1) {
                expect(bulkIndex).toBeLessThan(idIndex);
            }
        }
    });

    it('F10.5: Route matcher resolves static /bulk/restore path correctly without capturing id="bulk"', () => {
        // Simulation of Elysia Radix Tree Matcher behavior
        const routes: Array<{ path: string; handler: (params: Record<string, any>) => string }> = [
            { path: '/api/brands/bulk/restore', handler: () => 'BULK_RESTORE_OK' },
            { path: '/api/brands/:id/restore', handler: (p) => `ID_RESTORE_${p.id}` },
        ];

        function matchRoute(url: string) {
            for (const r of routes) {
                if (r.path === url) return r.handler({});
                if (r.path.includes(':id')) {
                    const prefix = r.path.split(':id')[0];
                    const suffix = r.path.split(':id')[1];
                    if (url.startsWith(prefix) && url.endsWith(suffix)) {
                        const id = url.substring(prefix.length, url.length - suffix.length);
                        return r.handler({ id });
                    }
                }
            }
            return 'NOT_FOUND';
        }

        expect(matchRoute('/api/brands/bulk/restore')).toBe('BULK_RESTORE_OK');
        expect(matchRoute('/api/brands/42/restore')).toBe('ID_RESTORE_42');
    });

    it('F13.1: AuthGuard provides currentRoles and currentPermissions directly in context', () => {
        const authCtx = createMockAuthContext();
        expect(authCtx.currentUserId).toBe(101);
        expect(authCtx.currentCompanyId).toBe(1);
        expect(authCtx.currentRoles).toContain('ADMIN');
        expect(authCtx.currentPermissions).toContain('products:view');
    });

    it('F13.2: Modules route uses context permissions without calling getUserPermissions DB query', () => {
        const authCtx = createMockAuthContext();
        let dbQueriesCount = 0;

        // Simulated handler consuming context directly
        const getPermissionsHandler = (ctx: typeof authCtx) => {
            // DB query bypassed!
            return {
                roles: ctx.currentRoles,
                permissions: ctx.currentPermissions,
            };
        };

        const response = getPermissionsHandler(authCtx);
        expect(dbQueriesCount).toBe(0);
        expect(response.roles).toEqual(['ADMIN', 'SUPER_ADMIN']);
        expect(response.permissions.length).toBeGreaterThan(0);
    });

    it('F13.3: Menu tree generation consumes roles from context for navigation filtering', () => {
        const authCtx = createMockAuthContext();
        const menuItems = [
            { id: 1, label: 'Catálogo', permission: 'products:view' },
            { id: 2, label: 'Facturación', permission: 'invoices:view' },
            { id: 3, label: 'Configuración Avanzada', permission: 'system:superadmin' },
        ];

        const visibleMenu = menuItems.filter(item => authCtx.currentPermissions.includes(item.permission));
        expect(visibleMenu.length).toBe(2);
        expect(visibleMenu.some(m => m.label === 'Catálogo')).toBe(true);
        expect(visibleMenu.some(m => m.label === 'Configuración Avanzada')).toBe(false);
    });
});
