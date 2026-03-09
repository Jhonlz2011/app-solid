/**
 * Utility functions for mutating TanStack Query cache data.
 * Supports both standard paginated queries ({ data: [], meta: {} })
 * and infinite queries ({ pages: [{ data: [], meta: {} }] }).
 */

/**
 * Adds an item to the beginning of the list optimistically.
 */
export function addOptimisticItem<T extends { id: string | number }>(old: any, newItem: T) {
    if (!old) return old;

    if ('pages' in old && Array.isArray(old.pages)) {
        return {
            ...old,
            pages: old.pages.map((page: any, index: number) =>
                index === 0
                    ? {
                          ...page,
                          data: [newItem, ...(page.data || [])],
                          meta: { ...page.meta, total: (page.meta?.total || 0) + 1 }
                      }
                    : page
            )
        };
    }

    if (old.data && Array.isArray(old.data)) {
        return {
            ...old,
            data: [newItem, ...old.data],
            meta: { ...old.meta, total: (old.meta?.total || 0) + 1 }
        };
    }

    return old;
}

/**
 * Removes items from the list by their IDs.
 */
export function removeCacheItems(old: any, idsToRemove: (string | number)[]) {
    if (!old) return old;

    const idSet = new Set(idsToRemove);

    if ('pages' in old && Array.isArray(old.pages)) {
        return {
            ...old,
            pages: old.pages.map((page: any) => {
                if (!page.data || !Array.isArray(page.data)) return page;
                const filteredData = page.data.filter((item: any) => !idSet.has(item.id));
                const removedCount = page.data.length - filteredData.length;
                return {
                    ...page,
                    data: filteredData,
                    meta: { ...page.meta, total: Math.max(0, (page.meta?.total || 0) - removedCount) }
                };
            })
        };
    }

    if (old.data && Array.isArray(old.data)) {
        const filteredData = old.data.filter((item: any) => !idSet.has(item.id));
        const removedCount = old.data.length - filteredData.length;
        return {
            ...old,
            data: filteredData,
            meta: { ...old.meta, total: Math.max(0, (old.meta?.total || 0) - removedCount) }
        };
    }

    return old;
}

/**
 * Updates an item that already exists in the list.
 */
export function updateCacheItem<T extends { id: string | number }>(old: any, updatedItem: T) {
    if (!old) return old;

    if ('pages' in old && Array.isArray(old.pages)) {
        return {
            ...old,
            pages: old.pages.map((page: any) => {
                if (!page.data || !Array.isArray(page.data)) return page;
                return {
                    ...page,
                    data: page.data.map((item: any) =>
                        item.id === updatedItem.id ? { ...item, ...updatedItem } : item
                    )
                };
            })
        };
    }

    if (old.data && Array.isArray(old.data)) {
        return {
            ...old,
            data: old.data.map((item: any) =>
                item.id === updatedItem.id ? { ...item, ...updatedItem } : item
            )
        };
    }

    return old;
}

/**
 * Checks if an item exists in the cache.
 */
export function cacheContainsItem(old: any, id: string | number): boolean {
    if (!old) return false;

    if ('pages' in old && Array.isArray(old.pages)) {
        return old.pages.some((page: any) => 
            page.data && Array.isArray(page.data) && page.data.some((item: any) => item.id === id)
        );
    }

    if (old.data && Array.isArray(old.data)) {
        return old.data.some((item: any) => item.id === id);
    }

    return false;
}
