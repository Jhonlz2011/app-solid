/**
 * attributes.mutations.ts — TanStack Mutation Hooks for Attributes module
 *
 * All mutations use optimistic updates for instant UI feedback:
 * - onMutate: cancel in-flight queries → snapshot cache → apply optimistic change
 * - onError: rollback to snapshot
 * - onSettled: invalidate to reconcile with server truth
 *
 * Cache shape: AttributeItem[] (flat array, no pagination wrapper)
 */
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { attributesApi, type AttributeItem } from './attributes.api';
import { attributeKeys } from './attributes.keys';
import type { AttributeFormData, AttributeDataType } from '@app/schema/frontend';

// =============================================================================
// Create — Optimistic insert with temporary negative ID
// =============================================================================

export function useCreateAttribute() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationKey: ['attributes', 'create'],
        mutationFn: (body: AttributeFormData) => attributesApi.create(body),
        onMutate: async (newAttr: AttributeFormData) => {
            await qc.cancelQueries({ queryKey: attributeKeys.all });
            const previous = qc.getQueryData<AttributeItem[]>(attributeKeys.all);

            qc.setQueryData<AttributeItem[]>(attributeKeys.all, (old) => {
                if (!old) return old;
                const optimistic: AttributeItem = {
                    id: -Date.now(),
                    company_id: 0,
                    key: '...',  // Placeholder — server generates real key from label
                    label: newAttr.label,
                    type: newAttr.type as AttributeDataType,
                    default_options: newAttr.defaultOptions ?? null,
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };
                return [...old, optimistic];
            });

            return { previous };
        },
        onError: (_err: unknown, _body: AttributeFormData, context: { previous?: AttributeItem[] } | undefined) => {
            if (context?.previous) qc.setQueryData(attributeKeys.all, context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: attributeKeys.all }),
    }));
}

// =============================================================================
// Update
// =============================================================================

export function useUpdateAttribute() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationKey: ['attributes', 'update'],
        mutationFn: ({ id, data }: { id: number; data: AttributeFormData }) => attributesApi.update(id, data),
        onMutate: async ({ id, data }: { id: number; data: AttributeFormData }) => {
            await qc.cancelQueries({ queryKey: attributeKeys.all });
            const previous = qc.getQueryData<AttributeItem[]>(attributeKeys.all);

            qc.setQueryData<AttributeItem[]>(attributeKeys.all, (old) =>
                old?.map(item => item.id === id ? {
                    ...item,
                    label: data.label ?? item.label,
                    type: (data.type as AttributeDataType) ?? item.type,
                    default_options: data.defaultOptions ?? item.default_options,
                } : item)
            );

            return { previous };
        },
        onError: (_err: unknown, _vars: { id: number; data: AttributeFormData }, context: { previous?: AttributeItem[] } | undefined) => {
            if (context?.previous) qc.setQueryData(attributeKeys.all, context.previous);
        },
        onSettled: (_d: unknown, _e: unknown, { id }: { id: number; data: AttributeFormData }) => {
            qc.invalidateQueries({ queryKey: attributeKeys.all });
            qc.invalidateQueries({ queryKey: attributeKeys.detail(id) });
        },
    }));
}

// =============================================================================
// Deactivate (soft delete) — Optimistic is_active = false
// =============================================================================

export function useDeactivateAttribute() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => attributesApi.deactivate(id),
        onMutate: async (id: number) => {
            await qc.cancelQueries({ queryKey: attributeKeys.all });
            const previous = qc.getQueryData<AttributeItem[]>(attributeKeys.all);

            qc.setQueryData<AttributeItem[]>(attributeKeys.all, (old) =>
                old?.map(item => item.id === id ? { ...item, is_active: false } : item)
            );

            return { previous };
        },
        onError: (_err: unknown, _id: number, context: { previous?: AttributeItem[] } | undefined) => {
            if (context?.previous) qc.setQueryData(attributeKeys.all, context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: attributeKeys.all }),
    }));
}

// =============================================================================
// Restore — Optimistic is_active = true
// =============================================================================

export function useRestoreAttribute() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => attributesApi.restore(id),
        onMutate: async (id: number) => {
            await qc.cancelQueries({ queryKey: attributeKeys.all });
            const previous = qc.getQueryData<AttributeItem[]>(attributeKeys.all);

            qc.setQueryData<AttributeItem[]>(attributeKeys.all, (old) =>
                old?.map(item => item.id === id ? { ...item, is_active: true } : item)
            );

            return { previous };
        },
        onError: (_err: unknown, _id: number, context: { previous?: AttributeItem[] } | undefined) => {
            if (context?.previous) qc.setQueryData(attributeKeys.all, context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: attributeKeys.all }),
    }));
}

// =============================================================================
// Hard Delete — Optimistic remove from array
// =============================================================================

export function useHardDeleteAttribute() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => attributesApi.hardDelete(id),
        onMutate: async (id: number) => {
            await qc.cancelQueries({ queryKey: attributeKeys.all });
            const previous = qc.getQueryData<AttributeItem[]>(attributeKeys.all);

            qc.setQueryData<AttributeItem[]>(attributeKeys.all, (old) =>
                old?.filter(item => item.id !== id)
            );

            return { previous };
        },
        onError: (_err: unknown, _id: number, context: { previous?: AttributeItem[] } | undefined) => {
            if (context?.previous) qc.setQueryData(attributeKeys.all, context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: attributeKeys.all }),
    }));
}
