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


const rawDb = drizzle(queryClient, {
  schema,
  logger: env.NODE_ENV === 'development',
});

export const db = new Proxy(rawDb, {
  get(target, prop, receiver) {
    if (prop === 'transaction') {
      return (originalFn: any, config: any) => {
        return target.transaction(async (tx) => {
          const store = tenantStorage.getStore() || {};
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

export async function withTenantContext<T>(
  context: { companyId: number; userId?: number; ipAddress?: string },
  operation: () => Promise<T>
): Promise<T> {
  const store = tenantStorage.getStore();
  
  if (store?.tx) {
    return await operation();
  }

  return await rawDb.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_company_id', ${context.companyId.toString()}, true)`);
    if (context.userId) {
      await tx.execute(sql`SELECT set_config('app.user_id', ${context.userId.toString()}, true)`);
    }
    if (context.ipAddress) {
      await tx.execute(sql`SELECT set_config('app.ip_address', ${context.ipAddress}, true)`);
    }

    return await tenantStorage.run({ ...context, tx }, operation);
  });
}


