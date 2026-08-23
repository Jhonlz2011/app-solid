import { createQuery, useQueryClient } from '@tanstack/solid-query';
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';
import { locationsApi, type LocationItem } from './locations.api';
import { locationKeys } from './locations.keys';

/**
 * Fetch list of locations (optionally filtered by warehouse).
 */
export function useLocationList(warehouseId?: () => number | undefined) {
    return createQuery(() => {
        const whId = warehouseId?.();
        return {
            queryKey: whId !== undefined ? locationKeys.listByWarehouse(whId) : locationKeys.list(),
            queryFn: () => locationsApi.list(whId),
            staleTime: STALE_TIME.LONG,
            gcTime: GC_TIME.DEFAULT,
        };
    });
}

/**
 * Fetch a single location by ID.
 * Uses placeholderData from locationKeys.list() cache if available (0ms load),
 * falling back to direct server fetch if navigated by direct URL.
 */
export function useLocation(id: () => number | null | undefined) {
    const qc = useQueryClient();
    return createQuery(() => {
        const locationId = id();
        return {
            queryKey: locationKeys.detail(locationId ?? 0),
            queryFn: () => locationsApi.get(locationId!),
            enabled: Boolean(locationId && locationId > 0),
            placeholderData: () => {
                const list = qc.getQueryData<LocationItem[]>(locationKeys.list());
                return list?.find(item => item.id === locationId);
            },
            staleTime: STALE_TIME.MEDIUM,
            gcTime: GC_TIME.DEFAULT,
        };
    });
}

/**
 * Check references to a location before deletion.
 */
export function useCheckLocationReferences(id: () => number | null | undefined, enabled: () => boolean) {
    return createQuery(() => ({
        queryKey: locationKeys.references(id() ?? 0),
        queryFn: () => locationsApi.checkReferences(id()!),
        enabled: enabled() && Boolean(id()),
        staleTime: 0,
        gcTime: GC_TIME.PREFLIGHT,
        retry: false,
    }));
}
