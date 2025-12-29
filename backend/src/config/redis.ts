import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';

/**
 * Redis connection options optimized for performance
 * Supports both TCP and Unix Socket connections
 */
const getRedisOptions = (): RedisOptions => {
    const baseOptions: RedisOptions = {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        retryStrategy(times) {
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        keepAlive: 10000,
        connectTimeout: 10000,
    };

    // Use Unix Socket if available (faster for local connections)
    if (env.REDIS_SOCKET_PATH) {
        return {
            ...baseOptions,
            path: env.REDIS_SOCKET_PATH,
        };
    }

    return baseOptions;
};

// Main Redis client for caching operations
export const redis = new Redis(
    env.REDIS_SOCKET_PATH || env.REDIS_URL,
    getRedisOptions()
);

// Separate subscriber client for Pub/Sub (required by Redis)
export const redisSub = new Redis(
    env.REDIS_SOCKET_PATH || env.REDIS_URL,
    getRedisOptions()
);

// Publisher client for sending events
export const redisPub = new Redis(
    env.REDIS_SOCKET_PATH || env.REDIS_URL,
    getRedisOptions()
);

redis.on('connect', () => {
    console.log('🔌 Redis cache client connected');
});

redis.on('error', (err) => {
    if ((err as any).code === 'ECONNREFUSED') {
        console.warn('⚠️ Redis connection refused. Cache will be unavailable.');
    } else {
        console.error('❌ Redis error:', err.message);
    }
});

redisSub.on('connect', () => {
    console.log('🔌 Redis subscriber connected');
});

redisSub.on('error', (err) => {
    if ((err as any).code !== 'ECONNREFUSED') {
        console.error('❌ Redis subscriber error:', err.message);
    }
});

/**
 * Subscribe to a Redis channel with callback
 */
export async function subscribeToChannel(
    channel: string,
    callback: (message: string) => void
): Promise<void> {
    try {
        await redisSub.subscribe(channel);
        redisSub.on('message', (ch, message) => {
            if (ch === channel) {
                callback(message);
            }
        });
        console.log(`✅ Subscribed to Redis channel: ${channel}`);
    } catch (error) {
        console.error(`❌ Failed to subscribe to ${channel}:`, error);
    }
}

/**
 * Publish message to Redis channel
 */
export async function publishToChannel(channel: string, data: any): Promise<void> {
    try {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        await redisPub.publish(channel, message);
    } catch (error) {
        console.error(`❌ Failed to publish to ${channel}:`, error);
    }
}
