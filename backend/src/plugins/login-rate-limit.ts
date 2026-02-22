import { redis } from '../config/redis';

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 60; // 1 minute

/**
 * Distributed rate limiter for login endpoint using Redis.
 * 5 attempts per minute per IP. Survives process restarts and scales across instances.
 */
export const loginRateLimit = async ({ request, set }: { request: any, set: any }) => {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';

    const key = `rate:login:${ip}`;
    const attempts = await redis.incr(key);

    // Set TTL only on first attempt (when INCR creates the key)
    if (attempts === 1) {
        await redis.expire(key, WINDOW_SECONDS);
    }

    if (attempts > MAX_ATTEMPTS) {
        const ttl = await redis.ttl(key);
        const retryAfter = ttl > 0 ? ttl : WINDOW_SECONDS;

        set.status = 429;
        set.headers['Retry-After'] = retryAfter.toString();
        return new Response(JSON.stringify({
            error: 'Demasiados intentos de inicio de sesión. Por favor espera un momento.',
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

/**
 * Resets the attempt counter for a specific IP.
 * Should be called after a successful login.
 */
export const resetLoginAttempts = async (request: Request) => {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';

    await redis.del(`rate:login:${ip}`);
};
