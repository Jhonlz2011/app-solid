import { createQuery } from '@tanstack/solid-query';
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';
import { attributesApi } from './attributes.api';
import { attributeKeys } from './attributes.keys';

/**
 * Fetch all attributes (catalog).
 */
export function useAttributeList() {
    return createQuery(() => ({
        queryKey: attributeKeys.all,
        queryFn: () => attributesApi.list(),
        staleTime: STALE_TIME.LONG,
        gcTime: GC_TIME.DEFAULT,
    }));
}

/**
 * Fetch a single attribute detail — only when id is valid.
 */
export function useAttributeDetail(id: () => number | null | undefined) {
    return createQuery(() => ({
        queryKey: attributeKeys.detail(id() ?? 0),
        queryFn: () => attributesApi.get(id()!),
        enabled: Boolean(id() && id()! > 0),
        staleTime: STALE_TIME.MEDIUM,
        gcTime: GC_TIME.DEFAULT,
    }));
}

/**
 * Check references to an attribute — only fetches when enabled.
 * Used by AttributeDeleteDialog before hard delete.
 */
export function useCheckAttributeReferences(id: () => number | null | undefined, enabled: () => boolean) {
    return createQuery(() => ({
        queryKey: attributeKeys.references(id() ?? 0),
        queryFn: () => attributesApi.checkReferences(id()!),
        enabled: enabled() && Boolean(id()),
        staleTime: 0,
        gcTime: GC_TIME.PREFLIGHT,
        retry: false,
    }));
}
