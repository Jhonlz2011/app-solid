import { createQuery } from '@tanstack/solid-query';
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';
import { vehiclesApi } from './vehicles.api';
import { vehicleKeys } from './vehicles.keys';

export function useVehiclesList() {
    return createQuery(() => ({
        queryKey: vehicleKeys.list(),
        queryFn: () => vehiclesApi.list(),
        staleTime: STALE_TIME.MEDIUM,
        gcTime: GC_TIME.DEFAULT,
    }));
}

export function useVehicle(id: () => number | null | undefined) {
    return createQuery(() => ({
        queryKey: vehicleKeys.detail(id() ?? 0),
        queryFn: () => vehiclesApi.get(id()!),
        enabled: Boolean(id() && id()! > 0),
        staleTime: STALE_TIME.MEDIUM,
        gcTime: GC_TIME.DEFAULT,
    }));
}
