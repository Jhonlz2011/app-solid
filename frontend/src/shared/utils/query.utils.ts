/**
 * Utility functions for mutating TanStack Query cache data.
 * Supports both standard paginated queries ({ data: [], meta: {} })
 * and infinite queries ({ pages: [{ data: [], meta: {} }] }).
 */

// =============================================================================
// Cache shape types
// =============================================================================

interface CacheMeta {
    total: number;
    [key: string]: unknown;
}

interface CachePage<T> {
    data: T[];
    meta?: CacheMeta;
}

interface StandardCache<T> extends CachePage<T> {}

interface InfiniteCache<T> {
    pages: CachePage<T>[];
    [key: string]: unknown;
}

export type CacheShape<T> = StandardCache<T> | InfiniteCache<T>;

function isInfiniteCache<T>(old: CacheShape<T>): old is InfiniteCache<T> {
    return 'pages' in old && Array.isArray((old as InfiniteCache<T>).pages);
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Adds an item to the beginning of the list optimistically.
 */
export function addOptimisticItem<T extends { id: string | number }>(
    old: CacheShape<T> | undefined,
    newItem: T
): CacheShape<T> | undefined {
    if (!old) return old;

    if (isInfiniteCache(old)) {
        return {
            ...old,
            pages: old.pages.map((page, index) =>
                index === 0
                    ? {
                          ...page,
                          data: [newItem, ...(page.data ?? [])],
                          meta: { ...page.meta, total: (page.meta?.total ?? 0) + 1 },
                      }
                    : page
            ),
        };
    }

    return {
        ...old,
        data: [newItem, ...(old.data ?? [])],
        meta: { ...old.meta, total: (old.meta?.total ?? 0) + 1 },
    };
}

/**
 * Removes items from the list by their IDs.
 */
export function removeCacheItems<T extends { id: string | number }>(
    old: CacheShape<T> | undefined,
    idsToRemove: (string | number)[]
): CacheShape<T> | undefined {
    if (!old) return old;
    const idSet = new Set(idsToRemove);

    if (isInfiniteCache(old)) {
        return {
            ...old,
            pages: old.pages.map((page) => {
                if (!page.data) return page;
                const filtered = page.data.filter((item) => !idSet.has(item.id));
                const removed = page.data.length - filtered.length;
                return {
                    ...page,
                    data: filtered,
                    meta: { ...page.meta, total: Math.max(0, (page.meta?.total ?? 0) - removed) },
                };
            }),
        };
    }

    const filtered = (old.data ?? []).filter((item) => !idSet.has(item.id));
    const removed = (old.data ?? []).length - filtered.length;
    return {
        ...old,
        data: filtered,
        meta: { ...old.meta, total: Math.max(0, (old.meta?.total ?? 0) - removed) },
    };
}

/**
 * Updates an item that already exists in the list.
 */
export function updateCacheItem<T extends { id: string | number }>(
    old: CacheShape<T> | undefined,
    updatedItem: T
): CacheShape<T> | undefined {
    if (!old) return old;

    if (isInfiniteCache(old)) {
        return {
            ...old,
            pages: old.pages.map((page) => ({
                ...page,
                data: (page.data ?? []).map((item) =>
                    item.id === updatedItem.id ? { ...item, ...updatedItem } : item
                ),
            })),
        };
    }

    return {
        ...old,
        data: (old.data ?? []).map((item) =>
            item.id === updatedItem.id ? { ...item, ...updatedItem } : item
        ),
    };
}

/**
 * Checks if an item exists in the cache.
 */
export function cacheContainsItem<T extends { id: string | number }>(
    old: CacheShape<T> | undefined,
    id: string | number
): boolean {
    if (!old) return false;

    if (isInfiniteCache(old)) {
        return old.pages.some((page) =>
            (page.data ?? []).some((item) => item.id === id)
        );
    }

    return (old.data ?? []).some((item) => item.id === id);
}
