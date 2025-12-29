import postgres from 'postgres';
import { redis } from './config/redis';

// Conexión dedicada para escuchar eventos (Postgres requiere una conexión dedicada para LISTEN)
const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString);

async function startListener() {
    console.log('👂 Listening for Postgres events on channel "db_events"...');

    await sql.listen('db_events', (payload) => {
        try {
            const event = JSON.parse(payload);
            console.log('🔔 DB Event received:', event.table, event.action, event.id);

            // Si es una actualización de productos, publicar en Redis
            if (event.table === 'products' && event.action === 'UPDATE') {
                const redisChannel = 'updates:products';
                const message = JSON.stringify({
                    id: event.id,
                    stock: event.data.stock_qty, // Mapeamos stock_qty a stock para el frontend
                    type: 'STOCK_UPDATE'
                });

                redis.publish(redisChannel, message);
                console.log(`📢 Relayed to Redis [${redisChannel}]:`, message);
            }
        } catch (err) {
            console.error('❌ Error processing notification:', err);
        }
    });
}

startListener().catch((err) => {
    console.error('❌ Listener failed to start:', err);
    process.exit(1);
});
