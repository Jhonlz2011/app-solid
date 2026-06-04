import { drizzlePostgres as drizzle, sql } from '@app/schema';
import postgres from 'postgres';
import { env } from './config/env';
import { cacheService } from './services/cache.service';
import { broadcast } from './plugins/sse';
import * as schema from '@app/schema';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  companyId?: number;
  userId?: number;
  ipAddress?: string;
  tx?: any;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: false,
});

const queryClientSri = postgres(env.SRI_DATABASE_URL, { 
    max: 10, // Límite estricto para proteger la RAM del Droplet
    idle_timeout: 20 // Cierra conexiones inactivas rápido
});

export const sriDb = drizzle(queryClientSri, { logger: env.NODE_ENV === 'development' });

// Cliente dedicado para escuchar notificaciones (LISTEN)
// Postgres requiere una conexión dedicada para LISTEN/NOTIFY
export const listener = postgres(env.DATABASE_URL, {
  max: 1,
  idle_timeout: 0, // Mantener conexión viva
  ssl: false,
});

listener.listen('db_change', (payload: string) => {
  try {
    const data = JSON.parse(payload);
    const { table, action, id } = data;

    console.log(`🔔 DB Change Notification: ${table} ${action} ID:${id}`);

    // 1. Invalidate Redis Cache
    // Invalidar caché relacionado con la tabla
    cacheService.invalidate(`${table}:*`);

    // 2. Broadcast via WebSocket
    broadcast('db_change', data);

  } catch (error) {
    console.error('Error processing DB notification:', error);
  }
});

// =============================================================================
// Admin Database — Bypasses RLS for background workers (audit queue, etc.)
// Uses a separate connection pool. Falls back to main DATABASE_URL if
// ADMIN_DATABASE_URL is not configured.
// =============================================================================

const adminQueryClient = postgres(env.ADMIN_DATABASE_URL, {
  max: 3,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: false,
});

export const adminDb = drizzle(adminQueryClient, {
  schema,
  logger: env.NODE_ENV === 'development',
});

// =============================================================================
// Main Database — All tenant-scoped queries flow through this Proxy
// =============================================================================

const rawDb = drizzle(queryClient, {
  schema,
  logger: env.NODE_ENV === 'development',
});

/**
 * Injects `set_config` calls into a transaction based on the current tenant context
 * from AsyncLocalStorage. This ensures RLS policies receive the correct company_id.
 */
async function injectTenantConfig(tx: any, store: TenantContext) {
  if (store.companyId) {
    await tx.execute(sql`SELECT set_config('app.current_company_id', ${store.companyId.toString()}, true)`);
  }
  if (store.userId) {
    await tx.execute(sql`SELECT set_config('app.user_id', ${store.userId.toString()}, true)`);
  }
  if (store.ipAddress) {
    await tx.execute(sql`SELECT set_config('app.ip_address', ${store.ipAddress}, true)`);
  }
}

export const db = new Proxy(rawDb, {
  get(target, prop, receiver) {
    if (prop === 'transaction') {
      return (originalFn: any, config: any) => {
        return target.transaction(async (tx) => {
          const store = tenantStorage.getStore() || {};

          // Auto-inject tenant context into EVERY transaction
          // This ensures RLS policies are always enforced
          if (store.companyId && !store.tx) {
            await injectTenantConfig(tx, store);
          }

          return await tenantStorage.run({ ...store, tx }, () => originalFn(tx));
        }, config);
      };
    }
    const store = tenantStorage.getStore();
    const activeClient = store?.tx || target;
    const value = Reflect.get(activeClient, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(activeClient);
    }
    return value;
  }
});

export type Tx = Parameters<Parameters<typeof rawDb.transaction>[0]>[0];

/**
 * Explicit tenant context wrapper. Opens a transaction, sets PostgreSQL session
 * variables for RLS, and stores the context in AsyncLocalStorage so nested
 * `db.*` calls transparently use the scoped transaction.
 *
 * Idempotent: if already inside a tenant context (with an active tx), just
 * runs the operation without opening a new transaction.
 */
export async function withTenantContext<T>(
  context: { companyId: number; userId?: number; ipAddress?: string },
  operation: () => Promise<T>
): Promise<T> {
  const store = tenantStorage.getStore();
  
  if (store?.tx) {
    return await operation();
  }

  return await rawDb.transaction(async (tx) => {
    await injectTenantConfig(tx, context);
    return await tenantStorage.run({ ...context, tx }, operation);
  });
}

/**
 * Simplified tenant wrapper that reads context from AsyncLocalStorage.
 * Use this in services where the tenant context has been set by the
 * authGuard middleware (via tenantStorage.enterWith).
 *
 * Opens a transaction with RLS context automatically.
 * Idempotent: if already inside a tenant transaction, just runs the operation.
 */
export async function withTenant<T>(operation: () => Promise<T>): Promise<T> {
  const store = tenantStorage.getStore();

  if (!store?.companyId) {
    // No tenant context — run without RLS (e.g., auth routes, system queries)
    return await operation();
  }

  if (store.tx) {
    // Already inside a tenant transaction — just run the operation
    return await operation();
  }

  return await rawDb.transaction(async (tx) => {
    await injectTenantConfig(tx, store);
    return await tenantStorage.run({ ...store, tx }, operation);
  });
}
