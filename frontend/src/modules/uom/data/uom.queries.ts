import { createQuery, useQueryClient } from '@tanstack/solid-query';
import { uomApi, type UomItem } from './uom.api';
import { uomKeys } from './uom.keys';
import type { Accessor } from 'solid-js';

/**
 * Fetch all UOMs (catalog).
 */
export function useUomList() {
    return createQuery(() => ({
        queryKey: uomKeys.all,
        queryFn: () => uomApi.list(),
        staleTime: 1000 * 60 * 30, // 30 minutes since it rarely changes
    }));
}

/**
 * Fetch a single UOM by ID.
 * Uses placeholderData from uomKeys.all cache if already available (0ms load),
 * while falling back to direct network fetch if loaded by direct URL.
 */
export function useUom(id: () => number) {
    const qc = useQueryClient();
    return createQuery(() => {
        const uomId = id();
        return {
            queryKey: uomKeys.detail(uomId),
            queryFn: () => uomApi.get(uomId),
            enabled: !!uomId && uomId > 0,
            placeholderData: () => {
                const list = qc.getQueryData<UomItem[]>(uomKeys.all);
                return list?.find(u => u.id === uomId);
            },
            staleTime: 1000 * 60 * 5,
        };
    });
}

/**
 * Check references to a UOM — only fetches when enabled.
 * Used by UomDeleteDialog before hard delete.
 */
export function useCheckUomReferences(id: Accessor<number | null>, enabled: Accessor<boolean>) {
    return createQuery(() => ({
        queryKey: uomKeys.references(id()!),
        queryFn: () => uomApi.checkReferences(id()!),
        enabled: enabled() && id() !== null,
        staleTime: 0, // Always re-fetch when dialog opens
        retry: false, // Don't retry on server error — avoids stuck loading state
    }));
}
