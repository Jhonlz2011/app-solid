/**
 * Route Alias Resolution Utility
 * 
 * Provides seamless bidirectional path translation between user-facing tenant aliases
 * (e.g., `/proveedores`, `/ventas/clientes`) and TanStack Router's internal canonical routes
 * (e.g., `/suppliers`, `/clients`).
 * 
 * In production (*.zelys.app), aliases are pre-injected by Elysia SPA Renderer as JSON tags:
 * - `<script id="route-aliases" type="application/json">` (alias -> real)
 * - `<script id="route-reverse-aliases" type="application/json">` (real -> alias)
 */

import { resolveSlugFromHost } from '@app/schema/utils';

/** Storage prefixes for client-side synchronous alias hydration */
const ALIAS_CACHE_PREFIX = 'zelys_route_aliases:';
const REVERSE_CACHE_PREFIX = 'zelys_route_reverse:';

function getTenantSlug(): string {
    if (typeof window === 'undefined') return 'default';
    return resolveSlugFromHost(window.location.hostname) || 'default';
}

/** Canonical fallback map for standard ERP modules */
const CANONICAL_DEFAULT_ALIASES: Record<string, string> = {
    '/clientes': '/clients',
    '/ventas/clientes': '/clients',
    '/proveedores': '/suppliers',
    '/compras/proveedores': '/suppliers',
    '/productos': '/products',
    '/servicios': '/services',
    '/categorias': '/categories',
    '/marcas': '/brands',
    '/unidades': '/uom',
    '/unidades-medida': '/uom',
    '/atributos': '/attributes',
    '/ubicaciones': '/locations',
    '/herramientas': '/tool-loans',
    '/prestamos': '/tool-loans',
    '/usuarios': '/users',
    '/sistema/usuarios': '/users',
    '/empleados': '/employees',
    '/rrhh/empleados': '/employees',
    '/configuracion': '/settings',
    '/sistema/configuracion': '/settings',
    '/panel': '/dashboard',
};

const CANONICAL_DEFAULT_REVERSE: Record<string, string> = {
    '/clients': '/clientes',
    '/suppliers': '/proveedores',
    '/products': '/productos',
    '/services': '/servicios',
    '/categories': '/categorias',
    '/brands': '/marcas',
    '/uom': '/unidades',
    '/attributes': '/atributos',
    '/locations': '/ubicaciones',
    '/tool-loans': '/herramientas',
    '/users': '/usuarios',
    '/employees': '/empleados',
    '/settings': '/configuracion',
    '/dashboard': '/panel',
};

let cachedAliases: Record<string, string> | null = null;
let cachedReverseAliases: Record<string, string> | null = null;
let sortedAliasKeys: string[] = [];
let sortedReverseKeys: string[] = [];

/**
 * Initializes aliases from canonical defaults merged with pre-injected DOM script tags.
 * Cached in memory for O(1) performance on subsequent lookups.
 */
function initAliases(): void {
    if (cachedAliases !== null) return;

    let injectedAliases: Record<string, string> = {};
    try {
        const el = typeof document !== 'undefined' ? document.getElementById('route-aliases') : null;
        if (el?.textContent) injectedAliases = JSON.parse(el.textContent);
    } catch {}

    let injectedReverse: Record<string, string> = {};
    try {
        const el = typeof document !== 'undefined' ? document.getElementById('route-reverse-aliases') : null;
        if (el?.textContent) injectedReverse = JSON.parse(el.textContent);
    } catch {}

    // Fallback: Synchronous localStorage cache for F5 reloads, direct navigation, and Vite dev
    const slug = getTenantSlug();
    if (Object.keys(injectedAliases).length === 0 && typeof window !== 'undefined') {
        try {
            const stored = localStorage.getItem(`${ALIAS_CACHE_PREFIX}${slug}`);
            if (stored) injectedAliases = JSON.parse(stored);
        } catch {}
    }

    if (Object.keys(injectedReverse).length === 0 && typeof window !== 'undefined') {
        try {
            const stored = localStorage.getItem(`${REVERSE_CACHE_PREFIX}${slug}`);
            if (stored) injectedReverse = JSON.parse(stored);
        } catch {}
    }

    // Injected tenant custom aliases override canonical defaults
    cachedAliases = { ...CANONICAL_DEFAULT_ALIASES, ...injectedAliases };
    cachedReverseAliases = { ...CANONICAL_DEFAULT_REVERSE, ...injectedReverse };

    // Sort descending by length so deeper prefix paths match before shallower ones
    // (e.g., '/ventas/clientes' must match before '/ventas')
    sortedAliasKeys = Object.keys(cachedAliases).sort((a, b) => b.length - a.length);
    sortedReverseKeys = Object.keys(cachedReverseAliases).sort((a, b) => b.length - a.length);
}

