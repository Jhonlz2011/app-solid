import { drizzlePostgres as drizzle } from '@app/schema';
import postgres from 'postgres';
import { env } from './config/env';
import { cacheService } from './services/cache.service';
import { broadcast } from './plugins/ws';

const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: false,
});

// Cliente dedicado para escuchar notificaciones (LISTEN)
// Postgres requiere una conexión dedicada para LISTEN/NOTIFY
const listener = postgres(env.DATABASE_URL, {
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

import * as schema from '@app/schema';

export const db = drizzle(queryClient, {
  schema,
  logger: env.NODE_ENV === 'development',
});

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

