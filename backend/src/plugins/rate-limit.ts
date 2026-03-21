import { Elysia, t } from 'elysia';
import { redis } from '../config/redis';

export const rateLimit = (options: {
  max?: number;
  windowMs?: number;
  message?: string;
  skipIf?: (request: Request) => boolean;
} = {}) => {
  const max = options.max || 100;
  const windowMs = options.windowMs || 60000; // 1 minuto por defecto

  return new Elysia()
    .model({
      rateLimitError: t.Object({
        error: t.String(),
        retryAfter: t.Number()
      })
    })
    .derive(async ({ request, set }) => {
      if (options.skipIf?.(request)) {
        return;
      }

      const ip = request.headers.get('x-forwarded-for') || 'unknown';
      const key = `ratelimit:${ip}`;

      // Redis Fixed Window Counter
      const current = await redis.incr(key);
      if (current === 1) {
        // Set expiry on the first request of the window
        await redis.pexpire(key, windowMs);
      }

      if (current > max) {
        const ttl = await redis.pttl(key);
        const retryAfter = Math.max(1, Math.ceil(ttl / 1000));
        
        set.status = 429;
        set.headers['Retry-After'] = retryAfter.toString();
        
        return {
          error: options.message || 'Demasiadas peticiones',
          retryAfter
        };
      }
    });
};