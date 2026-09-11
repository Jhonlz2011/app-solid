/**
 * Production-Only Tenant Slug and Routing Resolution (*.zelys.app)
 * Shared between frontend and backend.
 * Pure function with no browser/Node API dependencies.
 */

const RESERVED_SUBDOMAINS = new Set(['api', 'in', 'www', 'cdn', 'admin', 'static']);
const PORTAL_HOSTS = new Set(['zelys.app', 'in.zelys.app', 'www.zelys.app']);
const SLUG_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

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
    if (querySlug) return querySlug;
    if (!host) return null;

    const cleanHost = normalizeHost(host);

    const parts = cleanHost.split('.');
    if (parts.length === 3 && parts[1] === 'zelys' && parts[2] === 'app') {
        const sub = parts[0];
        if (!RESERVED_SUBDOMAINS.has(sub) && SLUG_REGEX.test(sub)) {
            return sub;
        }
    }

    return null;
}

/**
 * Checks if the given hostname is the global portal/entry domain (in.zelys.app, zelys.app, www.zelys.app).
 * Uses exact O(1) set lookup to eliminate Host Header Spoofing or multi-subdomain bypasses.
 */
export function isGlobalPortalHost(host: string): boolean {
    if (!host) return false;
    const cleanHost = normalizeHost(host);
    return PORTAL_HOSTS.has(cleanHost);
}

/**
 * Builds canonical production tenant URL (https://{slug}.zelys.app/{path}).
 */
export function buildTenantUrl(
    slug: string,
    path = '/dashboard',
    options?: {
        queryParams?: Record<string, string>;
        [key: string]: any;
    }
): string {
    const cleanPath = !path ? '' : (path.startsWith('/') ? path : `/${path}`);
    const baseUrl = slug ? `https://${slug}.zelys.app${cleanPath}` : `https://in.zelys.app${cleanPath}`;

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

