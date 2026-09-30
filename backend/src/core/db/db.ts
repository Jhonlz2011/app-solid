import { drizzlePostgres as drizzle, sql } from '@app/schema';
import postgres from 'postgres';
import { env } from '../../config/env';
import * as schema from '@app/schema';
import { AsyncLocalStorage } from 'async_hooks';
import { toPostgresSslOption } from './postgres-options';

export interface TenantContext {
  companyId?: number;
  organizationId?: string;
  membershipStatus?: 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
  userId?: string | number;
  sessionId?: string;
  ipAddress?: string;
  tx?: any;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: toPostgresSslOption(env.DATABASE_SSL_MODE),
});

const queryClientSri = postgres(env.REF_DATABASE_URL, { 
    max: 10, // Límite estricto para proteger la RAM del Droplet
    idle_timeout: 20, // Cierra conexiones inactivas rápido
    connect_timeout: 10,
    ssl: toPostgresSslOption(env.REF_DATABASE_SSL_MODE),
});

export const referenceDb = drizzle(queryClientSri, { logger: env.NODE_ENV === 'development' });

// Dedicated connection for PostgreSQL LISTEN/NOTIFY (e.g. audit worker)
export const listener = postgres(env.DATABASE_URL, {
  max: 1,
  idle_timeout: 0, // Keep connection alive for LISTEN
  connect_timeout: 10,
  ssl: toPostgresSslOption(env.DATABASE_SSL_MODE),
});

// =============================================================================
// Admin Database — Bypasses RLS for background workers (audit queue, etc.)
// Uses a separate connection pool. Production startup requires a dedicated URL.
// =============================================================================

const adminQueryClient = postgres(env.ADMIN_DATABASE_URL, {
  max: 3,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: toPostgresSslOption(env.ADMIN_DATABASE_SSL_MODE),
});

export const adminDb = drizzle(adminQueryClient, {
  schema,
  logger: env.NODE_ENV === 'development',
});

/** Close every Postgres.js pool for one-shot commands such as seeds and migrations. */
export async function closeDatabaseConnections(): Promise<void> {
  await Promise.all([
    queryClient.end({ timeout: 5 }),
    queryClientSri.end({ timeout: 5 }),
    listener.end({ timeout: 5 }),
    adminQueryClient.end({ timeout: 5 }),
  ]);
}

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

/** Apply PostgreSQL RLS settings to an existing transaction-scoped client. */
export async function applyTenantContextToTransaction(
  tx: Tx,
  context: Pick<TenantContext, 'companyId' | 'userId' | 'ipAddress'>,
): Promise<void> {
  if (!Number.isSafeInteger(context.companyId) || (context.companyId ?? 0) <= 0) {
    throw new Error('A valid companyId is required to establish tenant database context');
  }
  await injectTenantConfig(tx, context);
}

/**
 * Explicit tenant context wrapper. Opens a transaction, sets PostgreSQL session
 * variables for RLS, and stores the context in AsyncLocalStorage so nested
 * `db.*` calls transparently use the scoped transaction.
 *
 * Idempotent: if already inside a tenant context (with an active tx), just
 * runs the operation without opening a new transaction.
 */
export async function withTenantContext<T>(
  context: { companyId: number; userId?: string | number; ipAddress?: string },
  operation: (tx: Tx) => Promise<T>
): Promise<T> {
  const store = tenantStorage.getStore();
  
  if (store?.tx) {
    if (store.companyId !== context.companyId) {
      throw new Error('Cannot switch tenant inside an existing database transaction');
    }
    return await operation(store.tx);
  }

  return await rawDb.transaction(async (tx) => {
    await applyTenantContextToTransaction(tx, context);
    return await tenantStorage.run({ ...context, tx }, () => operation(tx));
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
    throw new Error('Tenant context is required for tenant-scoped database work');
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
