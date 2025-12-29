import { Elysia } from 'elysia';

type RateLimitStore = {
    attempts: number;
    windowStart: number;
};

const store = new Map<string, RateLimitStore>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Strict rate limiter for login endpoint.
 * 5 attempts per minute per IP.
 */
export const loginRateLimit = new Elysia({ name: 'loginRateLimit' })
    .derive(async ({ request, set }) => {
        const now = Date.now();
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            'unknown';

        let bucket = store.get(ip);

        if (!bucket || now - bucket.windowStart > WINDOW_MS) {
            // New window
            bucket = { attempts: 0, windowStart: now };
            store.set(ip, bucket);
        }

        bucket.attempts++;

        if (bucket.attempts > MAX_ATTEMPTS) {
            const retryAfter = Math.ceil((WINDOW_MS - (now - bucket.windowStart)) / 1000);
            set.status = 429;
            set.headers['Retry-After'] = retryAfter.toString();
            return {
                error: 'Demasiados intentos de inicio de sesión. Por favor espera un momento.',
                retryAfter
            };
        }

        // Cleanup old entries every 5 minutes
        if (store.size > 1000) {
            for (const [key, value] of store.entries()) {
                if (now - value.windowStart > WINDOW_MS * 5) {
                    store.delete(key);
                }
            }
        }
    });
