import { createQuery } from '@tanstack/solid-query';
import { attributesApi, type AttributeDef, type AttributeDetail } from './attributes.api';
import { attributeKeys } from './attributes.keys';

// =============================================================================
// Query Hooks — Attributes
// =============================================================================

export function useAttributes() {
    return createQuery(() => ({
        queryKey: attributeKeys.attributes,
        queryFn: () => attributesApi.listAttributes() as Promise<AttributeDef[]>,
        staleTime: 1000 * 60 * 10,
        gcTime: 1000 * 60 * 60,
    }));
}

export function useAttributeDetail(id: () => number | null) {
    return createQuery(() => ({
        queryKey: attributeKeys.attributeDetail(id()!),
        queryFn: () => attributesApi.getAttribute(id()!) as Promise<AttributeDetail>,
        enabled: id() !== null && id()! > 0,
        staleTime: 1000 * 60 * 5,
    }));
}
