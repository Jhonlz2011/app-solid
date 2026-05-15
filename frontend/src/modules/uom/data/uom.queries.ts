import { createQuery } from '@tanstack/solid-query';
import { uomApi } from './uom.api';
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
 * Check references to a UOM — only fetches when enabled.
 * Used by UomDeleteDialog before hard delete.
 */
export function useCheckUomReferences(id: Accessor<number | null>, enabled: Accessor<boolean>) {
    return createQuery(() => ({
        queryKey: [...uomKeys.all, 'references', id()] as const,
        queryFn: () => uomApi.checkReferences(id()!),
        enabled: enabled() && id() !== null,
        staleTime: 0, // Always re-fetch when dialog opens
        retry: false, // Don't retry on server error — avoids stuck loading state
    }));
}
