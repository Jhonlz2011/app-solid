import { createQuery } from '@tanstack/solid-query';
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';
import { warehousesApi } from './warehouses.api';
import { warehouseKeys } from './warehouses.keys';

// =============================================================================
// Warehouses
// =============================================================================

export function useWarehousesList() {
    return createQuery(() => ({
        queryKey: warehouseKeys.warehouses,
        queryFn: () => warehousesApi.list(),
        staleTime: STALE_TIME.LONG,
        gcTime: GC_TIME.DEFAULT,
    }));
}
