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
import { CANONICAL_DEFAULT_ALIASES, CANONICAL_DEFAULT_REVERSE } from '@app/schema/routes';

/** Storage prefix for client-side synchronous alias hydration */
const ALIAS_CACHE_PREFIX = 'zelys_route_aliases:';

function getTenantSlug(): string {
    if (typeof window === 'undefined') return 'default';
    return resolveSlugFromHost(window.location.hostname) || 'default';
}

let cachedAliases: Record<string, string> | null = null;
let cachedReverseAliases: Record<string, string> | null = null;
let sortedAliasKeys: string[] = [];
let sortedReverseKeys: string[] = [];

/**
 * Initializes aliases from canonical defaults merged with pre-injected DOM script tags.
 * Reverse mapping is derived dynamically in memory — zero duplicate storage overhead.
 * Cached in memory for O(1) performance on subsequent lookups.
 */
function initAliases(): void {
    if (cachedAliases !== null) return;

    // 1. Injected aliases from Elysia SPA pre-boot script
    let injectedAliases: Record<string, string> = {};
    try {
        const el = typeof document !== 'undefined' ? document.getElementById('route-aliases') : null;
        if (el?.textContent) injectedAliases = JSON.parse(el.textContent);
    } catch {}

    // 2. Synchronous localStorage cache for F5 reloads, direct navigation, and Vite dev
    // Client-side stored aliases take precedence over stale server/SW HTML
    const slug = getTenantSlug();
    let storedAliases: Record<string, string> = {};
    if (typeof window !== 'undefined') {
        try {
            const stored = localStorage.getItem(`${ALIAS_CACHE_PREFIX}${slug}`)
                || localStorage.getItem(`${ALIAS_CACHE_PREFIX}latest`)
                || localStorage.getItem(`${ALIAS_CACHE_PREFIX}default`);
            if (stored) storedAliases = JSON.parse(stored);
        } catch {}
    }

    // Precedence: Canonical defaults < DOM Injected < LocalStorage client-updated
    cachedAliases = { ...CANONICAL_DEFAULT_ALIASES, ...injectedAliases, ...storedAliases };

    // Pure dynamic derivation of reverse aliases:
    // Any active custom alias (e.g. '/pacientes' -> '/clients') overrides the reverse display
    cachedReverseAliases = { ...CANONICAL_DEFAULT_REVERSE };
    for (const [alias, real] of Object.entries(injectedAliases)) {
        if (alias && real) cachedReverseAliases[real] = alias;
    }
    for (const [alias, real] of Object.entries(storedAliases)) {
        if (alias && real) cachedReverseAliases[real] = alias;
    }

    // Sort descending by length so deeper prefix paths match before shallower ones
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

    const normalizedPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

    // 1. Exact match (exact or stripped trailing slash)
    if (cachedAliases[pathname]) {
        return `${cachedAliases[pathname]}${search}${hash}`;
    }
    if (cachedAliases[normalizedPath]) {
        return `${cachedAliases[normalizedPath]}${search}${hash}`;
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

    const normalizedPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

    // 1. Exact match (exact or stripped trailing slash)
    if (cachedReverseAliases[pathname]) {
        return `${cachedReverseAliases[pathname]}${search}${hash}`;
    }
    if (cachedReverseAliases[normalizedPath]) {
        return `${cachedReverseAliases[normalizedPath]}${search}${hash}`;
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
export function setRouteAliases(tenantAliases: Record<string, string>, tenantSlug?: string | null): void {
    if (!tenantAliases || Object.keys(tenantAliases).length === 0) {
        return;
    }

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
    const slug = tenantSlug || getTenantSlug();
    if (typeof window !== 'undefined') {
        try {
            const aliasJson = JSON.stringify(tenantAliases);
            localStorage.setItem(`${ALIAS_CACHE_PREFIX}${slug}`, aliasJson);
            localStorage.setItem(`${ALIAS_CACHE_PREFIX}latest`, aliasJson);
        } catch (e) {
            console.warn('Failed to persist route aliases to localStorage:', e);
        }
    }
}

/**
 * Dynamically updates the route alias map at runtime (e.g. on menu fetch or tenant switch).
 */
export function updateRouteAliases(aliasMap: Record<string, string>, tenantSlug?: string | null): void {
    setRouteAliases(aliasMap, tenantSlug);
}

/**
 * Resets cached alias state in memory (for tenant switch or logout).
 */
export function resetRouteAliases(): void {
    cachedAliases = null;
    cachedReverseAliases = null;
    sortedAliasKeys = [];
    sortedReverseKeys = [];
}

/**
 * Clears cached aliases in localStorage and resets memory state (for menu default resets).
 */
export function clearTenantRouteAliases(slug?: string | null): void {
    const targetSlug = slug || getTenantSlug();
    if (typeof window !== 'undefined') {
        try {
            localStorage.removeItem(`${ALIAS_CACHE_PREFIX}${targetSlug}`);
            localStorage.removeItem(`${ALIAS_CACHE_PREFIX}latest`);
            localStorage.removeItem(`${ALIAS_CACHE_PREFIX}default`);
        } catch (e) {
            console.warn('Failed to clear tenant route aliases from localStorage:', e);
        }
    }
    resetRouteAliases();
}
