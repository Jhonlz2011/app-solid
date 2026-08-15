/**
 * Mock Redis Client for Multi-Tenant E2E Testing
 * Tracks all cache operations, keys, TTLs, and invalidation patterns
 * to verify tenant isolation (prefix:c${companyId}:*).
 */
export class MockRedisService {
    private store: Map<string, { value: any; expiry: number | null }> = new Map();
    public operations: Array<{ type: 'get' | 'set' | 'del' | 'invalidate'; key: string; timestamp: number }> = [];

    async get<T = any>(key: string): Promise<T | null> {
        this.operations.push({ type: 'get', key, timestamp: Date.now() });
        const entry = this.store.get(key);
        if (!entry) return null;
        if (entry.expiry !== null && Date.now() > entry.expiry) {
            this.store.delete(key);
            return null;
        }
        return entry.value as T;
    }

    async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
        this.operations.push({ type: 'set', key, timestamp: Date.now() });
        const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
        this.store.set(key, { value, expiry });
    }

    async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
        const cached = await this.get<T>(key);
        if (cached !== null && cached !== undefined) {
            return cached;
        }
        const fresh = await factory();
        await this.set(key, fresh, ttlSeconds);
        return fresh;
    }

    async del(key: string): Promise<void> {
        this.operations.push({ type: 'del', key, timestamp: Date.now() });
        this.store.delete(key);
    }

    async invalidate(pattern: string): Promise<number> {
        this.operations.push({ type: 'invalidate', key: pattern, timestamp: Date.now() });
        const regexStr = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexStr}$`);

        let count = 0;
        for (const key of Array.from(this.store.keys())) {
            if (regex.test(key)) {
                this.store.delete(key);
                count++;
            }
        }
        return count;
    }

    getAllKeys(): string[] {
        return Array.from(this.store.keys());
    }

    getTenantKeys(companyId: number): string[] {
        return Array.from(this.store.keys()).filter(k => k.includes(`:c${companyId}:`) || k.includes(`:c${companyId}`));
    }

    getGlobalKeys(): string[] {
        return Array.from(this.store.keys()).filter(k => !k.match(/:c\d+(:|$)/));
    }

    clear(): void {
        this.store.clear();
        this.operations = [];
    }
}

export const mockRedis = new MockRedisService();
