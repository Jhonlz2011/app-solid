import { Elysia } from 'elysia';

export const getIpAndUserAgent = (request: Request) => {
    const userAgent = request.headers.get('user-agent') || 'Desconocido';

    // Improved IP extraction
    let ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0].trim();
    if (!ipAddress) {
        ipAddress = request.headers.get('x-real-ip') || undefined;
    }

    // Fallback for local development if no headers present or localhost/private IP
    const isPrivateIP = !ipAddress || ipAddress === '::1' || ipAddress === '127.0.0.1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.');

    if (isPrivateIP && process.env.NODE_ENV !== 'production') {
        ipAddress = '157.100.108.123'; // Public IP for testing location (Guayaquil)
    }

    return { ipAddress, userAgent };
};

export const ipPlugin = new Elysia({ name: 'ip-plugin' })
    .derive(({ request }) => {
        return getIpAndUserAgent(request);
    });
