import { redis } from './redis';

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
            // No cachear arrays vacíos ni valores null/undefined
            // Un array vacío [] es truthy pero indica tabla vacía — no cachear para forzar retry
            const shouldCache = Array.isArray(data) ? (data as any[]).length > 0 : data != null;
            if (shouldCache) {
                await redis.set(key, JSON.stringify(data), 'EX', ttl);
            }
        } catch (error) {
            console.error('Cache write error:', error);
        }

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
