import { Elysia, t } from 'elysia';

type RateLimitStore = {
  tokens: number;
  lastRefill: number;
};

export const rateLimit = (options: {
  max?: number;
  windowMs?: number;
  message?: string;
  skipIf?: (request: Request) => boolean;
} = {}) => {
  const store = new Map<string, RateLimitStore>();
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

      const now = Date.now();
      const ip = request.headers.get('x-forwarded-for') || 'unknown';

      let bucket = store.get(ip);
      if (!bucket) {
        bucket = { tokens: max, lastRefill: now };
        store.set(ip, bucket);
      }

      // Rellenar tokens basado en el tiempo transcurrido
      const timePassed = now - bucket.lastRefill;
      const tokensToAdd = Math.floor(timePassed / windowMs) * max;

      if (tokensToAdd > 0) {
        bucket.tokens = Math.min(max, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;
      }

      if (bucket.tokens <= 0) {
        set.status = 429;
        set.headers['Retry-After'] = Math.ceil((windowMs - (now - bucket.lastRefill)) / 1000).toString();
        return {
          error: options.message || 'Demasiadas peticiones',
          retryAfter: Math.ceil((windowMs - (now - bucket.lastRefill)) / 1000)
        };
      }

      bucket.tokens--;

      // Limpiar store cada hora
      if (store.size > 10000) {
        const hour = 3600000;
        for (const [key, value] of store.entries()) {
          if (now - value.lastRefill > hour) {
            store.delete(key);
          }
        }
      }
    });
};