import { redis } from '../config/redis';

const MAX_ATTEMPTS = 3;
const WINDOW_SECONDS = 60; // 1 minute

/**
 * Distributed rate limiter for register endpoint using Redis.
 * 3 attempts per minute per IP — prevents mass account creation.
 */
export const registerRateLimit = async ({ request, set }: { request: any, set: any }) => {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';

    const key = `rate:register:${ip}`;
    const attempts = await redis.incr(key);

    if (attempts === 1) {
        await redis.expire(key, WINDOW_SECONDS);
    }

    if (attempts > MAX_ATTEMPTS) {
        const ttl = await redis.ttl(key);
        const retryAfter = ttl > 0 ? ttl : WINDOW_SECONDS;

        set.status = 429;
        set.headers['Retry-After'] = retryAfter.toString();
        return new Response(JSON.stringify({
            error: 'Demasiados intentos de registro. Por favor espera un momento.',
            retryAfter
        }), {
            status: 429,
            headers: {
                'Content-Type': 'application/json',
                'Retry-After': retryAfter.toString()
            }
        });
    }
};
