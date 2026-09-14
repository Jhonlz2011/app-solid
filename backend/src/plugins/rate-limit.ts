import { Elysia } from 'elysia';
import { redis } from '../core/cache/redis';
import { extractIpFromHeaders } from './ip';
import { API_ERROR_CODES, ERROR_MESSAGES_ES } from '@app/schema/errors';

// ============================================================================
// Redis Atomic Sliding Window Lua Script
// ============================================================================
// Removes out-of-window requests, counts current, and conditionally appends
// the new request timestamp in a single atomic network roundtrip.
// Returns: [allowed (1|0), remaining, retryAfterSeconds]
// ============================================================================
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local clearBefore = now - window

redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
local count = redis.call('ZCARD', key)

if count < max then
    local seq = redis.call('INCR', key .. ':seq')
    local member = tostring(now) .. ':' .. tostring(seq)
    redis.call('ZADD', key, now, member)
    redis.call('PEXPIRE', key, window)
    redis.call('PEXPIRE', key .. ':seq', window)
    return { 1, max - count - 1, 0 }
else
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local oldestTime = tonumber(oldest[2]) or now
    local resetMs = oldestTime + window - now
    local retryAfter = math.max(1, math.ceil(resetMs / 1000))
    return { 0, 0, retryAfter }
end
`;

export interface RateLimitOptions {
    prefix?: string;
    max: number;
    windowMs: number;
    message?: string;
    keyGenerator?: (request: Request) => string;
    skipIf?: (request: Request) => boolean;
}

/**
 * Creates an enterprise-grade route guard for Elysia's beforeHandle hook.
 * Uses atomic Redis sliding window with zero TTL leak and fail-open tolerance.
 */
export function createRateLimitGuard(options: RateLimitOptions) {
    const {
        prefix = 'rate',
        max,
        windowMs,
        message = ERROR_MESSAGES_ES.TOO_MANY_REQUESTS,
        keyGenerator = (req) => {
            const { ipAddress } = extractIpFromHeaders(req.headers);
            return ipAddress || 'unknown';
        },
        skipIf,
    } = options;

    return async ({
        request,
        set,
    }: {
        request: Request;
        set: { status?: number | string; headers: Record<string, string | undefined> };
    }): Promise<Response | void> => {
        if (skipIf?.(request)) return;

        const clientKey = keyGenerator(request);
        const key = `${prefix}:${clientKey}`;
        const now = Date.now();

        try {
            const rawResult = (await redis.eval(
                SLIDING_WINDOW_LUA,
                1,
                key,
                now,
                windowMs,
                max
            )) as [number, number, number];

            const [allowed, remaining, retryAfter] = rawResult;

            if (allowed === 1) {
                set.headers['X-RateLimit-Limit'] = String(max);
                set.headers['X-RateLimit-Remaining'] = String(remaining);
                return;
            }

            // Rate limit exceeded: return HTTP 429
            set.status = 429;
            set.headers['Retry-After'] = String(retryAfter);
            set.headers['X-RateLimit-Limit'] = String(max);
            set.headers['X-RateLimit-Remaining'] = '0';
            set.headers['X-RateLimit-Reset'] = String(Math.ceil((now + retryAfter * 1000) / 1000));

            return new Response(
                JSON.stringify({
                    code: API_ERROR_CODES.TOO_MANY_REQUESTS,
                    message,
                }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Retry-After': String(retryAfter),
                        'X-RateLimit-Limit': String(max),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': String(Math.ceil((now + retryAfter * 1000) / 1000)),
                    },
                }
            );
        } catch (error) {
            console.warn(`[RateLimit] Redis unreachable on key "${key}", failing open:`, error);
            return;
        }
    };
}

// ============================================================================
// Pre-configured Guards for Application Routes
// ============================================================================

/**
 * Guard for account and tenant creation mutations (POST /tenants/register, POST /tenants/onboard).
 * 10 attempts per 60s per client IP — prevents mass account creation while allowing normal onboarding.
 */
export const registerRateLimit = createRateLimitGuard({
    prefix: 'rate:register',
    max: 10,
    windowMs: 60 * 1000,
    message: 'Demasiados intentos de registro. Por favor espera un momento antes de continuar.',
});

/**
 * Guard for live availability queries (GET /check-slug, /check-ruc, /check-email, /check-domain).
 * 60 checks per 60s per client IP — allows natural typing with debounce.
 */
export const checkRateLimit = createRateLimitGuard({
    prefix: 'rate:check',
    max: 60,
    windowMs: 60 * 1000,
    message: 'Demasiadas comprobaciones. Por favor espera un momento antes de continuar.',
});

// ============================================================================
// Elysia Plugin for Middleware Mounting
// ============================================================================

/**
 * Global rate limiting plugin for Elysia sub-applications or routers.
 */
export const rateLimit = (options?: Partial<RateLimitOptions>) => {
    const guard = createRateLimitGuard({
        prefix: options?.prefix ?? 'rate:global',
        max: options?.max ?? 100,
        windowMs: options?.windowMs ?? 60 * 1000,
        message: options?.message,
        keyGenerator: options?.keyGenerator,
        skipIf: options?.skipIf,
    });

    return new Elysia({ name: 'rate-limit' }).onBeforeHandle(async ({ request, set }) => {
        return await guard({ request, set: set as any });
    });
};