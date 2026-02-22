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
     * Properly awaitable — resolves only after ALL keys are deleted.
     * Uses SCAN to avoid blocking Redis with KEYS command.
     * @param pattern Pattern to match (e.g. "products:*")
     */
    async invalidate(pattern: string): Promise<void> {
        try {
            return new Promise<void>((resolve, reject) => {
                const stream = redis.scanStream({
                    match: pattern,
                    count: 100,
                });

                const deletions: Promise<any>[] = [];

                stream.on('data', (keys: string[]) => {
                    if (keys.length) {
                        const pipeline = redis.pipeline();
                        keys.forEach((key) => pipeline.del(key));
                        deletions.push(pipeline.exec());
                    }
                });

                stream.on('end', () => {
                    Promise.all(deletions)
                        .then(() => resolve())
                        .catch(reject);
                });

                stream.on('error', (err) => {
                    console.error('Cache invalidation stream error:', err);
                    reject(err);
                });
            });
        } catch (error) {
            console.error('Cache invalidation error:', error);
        }
    },
};
