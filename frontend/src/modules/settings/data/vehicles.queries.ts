import { createQuery } from '@tanstack/solid-query';
import { vehiclesApi } from './vehicles.api';
import { vehicleKeys } from './vehicles.keys';

export function useVehiclesList() {
    return createQuery(() => ({
        queryKey: vehicleKeys.list(),
        queryFn: () => vehiclesApi.list(),
        staleTime: 1000 * 60 * 5,
    }));
}

export function useVehicle(id: () => number) {
    return createQuery(() => ({
        queryKey: vehicleKeys.detail(id()),
        queryFn: () => vehiclesApi.get(id()),
        enabled: id() > 0,
    }));
}
