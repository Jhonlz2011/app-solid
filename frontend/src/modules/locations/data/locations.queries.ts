import { createQuery, useQueryClient } from '@tanstack/solid-query';
import { locationsApi, type LocationItem } from './locations.api';
import { locationKeys } from './locations.keys';
import type { Accessor } from 'solid-js';

/**
 * Fetch list of locations (optionally filtered by warehouse).
 */
export function useLocationList(warehouseId?: Accessor<number | undefined>) {
    return createQuery(() => {
        const whId = warehouseId?.();
        return {
            queryKey: whId !== undefined ? locationKeys.listByWarehouse(whId) : locationKeys.list(),
            queryFn: () => locationsApi.list(whId),
            staleTime: 1000 * 60 * 30, // 30 mins
        };
    });
}

/**
 * Fetch a single location by ID.
 * Uses placeholderData from locationKeys.list() cache if available (0ms load),
 * falling back to direct server fetch if navigated by direct URL.
 */
export function useLocation(id: () => number) {
    const qc = useQueryClient();
    return createQuery(() => {
        const locationId = id();
        return {
            queryKey: locationKeys.detail(locationId),
            queryFn: () => locationsApi.get(locationId),
            enabled: !!locationId && locationId > 0,
            placeholderData: () => {
                const list = qc.getQueryData<LocationItem[]>(locationKeys.list());
                return list?.find(item => item.id === locationId);
            },
            staleTime: 1000 * 60 * 5,
        };
    });
}

/**
 * Check references to a location before deletion.
 */
export function useCheckLocationReferences(id: Accessor<number | null>, enabled: Accessor<boolean>) {
    return createQuery(() => ({
        queryKey: locationKeys.references(id()!),
        queryFn: () => locationsApi.checkReferences(id()!),
        enabled: enabled() && id() !== null,
        staleTime: 0,
        retry: false,
    }));
}
