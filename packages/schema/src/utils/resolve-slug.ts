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
