import { createQuery } from '@tanstack/solid-query';
import { locationsApi } from './locations.api';
import { locationKeys } from './locations.keys';
import type { Accessor } from 'solid-js';

export function useLocationList() {
    return createQuery(() => ({
        queryKey: locationKeys.list(),
        queryFn: () => locationsApi.list(),
        staleTime: 1000 * 60 * 30,
    }));
}

export function useCheckLocationReferences(id: Accessor<number | null>, enabled: Accessor<boolean>) {
    return createQuery(() => ({
        queryKey: locationKeys.references(id()!),
        queryFn: () => locationsApi.checkReferences(id()!),
        enabled: enabled() && id() !== null,
        staleTime: 0,
        retry: false,
    }));
}
