import { createQuery } from '@tanstack/solid-query';
import { warehousesApi } from './warehouses.api';
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