/**
 * Parses raw URL or path into pathname, search params, and hash fragment.
 */
function parseUrlParts(rawUrl: string): { pathname: string; search: string; hash: string } {
    const hashIdx = rawUrl.indexOf('#');
    const searchIdx = rawUrl.indexOf('?');

    let pathname = rawUrl;
    let search = '';
    let hash = '';

    if (hashIdx !== -1) {
        hash = rawUrl.slice(hashIdx);
        pathname = rawUrl.slice(0, hashIdx);
    }

    if (searchIdx !== -1 && (hashIdx === -1 || searchIdx < hashIdx)) {
        search = rawUrl.slice(searchIdx, hashIdx !== -1 ? hashIdx : undefined);
        pathname = rawUrl.slice(0, searchIdx);
    }

    return { pathname, search, hash };
}

/**
 * Translates an incoming browser path (alias) to the internal TanStack Router path.
 * Examples:
 * - `/proveedores` -> `/suppliers`
 * - `/proveedores/new` -> `/suppliers/new`
 * - `/proveedores/123/edit` -> `/suppliers/123/edit`
 * - `/ventas/clientes/new` -> `/clients/new`
 */
export function toRealPath(rawUrl: string): string {
    initAliases();
    const { pathname, search, hash } = parseUrlParts(rawUrl);

    if (!cachedAliases || sortedAliasKeys.length === 0) {
        return rawUrl;
    }

    // 1. Exact match
    if (cachedAliases[pathname]) {
        return `${cachedAliases[pathname]}${search}${hash}`;
    }

    // 2. Prefix match for sub-routes and modals (sorted by length descending)
    for (const alias of sortedAliasKeys) {
        if (pathname.startsWith(`${alias}/`)) {
            const real = cachedAliases[alias];
            const subPath = pathname.slice(alias.length);
            return `${real}${subPath}${search}${hash}`;
        }
    }

    return rawUrl;
}

/**
 * Translates an internal TanStack Router path to the visible browser alias path.
 * Examples:
 * - `/suppliers` -> `/proveedores`
 * - `/suppliers/new` -> `/proveedores/new`
 * - `/suppliers/123/edit` -> `/proveedores/123/edit`
 * - `/clients/new` -> `/ventas/clientes/new`
 */
export function toAliasPath(rawUrl: string): string {
    initAliases();
    const { pathname, search, hash } = parseUrlParts(rawUrl);

    if (!cachedReverseAliases || sortedReverseKeys.length === 0) {
        return rawUrl;
    }

    // 1. Exact match
    if (cachedReverseAliases[pathname]) {
        return `${cachedReverseAliases[pathname]}${search}${hash}`;
    }

    // 2. Prefix match for sub-routes and modals
    for (const real of sortedReverseKeys) {
        if (pathname.startsWith(`${real}/`)) {
            const alias = cachedReverseAliases[real];
            const subPath = pathname.slice(real.length);
            return `${alias}${subPath}${search}${hash}`;
        }
    }

    return rawUrl;
}

/**
 * Deterministically sets and rebuilds the route alias map at runtime (e.g. on menu fetch, tenant switch or SSE update).
 * Completely resets and replaces active tenant aliases over canonical defaults without accumulating deleted or stale aliases.
 */
export function setRouteAliases(tenantAliases: Record<string, string>): void {
    const aliases: Record<string, string> = { ...CANONICAL_DEFAULT_ALIASES };
    const reverse: Record<string, string> = { ...CANONICAL_DEFAULT_REVERSE };

    for (const [alias, real] of Object.entries(tenantAliases)) {
        if (!alias || !real) continue;
        // Never delete canonical default aliases: incoming requests for /configuracion, /clientes, etc.
        // must always be successfully resolved even if a tenant has customized their path alias.
        aliases[alias] = real;
        reverse[real] = alias;
    }

    cachedAliases = aliases;
    cachedReverseAliases = reverse;
    sortedAliasKeys = Object.keys(cachedAliases).sort((a, b) => b.length - a.length);
    sortedReverseKeys = Object.keys(cachedReverseAliases).sort((a, b) => b.length - a.length);

    // Persist to localStorage for synchronous hydration on F5 / direct navigation
    const slug = getTenantSlug();
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(`${ALIAS_CACHE_PREFIX}${slug}`, JSON.stringify(tenantAliases));
            localStorage.setItem(`${REVERSE_CACHE_PREFIX}${slug}`, JSON.stringify(reverse));
        } catch (e) {
            console.warn('Failed to persist route aliases to localStorage:', e);
        }
    }
}

/**
 * Dynamically updates the route alias map at runtime (e.g. on menu fetch or tenant switch).
 */
export function updateRouteAliases(aliasMap: Record<string, string>): void {
    setRouteAliases(aliasMap);
}
