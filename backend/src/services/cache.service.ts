import { redis } from '../config/redis';

export const cacheService = {
    /**
     * Get data from cache or fetch it from source and cache it.
     * @param key Cache key
     * @param fetcher Function to fetch data if cache miss
     * @param ttl Time to live in seconds (default 1 hour)
     */
    async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl: number = 3600): Promise<T> {
        try {
            const cached = await redis.get(key);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (error) {
            console.error('Cache read error:', error);
        }

        const data = await fetcher();

        try {
            if (data) {
                await redis.set(key, JSON.stringify(data), 'EX', ttl);
            }
        } catch (error) {
            console.error('Cache write error:', error);
        }

        return data;
    },

    /**
     * Invalidate cache keys matching a pattern.
     * @param pattern Pattern to match (e.g. "products:*")
     */
    async invalidate(pattern: string): Promise<void> {
        try {
            // Usar SCAN para borrar claves de forma segura sin bloquear
            const stream = redis.scanStream({
                match: pattern,
                count: 100
            });

            stream.on('data', async (keys: string[]) => {
                if (keys.length) {
                    const pipeline = redis.pipeline();
                    keys.forEach((key) => pipeline.del(key));
                    await pipeline.exec();
                }
            });

            stream.on('end', () => {
                console.log(`Cache invalidated for pattern: ${pattern}`);
            });
        } catch (error) {
            console.error('Cache invalidation error:', error);
        }
    }
};
