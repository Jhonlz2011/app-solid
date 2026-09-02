// src/config/redis.ts
import Redis, { RedisOptions } from 'ioredis';
import { env } from '../../config/env';

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

// --- CENTRALIZED MESSAGE HANDLER (Supports multiple handlers and patterns) ---
type ChannelCallback = (message: string) => void;
type PatternCallback = (pattern: string, channel: string, message: string) => void;

const channelHandlers = new Map<string, Set<ChannelCallback>>();
const patternHandlers = new Map<string, Set<PatternCallback>>();

// Global listener for exact channel messages
redisSub.on('message', (channel: string, message: string) => {
    const handlers = channelHandlers.get(channel);
    if (handlers) {
        handlers.forEach(handler => {
            try {
                handler(message);
            } catch (e) {
                console.error(`Error in Redis handler for ${channel}:`, e);
            }
        });
    }
});

// Global listener for pattern messages (psubscribe)
redisSub.on('pmessage', (pattern: string, channel: string, message: string) => {
    const handlers = patternHandlers.get(pattern);
    if (handlers) {
        handlers.forEach(handler => {
            try {
                handler(pattern, channel, message);
            } catch (e) {
                console.error(`Error in Redis pattern handler for ${pattern}:`, e);
            }
        });
    }
});

// --- EVENT HANDLERS ---

redis.on('connect', () => console.log('✅ Redis Client: Conectado'));
redis.on('error', (err) => console.error('❌ Redis Client Error:', err.message));
redis.on('close', () => console.log('⚠️ Redis Client: Desconectado'));

redisSub.on('connect', () => console.log('✅ Redis Subscriber: Conectado'));
redisSub.on('error', (err) => console.error('❌ Redis Subscriber Error:', err.message));
redisSub.on('close', () => console.log('⚠️ Redis Subscriber: Desconectado'));

// --- SUBSCRIPTION HELPERS ---

/**
 * Subscribe to a Redis channel with a callback handler.
 * Supports multiple subscribers per channel safely.
 */
export async function subscribeToChannel(
    channel: string,
    callback: ChannelCallback
): Promise<void> {
    try {
        let handlers = channelHandlers.get(channel);
        const isNewChannel = !handlers || handlers.size === 0;

        if (!handlers) {
            handlers = new Set();
            channelHandlers.set(channel, handlers);
        }
        handlers.add(callback);

        if (isNewChannel) {
            await redisSub.subscribe(channel);
            console.log(`📡 Suscrito al canal: ${channel}`);
        }
    } catch (error) {
        channelHandlers.get(channel)?.delete(callback);
        console.error(`❌ Error al suscribirse a ${channel}:`, error);
        throw error;
    }
}

/**
 * Unsubscribe from a Redis channel
 */
export async function unsubscribeFromChannel(
    channel: string,
    callback?: ChannelCallback
): Promise<void> {
    try {
        const handlers = channelHandlers.get(channel);
        if (handlers) {
            if (callback) {
                handlers.delete(callback);
            } else {
                handlers.clear();
            }

            if (handlers.size === 0) {
                channelHandlers.delete(channel);
                await redisSub.unsubscribe(channel);
                console.log(`📡 Desuscrito del canal: ${channel}`);
            }
        }
    } catch (error) {
        console.error(`❌ Error al desuscribirse de ${channel}:`, error);
    }
}

/**
 * Subscribe to a Redis channel pattern (e.g. sse:c:*) with a callback handler.
 */
export async function subscribeToPattern(
    pattern: string,
    callback: PatternCallback
): Promise<void> {
    try {
        let handlers = patternHandlers.get(pattern);
        const isNewPattern = !handlers || handlers.size === 0;

        if (!handlers) {
            handlers = new Set();
            patternHandlers.set(pattern, handlers);
        }
        handlers.add(callback);

        if (isNewPattern) {
            await redisSub.psubscribe(pattern);
            console.log(`📡 Suscrito al patrón: ${pattern}`);
        }
    } catch (error) {
        patternHandlers.get(pattern)?.delete(callback);
        console.error(`❌ Error al suscribirse al patrón ${pattern}:`, error);
        throw error;
    }
}

/**
 * Unsubscribe from a Redis pattern
 */
export async function unsubscribeFromPattern(
    pattern: string,
    callback?: PatternCallback
): Promise<void> {
    try {
        const handlers = patternHandlers.get(pattern);
        if (handlers) {
            if (callback) {
                handlers.delete(callback);
            } else {
                handlers.clear();
            }

            if (handlers.size === 0) {
                patternHandlers.delete(pattern);
                await redisSub.punsubscribe(pattern);
                console.log(`📡 Desuscrito del patrón: ${pattern}`);
            }
        }
    } catch (error) {
        console.error(`❌ Error al desuscribirse del patrón ${pattern}:`, error);
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