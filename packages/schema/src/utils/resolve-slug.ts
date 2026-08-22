/**
 * Isomorphic slug resolution from hostname — shared between frontend and backend.
 * Pure function with no browser/Node API dependencies.
 *
 * @param host - Hostname (may include port, e.g. "acme.zelys.app:3000")
 * @param querySlug - Optional slug override from URL query params (dev/IP fallback)
 * @returns The resolved tenant slug, or null if no tenant identified
 */
export function resolveSlugFromHost(host: string, querySlug?: string | null): string | null {
    const hostWithoutPort = host.split(':')[0];
    const ipRegex = /^[0-9.]+$/;
    const isIpOrLocal = ipRegex.test(hostWithoutPort) ||
                        hostWithoutPort === 'localhost' ||
                        hostWithoutPort === '127.0.0.1';

    if (isIpOrLocal) {
        return querySlug || null;
    }

    const parts = hostWithoutPort.split('.');

    if (hostWithoutPort.includes('zelys.app')) {
        if (parts.length > 2 && parts[0] !== 'api' && parts[0] !== 'in' && parts[0] !== 'www') {
            return parts[0];
        }
        return null;
    }

    if (parts.length > 1 && parts[parts.length - 1] === 'localhost') {
        return parts[0];
    }

    if (parts.length > 2) {
        return parts[0];
    }

    return null;
}

/**
 * Checks if the given hostname is the global portal/entry domain (e.g. in.zelys.app, zelys.app, in.localhost, localhost)
 */
export function isGlobalPortalHost(host: string): boolean {
    const hostWithoutPort = host.split(':')[0];
    const ipRegex = /^[0-9.]+$/;
    if (ipRegex.test(hostWithoutPort) || hostWithoutPort === 'localhost' || hostWithoutPort === '127.0.0.1') {
        return true;
    }

    const parts = hostWithoutPort.split('.');
    if (hostWithoutPort.includes('zelys.app')) {
        // in.zelys.app or root zelys.app or www.zelys.app
        return parts[0] === 'in' || parts[0] === 'www' || parts.length <= 2;
    }

    if (parts[0] === 'in') {
        return true;
    }

    return parts.length <= 2;
}

/**
 * Builds the canonical tenant URL across production wildcard domains and local environments.
 */
export function buildTenantUrl(
    slug: string,
    path = '/dashboard',
    options?: {
        currentHost?: string;
        currentProtocol?: string;
        port?: string;
        queryParams?: Record<string, string>;
    }
): string {
    const host = options?.currentHost || (typeof window !== 'undefined' ? window.location.hostname : 'zelys.app');
    const protocol = options?.currentProtocol || (typeof window !== 'undefined' ? window.location.protocol : 'https:');
    const port = options?.port || (typeof window !== 'undefined' ? window.location.port : '');
    const portStr = port ? `:${port}` : '';

    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const searchParams = new URLSearchParams();

    if (options?.queryParams) {
        for (const [key, val] of Object.entries(options.queryParams)) {
            if (val !== undefined && val !== null) {
                searchParams.set(key, val);
            }
        }
    }

    const hostWithoutPort = host.split(':')[0];
    const ipRegex = /^[0-9.]+$/;
    const isIpOrLocal = ipRegex.test(hostWithoutPort) ||
                        hostWithoutPort === 'localhost' ||
                        hostWithoutPort === '127.0.0.1';

    let baseUrl: string;

    if (isIpOrLocal) {
        searchParams.set('slug', slug);
        baseUrl = `${protocol}//${hostWithoutPort}${portStr}${cleanPath}`;
    } else if (hostWithoutPort.includes('zelys.app')) {
        baseUrl = `${protocol}//${slug}.zelys.app${portStr}${cleanPath}`;
    } else if (hostWithoutPort.endsWith('.localhost')) {
        baseUrl = `${protocol}//${slug}.localhost${portStr}${cleanPath}`;
    } else {
        const parts = hostWithoutPort.split('.');
        const baseDomain = parts.slice(-2).join('.');
        baseUrl = `${protocol}//${slug}.${baseDomain}${portStr}${cleanPath}`;
    }

    const queryString = searchParams.toString();
    if (queryString) {
        const separator = baseUrl.includes('?') ? '&' : '?';
        return `${baseUrl}${separator}${queryString}`;
    }

    return baseUrl;
}

