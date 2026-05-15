/**
 * uom.mutations.ts — TanStack Mutation Hooks for UOM module
 *
 * All mutations use optimistic updates for instant UI feedback:
 * - onMutate: cancel in-flight queries → snapshot cache → apply optimistic change
 * - onError: rollback to snapshot
 * - onSettled: invalidate to reconcile with server truth
 *
 * UOM cache shape: UomItem[] (flat array, no pagination wrapper)
 */
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { uomApi, type UomItem } from './uom.api';
import { uomKeys } from './uom.keys';

// =============================================================================
// Shared Types
// =============================================================================

type CreateUomInput = { code: string; name: string; uom_group: string; base_factor?: string };

// =============================================================================
// Create — Optimistic insert with temporary negative ID
// =============================================================================

export function useCreateUom() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (body: CreateUomInput) => uomApi.create(body),
        onMutate: async (newUom: CreateUomInput) => {
            await qc.cancelQueries({ queryKey: uomKeys.all });
            const previous = qc.getQueryData<UomItem[]>(uomKeys.all);

            qc.setQueryData<UomItem[]>(uomKeys.all, (old) => {
                if (!old) return old;
                const optimistic: UomItem = {
                    id: -Date.now(),
                    code: newUom.code.toUpperCase(),
                    name: newUom.name,
                    uom_group: newUom.uom_group,
                    base_factor: newUom.base_factor ?? null,
                    company_id: null,
                    is_system: false,
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };
                return [...old, optimistic];
            });

            return { previous };
        },
        onError: (_err: unknown, _body: CreateUomInput, context: { previous?: UomItem[] } | undefined) => {
            if (context?.previous) qc.setQueryData(uomKeys.all, context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: uomKeys.all }),
    }));
}

// =============================================================================
// Update
// =============================================================================

export function useUpdateUom() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: ({ id, data }: { id: number; data: Partial<{ name: string; uom_group: string; base_factor: string; is_active: boolean }> }) =>
            uomApi.update(id, data),
        onSettled: () => qc.invalidateQueries({ queryKey: uomKeys.all }),
    }));
}

// =============================================================================
// Deactivate (soft delete) — Optimistic is_active = false
// =============================================================================

export function useDeactivateUom() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => uomApi.deactivate(id),
        onMutate: async (id: number) => {
            await qc.cancelQueries({ queryKey: uomKeys.all });
            const previous = qc.getQueryData<UomItem[]>(uomKeys.all);

            qc.setQueryData<UomItem[]>(uomKeys.all, (old) =>
                old?.map(item => item.id === id ? { ...item, is_active: false } : item)
            );

            return { previous };
        },
        onError: (_err: unknown, _id: number, context: { previous?: UomItem[] } | undefined) => {
            if (context?.previous) qc.setQueryData(uomKeys.all, context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: uomKeys.all }),
    }));
}

// =============================================================================
// Restore — Optimistic is_active = true
// =============================================================================

export function useRestoreUom() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => uomApi.restore(id),
        onMutate: async (id: number) => {
            await qc.cancelQueries({ queryKey: uomKeys.all });
            const previous = qc.getQueryData<UomItem[]>(uomKeys.all);

            qc.setQueryData<UomItem[]>(uomKeys.all, (old) =>
                old?.map(item => item.id === id ? { ...item, is_active: true } : item)
            );

            return { previous };
        },
        onError: (_err: unknown, _id: number, context: { previous?: UomItem[] } | undefined) => {
            if (context?.previous) qc.setQueryData(uomKeys.all, context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: uomKeys.all }),
    }));
}

// =============================================================================
// Hard Delete — Optimistic remove from array
// =============================================================================

export function useHardDeleteUom() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => uomApi.hardDelete(id),
        onMutate: async (id: number) => {
            await qc.cancelQueries({ queryKey: uomKeys.all });
            const previous = qc.getQueryData<UomItem[]>(uomKeys.all);

            qc.setQueryData<UomItem[]>(uomKeys.all, (old) =>
                old?.filter(item => item.id !== id)
            );

            return { previous };
        },
        onError: (_err: unknown, _id: number, context: { previous?: UomItem[] } | undefined) => {
            if (context?.previous) qc.setQueryData(uomKeys.all, context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: uomKeys.all }),
    }));
}
