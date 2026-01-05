// src/config/redis.ts
import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';

// --- CONFIGURATION ---
const redisConfig: RedisOptions = {
    maxRetriesPerRequest: null, // Important for streams/subscriptions
    enableReadyCheck: false,
    lazyConnect: true, // Don't connect until first command
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        console.log(`🔄 Redis retry attempt ${times}, waiting ${delay}ms...`);
        return delay;
    },
    reconnectOnError(err) {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
            return true;
        }
        return false;
    },
};

// --- CLIENTS ---

// Main client for Cache operations (Get, Set, Delete)
export const redis = new Redis(env.REDIS_URL, redisConfig);

// Subscriber client (EXCLUSIVE for subscriptions - Redis requirement)
export const redisSub = new Redis(env.REDIS_URL, {
    ...redisConfig,
    lazyConnect: false, // Connect immediately for subscriptions
});

// --- CENTRALIZED MESSAGE HANDLER (Fixes memory leak) ---
const channelHandlers = new Map<string, (message: string) => void>();

// Single global listener - prevents memory leak from multiple listeners
redisSub.on('message', (channel: string, message: string) => {
    const handler = channelHandlers.get(channel);
    if (handler) {
        handler(message);
    }
});

// --- EVENT HANDLERS ---

redis.on('connect', () => console.log('✅ Redis Client: Conectado'));
redis.on('error', (err) => console.error('❌ Redis Client Error:', err.message));
redis.on('close', () => console.log('⚠️ Redis Client: Desconectado'));

redisSub.on('connect', () => console.log('✅ Redis Subscriber: Conectado'));
redisSub.on('error', (err) => console.error('❌ Redis Subscriber Error:', err.message));
redisSub.on('close', () => console.log('⚠️ Redis Subscriber: Desconectado'));

// --- SUBSCRIPTION HELPER ---

/**
 * Subscribe to a Redis channel with a callback handler.
 * Uses centralized message handling to prevent memory leaks.
 */
export async function subscribeToChannel(
    channel: string,
    callback: (message: string) => void
): Promise<void> {
    try {
        // Register handler BEFORE subscribing
        channelHandlers.set(channel, callback);

        // Subscribe to channel
        await redisSub.subscribe(channel);

        console.log(`📡 Suscrito al canal: ${channel}`);
    } catch (error) {
        // Clean up handler on failure
        channelHandlers.delete(channel);
        console.error(`❌ Error al suscribirse a ${channel}:`, error);
        throw error;
    }
}

/**
 * Unsubscribe from a Redis channel
 */
export async function unsubscribeFromChannel(channel: string): Promise<void> {
    try {
        await redisSub.unsubscribe(channel);
        channelHandlers.delete(channel);
        console.log(`📡 Desuscrito del canal: ${channel}`);
    } catch (error) {
        console.error(`❌ Error al desuscribirse de ${channel}:`, error);
    }
}

// --- PUBLISH HELPER ---

/**
 * Publish a message to a Redis channel.
 * Uses the main redis client (not a separate publisher).
 */
export async function publishToChannel(channel: string, data: any): Promise<void> {
    try {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        await redis.publish(channel, message);
    } catch (error) {
        console.error(`❌ Error al publicar en ${channel}:`, error);
    }
}

// --- HEALTH CHECK ---

export async function isRedisConnected(): Promise<boolean> {
    try {
        await redis.ping();
        return true;
    } catch {
        return false;
    }
}

// --- GRACEFUL SHUTDOWN ---

export async function disconnectRedis(): Promise<void> {
    try {
        await redis.quit();
        await redisSub.quit();
        console.log('✅ Redis clients disconnected gracefully');
    } catch (error) {
        console.error('❌ Error disconnecting Redis:', error);
    }
}