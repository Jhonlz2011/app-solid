import { createQuery } from '@tanstack/solid-query';
import { warehousesApi, locationsApi, type WarehouseItem, type LocationItem } from './warehouses.api';
import { warehouseKeys } from './warehouses.keys';

// =============================================================================
// Warehouses
// =============================================================================

export function useWarehousesList() {
    return createQuery(() => ({
        queryKey: warehouseKeys.warehouses,
        queryFn: () => warehousesApi.list(),
        staleTime: 1000 * 60 * 10,
        gcTime: 1000 * 60 * 60,
    }));
}

// =============================================================================
// Locations
// =============================================================================

export function useLocationsByWarehouse(warehouseId: () => number | null) {
    return createQuery(() => ({
        queryKey: warehouseKeys.locationsByWarehouse(warehouseId()!),
        queryFn: () => locationsApi.list(warehouseId()!) as Promise<LocationItem[]>,
        enabled: warehouseId() !== null && warehouseId()! > 0,
        staleTime: 1000 * 60 * 5,
    }));
}
