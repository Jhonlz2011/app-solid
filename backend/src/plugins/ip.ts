import { Elysia } from 'elysia';

export const extractIpFromHeaders = (headers: Headers | { get(name: string): string | null }) => {
    const userAgent = headers.get('user-agent') || 'Desconocido';

    // Comprehensive IP extraction supporting Cloudflare, reverse proxies and load balancers
    let ipAddress =
        headers.get('cf-connecting-ip') ||
        headers.get('x-client-ip') ||
        headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        headers.get('x-real-ip') ||
        undefined;

    if (ipAddress) {
        // Strip IPv6 mapped IPv4 prefix if present (e.g., ::ffff:127.0.0.1 -> 127.0.0.1)
        if (ipAddress.startsWith('::ffff:')) {
            ipAddress = ipAddress.substring(7);
        }
        // Normalize IPv6 localhost
        if (ipAddress === '::1') {
            ipAddress = '127.0.0.1';
        }
    }

    // Fallback for local development if no headers present
    if (!ipAddress && process.env.NODE_ENV !== 'production') {
        ipAddress = '127.0.0.1';
    }

    return { ipAddress, userAgent };
};

export const getIpAndUserAgent = (request: Request) => extractIpFromHeaders(request.headers);

export const ipPlugin = new Elysia({ name: 'ip-plugin' })
    .derive(({ request }) => {
        return getIpAndUserAgent(request);
    });
