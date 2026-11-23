/**
 * Tenant Slug and Routing Resolution (*.zelys.app in prod, *.localhost in dev)
 * Shared between frontend and backend.
 * Pure function with no browser/Node API imports.
 */

export const RESERVED_SUBDOMAINS = new Set(['api', 'in', 'www', 'cdn', 'admin', 'static', 'panel']);
const PORTAL_HOSTS = new Set(['zelys.app', 'in.zelys.app', 'www.zelys.app']);
const LOCAL_PORTAL_HOSTS = new Set(['localhost', '127.0.0.1', 'in.localhost']);
export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;

type RuntimeGlobals = {
    process?: { env?: Record<string, string | undefined> };
    location?: { hostname?: string; protocol?: string; port?: string };
};

function isDevRuntime(): boolean {
    const g = globalThis as RuntimeGlobals;
    if (g.process?.env) {
        return g.process.env.NODE_ENV !== 'production';
    }
    const hostname = g.location?.hostname?.toLowerCase() ?? '';
    return hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1';
}

function resolveLocalOrigin(): { protocol: string; port: string } {
    const g = globalThis as RuntimeGlobals;
    if (g.location?.hostname) {
        return {
            protocol: g.location.protocol || 'http:',
            port: g.location.port ? `:${g.location.port}` : '',
        };
    }
    const frontendUrl = g.process?.env?.FRONTEND_URL;
    if (frontendUrl) {
        try {
            const parsed = new URL(frontendUrl);
            return {
                protocol: parsed.protocol || 'http:',
                port: parsed.port ? `:${parsed.port}` : '',
            };
        } catch { /* fallback to default Vite port */ }
    }
    return { protocol: 'http:', port: ':5173' };
}

export function normalizeTenantSlug(value: string | null | undefined): string | null {
    if (!value) return null;
    const slug = value.trim().toLowerCase();
    if (!SLUG_REGEX.test(slug) || RESERVED_SUBDOMAINS.has(slug)) return null;
    return slug;
}

export function isValidTenantSlug(value: string | null | undefined): value is string {
    return normalizeTenantSlug(value) !== null;
}

/**
 * Normalizes any host or URL string to a clean lowercase domain name without protocol, path, or port.
 * e.g. "https://acme.zelys.app:443/api" -> "acme.zelys.app"
 *      "in.zelys.app"                   -> "in.zelys.app"
 */
export function normalizeHost(host: string): string {
    if (!host) return '';
    let clean = host.trim().toLowerCase();
    if (clean.includes('://')) {
        clean = clean.split('://')[1];
    }
    return clean.split('/')[0].split('?')[0].split(':')[0];
}

/**
 * Resolves the tenant slug for production domain (*.zelys.app).
 * Strict Host Header Spoofing protection: only exactly 3 segments ({slug}.zelys.app)
 * matching valid slug syntax and excluding reserved subdomains.
 *
 * e.g. "acme.zelys.app" -> "acme"
 *      "in.zelys.app"   -> null (portal)
 *      "api.zelys.app"  -> null (api)
 *      "zelys.app"      -> null
 *
 * @param host - Hostname or Origin URL (e.g. "acme.zelys.app" or "https://acme.zelys.app")
 * @param querySlug - Optional explicit slug override
 * @returns The resolved tenant slug, or null if no tenant identified
 */
export function resolveSlugFromHost(host: string, querySlug?: string | null): string | null {
    if (querySlug) return normalizeTenantSlug(querySlug);
    if (!host) return null;

    const cleanHost = normalizeHost(host);

    const parts = cleanHost.split('.');
    if (parts.length === 3 && parts[1] === 'zelys' && parts[2] === 'app') {
        const sub = parts[0];
        if (!RESERVED_SUBDOMAINS.has(sub) && isValidTenantSlug(sub)) {
            return sub;
        }
    }

    if (isDevRuntime() && parts.length === 2 && parts[1] === 'localhost') {
        const sub = parts[0];
        if (!RESERVED_SUBDOMAINS.has(sub) && isValidTenantSlug(sub)) {
            return sub;
        }
    }

    return null;
}

/**
 * Checks if the given hostname is the global portal/entry domain (in.zelys.app, zelys.app, www.zelys.app).
 * In development, also recognizes localhost, 127.0.0.1, and in.localhost.
 */
export function isGlobalPortalHost(host: string): boolean {
    if (!host) return false;
    const cleanHost = normalizeHost(host);
    if (PORTAL_HOSTS.has(cleanHost)) return true;
    return isDevRuntime() && LOCAL_PORTAL_HOSTS.has(cleanHost);
}

/**
 * Builds canonical tenant URL (https://{slug}.zelys.app/{path} in prod,
 * http://{slug}.localhost:{port}/{path} in dev).
 */
export function buildTenantUrl(
    slug: string,
    path = '/dashboard',
    options?: {
        queryParams?: Record<string, string>;
        [key: string]: any;
    }
): string {
    const normalizedSlug = slug ? normalizeTenantSlug(slug) : '';
    if (slug && !normalizedSlug) {
        throw new Error('Invalid tenant slug');
    }
    const cleanPath = !path ? '' : (path.startsWith('/') ? path : `/${path}`);
    let baseUrl: string;
    if (isDevRuntime()) {
        const { protocol, port } = resolveLocalOrigin();
        baseUrl = normalizedSlug
            ? `${protocol}//${normalizedSlug}.localhost${port}${cleanPath}`
            : `${protocol}//localhost${port}${cleanPath}`;
    } else {
        baseUrl = normalizedSlug ? `https://${normalizedSlug}.zelys.app${cleanPath}` : `https://in.zelys.app${cleanPath}`;
    }

    if (options?.queryParams) {
        const searchParams = new URLSearchParams();
        for (const [key, val] of Object.entries(options.queryParams)) {
            if (val !== undefined && val !== null) {
                searchParams.set(key, val);
            }
        }
        const qs = searchParams.toString();
        if (qs) {
            const sep = baseUrl.includes('?') ? '&' : '?';
            return `${baseUrl}${sep}${qs}`;
        }
    }

    return baseUrl;
}

