/**
 * Test Context Helpers for Elysia and AuthGuard Simulation
 */

export interface MockAuthContext {
    currentUserId: number;
    currentCompanyId: number;
    currentSessionId: string;
    currentRoles: string[];
    currentPermissions: string[];
}

export function createMockAuthContext(overrides: Partial<MockAuthContext> = {}): MockAuthContext {
    return {
        currentUserId: overrides.currentUserId ?? 101,
        currentCompanyId: overrides.currentCompanyId ?? 1,
        currentSessionId: overrides.currentSessionId ?? 'sess_alfa_101',
        currentRoles: overrides.currentRoles ?? ['ADMIN', 'SUPER_ADMIN'],
        currentPermissions: overrides.currentPermissions ?? [
            'products:view', 'products:create', 'products:edit', 'products:delete',
            'brands:view', 'brands:create', 'brands:edit', 'brands:delete',
            'invoices:view', 'invoices:create', 'invoices:edit', 'invoices:delete',
            'quotations:view', 'quotations:create', 'quotations:edit',
            'schedules:view', 'schedules:create', 'schedules:edit',
            'entities:view', 'entities:create', 'entities:edit', 'entities:delete',
            'rbac:view', 'rbac:manage',
        ],
    };
}

export function createMockRequest(url: string, method: string = 'GET', body?: any, headers: Record<string, string> = {}): Request {
    const init: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
    };
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
        init.body = JSON.stringify(body);
    }
    return new Request(url, init);
}
