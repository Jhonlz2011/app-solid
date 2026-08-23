import { createQuery, useQueryClient } from '@tanstack/solid-query';
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';
import { uomApi, type UomItem } from './uom.api';
import { uomKeys } from './uom.keys';

/**
 * Fetch all UOMs (catalog).
 */
export function useUomList() {
    return createQuery(() => ({
        queryKey: uomKeys.all,
        queryFn: () => uomApi.list(),
        staleTime: STALE_TIME.LONG,
        gcTime: GC_TIME.DEFAULT,
    }));
}

/**
 * Fetch a single UOM by ID.
 * Uses placeholderData from uomKeys.all cache if already available (0ms load),
 * while falling back to direct network fetch if loaded by direct URL.
 */
export function useUom(id: () => number | null | undefined) {
    const qc = useQueryClient();
    return createQuery(() => {
        const uomId = id();
        return {
            queryKey: uomKeys.detail(uomId ?? 0),
            queryFn: () => uomApi.get(uomId!),
            enabled: Boolean(uomId && uomId > 0),
            placeholderData: () => {
                const list = qc.getQueryData<UomItem[]>(uomKeys.all);
                return list?.find(u => u.id === uomId);
            },
            staleTime: STALE_TIME.MEDIUM,
            gcTime: GC_TIME.DEFAULT,
        };
    });
}

/**
 * Check references to a UOM — only fetches when enabled.
 * Used by UomDeleteDialog before hard delete.
 */
export function useCheckUomReferences(id: () => number | null | undefined, enabled: () => boolean) {
    return createQuery(() => ({
        queryKey: uomKeys.references(id() ?? 0),
        queryFn: () => uomApi.checkReferences(id()!),
        enabled: enabled() && Boolean(id()),
        staleTime: 0,
        gcTime: GC_TIME.PREFLIGHT,
        retry: false,
    }));
}
