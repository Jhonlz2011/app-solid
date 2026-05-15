import { createQuery } from '@tanstack/solid-query';
import { locationsApi } from './locations.api';
import { locationKeys } from './locations.keys';
import type { Accessor } from 'solid-js';

/**
 * Fetch all locations.
 */
export function useLocationList() {
    return createQuery(() => ({
        queryKey: locationKeys.all,
        queryFn: () => locationsApi.list(),
        staleTime: 1000 * 60 * 30,
    }));
}

/**
 * Check references to a location — only fetches when enabled.
 * Used by LocationDeleteDialog before hard delete.
 */
export function useCheckLocationReferences(id: Accessor<number | null>, enabled: Accessor<boolean>) {
    return createQuery(() => ({
        queryKey: [...locationKeys.all, 'references', id()] as const,
        queryFn: () => locationsApi.checkReferences(id()!),
        enabled: enabled() && id() !== null,
        staleTime: 0,
        retry: false,
    }));
}
