import { redis } from './redis';

export const cacheService = {
    async get<T>(key: string): Promise<T | null> {
        try {
            const cached = await redis.get(key);
            return cached ? (JSON.parse(cached) as T) : null;
        } catch (error) {
            console.error('Cache read error:', error);
            return null;
        }
    },

    async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
        try {
            const shouldCache = Array.isArray(value) ? value.length > 0 : value != null;
            if (shouldCache) {
                await redis.set(key, JSON.stringify(value), 'EX', ttl);
            }
        } catch (error) {
            console.error('Cache write error:', error);
        }
    },

    /**
     * Get data from cache or fetch it from source and cache it.
     * @param key Cache key
     * @param fetcher Function to fetch data if cache miss
     * @param ttl Time to live in seconds (default 1 hour)
     */
    async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl: number = 3600): Promise<T> {
        const cached = await cacheService.get<T>(key);
        if (cached !== null) {
            return cached;
        }

        const data = await fetcher();
        await cacheService.set(key, data, ttl);
        return data;
    },

    /**
     * Delete one or more specific cache keys directly (O(1) per key).
     * Use this when the exact key is known instead of scanning patterns.
     * @param keys One or more exact cache keys
     */
    async del(...keys: string[]): Promise<void> {
        const validKeys = keys.filter(Boolean);
        if (!validKeys.length) return;
        try {
            await redis.del(...validKeys);
        } catch (error) {
            console.error('Cache del error:', error);
        }
    },

    /**
     * Invalidate cache keys matching a pattern.
     * Properly awaitable — resolves only after ALL keys are deleted.
     * Uses SCAN to avoid blocking Redis with KEYS command.
     * Fast-paths directly to DEL (O(1)) when pattern has no wildcards.
     * @param pattern Pattern to match (e.g. "products:*") or exact key
     */
    async invalidate(pattern: string): Promise<void> {
        if (!pattern) return;

        // Fast-path: If pattern contains no glob wildcards, execute O(1) DEL directly
        if (!pattern.includes('*') && !pattern.includes('?') && !pattern.includes('[')) {
            return cacheService.del(pattern);
        }

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
