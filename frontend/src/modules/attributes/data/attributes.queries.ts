import { createQuery } from '@tanstack/solid-query';
import { attributesApi } from './attributes.api';
import { attributeKeys } from './attributes.keys';
import type { AttributeItem, AttributeDetail, AttributeReferences } from './attributes.api';
import type { Accessor } from 'solid-js';

/**
 * Fetch all attributes (catalog).
 */
export function useAttributeList() {
    return createQuery(() => ({
        queryKey: attributeKeys.all,
        queryFn: () => attributesApi.list(),
        staleTime: 1000 * 60 * 30,
    }));
}

/**
 * Fetch a single attribute detail — only when id is valid.
 */
export function useAttributeDetail(id: Accessor<number | null>) {
    return createQuery(() => ({
        queryKey: attributeKeys.detail(id() ?? 0),
        queryFn: () => attributesApi.get(id()!) as Promise<AttributeDetail>,
        enabled: id() !== null && id()! > 0,
        staleTime: 1000 * 60 * 5,
    }));
}

/**
 * Check references to an attribute — only fetches when enabled.
 * Used by AttributeDeleteDialog before hard delete.
 */
export function useCheckAttributeReferences(id: Accessor<number | null>, enabled: Accessor<boolean>) {
    return createQuery(() => ({
        queryKey: [...attributeKeys.all, 'references', id()] as const,
        queryFn: () => attributesApi.checkReferences(id()!),
        enabled: enabled() && id() !== null,
        staleTime: 0,
        retry: false,
    }));
}
