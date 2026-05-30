/**
 * locations.mutations.ts — TanStack Mutation Hooks for Locations module
 *
 * All `createMutation` hooks with optimistic updates.
 * Uses locationKeys.list() for granular cache targeting.
 */
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { locationsApi, type LocationItem } from './locations.api';
import { locationKeys } from './locations.keys';

// =============================================================================
// Create
// =============================================================================

export function useCreateLocation() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (body: { warehouse_id?: number | null; parent_id?: number | null; name: string; type?: 'VIEW' | 'INTERNAL'; }) =>
            locationsApi.create(body),
        onSettled: () => qc.invalidateQueries({ queryKey: locationKeys.list() }),
    }));
}

// =============================================================================
// Update
// =============================================================================

export function useUpdateLocation() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: ({ id, data }: { id: number; data: Partial<{ name: string; type: 'VIEW' | 'INTERNAL'; warehouse_id: number | null; parent_id: number | null; is_active: boolean }> }) =>
            locationsApi.update(id, data),
        onSettled: () => qc.invalidateQueries({ queryKey: locationKeys.list() }),
    }));
}

// =============================================================================
// Reparent (Drag & Drop)
// =============================================================================

export function useReparentLocation() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: ({ id, parentId }: { id: number; parentId: number | null }) =>
            locationsApi.reparent(id, parentId),
        onSettled: () => qc.invalidateQueries({ queryKey: locationKeys.list() }),
    }));
}

// =============================================================================
// Deactivate (soft delete) — single
// =============================================================================

export function useDeactivateLocation() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => locationsApi.deactivate(id),
        onMutate: async (id: number) => {
            await qc.cancelQueries({ queryKey: locationKeys.list() });
            const previous = qc.getQueryData<LocationItem[]>(locationKeys.list());
            qc.setQueryData<LocationItem[]>(locationKeys.list(), (old) =>
                old?.map(item => item.id === id ? { ...item, is_active: false } : item)
            );
            return { previous };
        },
        onError: (_err: unknown, _id: number, context: { previous?: LocationItem[] } | undefined) => {
            if (context?.previous) qc.setQueryData(locationKeys.list(), context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: locationKeys.list() }),
    }));
}

// =============================================================================
// Restore — single
// =============================================================================

export function useRestoreLocation() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => locationsApi.restore(id),
        onMutate: async (id: number) => {
            await qc.cancelQueries({ queryKey: locationKeys.list() });
            const previous = qc.getQueryData<LocationItem[]>(locationKeys.list());
            qc.setQueryData<LocationItem[]>(locationKeys.list(), (old) =>
                old?.map(item => item.id === id ? { ...item, is_active: true } : item)
            );
            return { previous };
        },
        onError: (_err: unknown, _id: number, context: { previous?: LocationItem[] } | undefined) => {
            if (context?.previous) qc.setQueryData(locationKeys.list(), context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: locationKeys.list() }),
    }));
}

// =============================================================================
// Hard Delete — permanent
// =============================================================================

export function useHardDeleteLocation() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => locationsApi.hardDelete(id),
        onMutate: async (id: number) => {
            await qc.cancelQueries({ queryKey: locationKeys.list() });
            const previous = qc.getQueryData<LocationItem[]>(locationKeys.list());
            qc.setQueryData<LocationItem[]>(locationKeys.list(), (old) =>
                old?.filter(item => item.id !== id)
            );
            return { previous };
        },
        onError: (_err: unknown, _id: number, context: { previous?: LocationItem[] } | undefined) => {
            if (context?.previous) qc.setQueryData(locationKeys.list(), context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: locationKeys.list() }),
    }));
}

// =============================================================================
// Bulk Deactivate
// =============================================================================

export function useBulkDeactivateLocations() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (ids: number[]) => locationsApi.bulkDeactivate(ids),
        onMutate: async (ids: number[]) => {
            await qc.cancelQueries({ queryKey: locationKeys.list() });
            const previous = qc.getQueryData<LocationItem[]>(locationKeys.list());
            qc.setQueryData<LocationItem[]>(locationKeys.list(), (old) =>
                old?.map(item => ids.includes(item.id) ? { ...item, is_active: false } : item)
            );
            return { previous };
        },
        onError: (_err: unknown, _ids: number[], context: { previous?: LocationItem[] } | undefined) => {
            if (context?.previous) qc.setQueryData(locationKeys.list(), context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: locationKeys.list() }),
    }));
}

// =============================================================================
// Bulk Restore
// =============================================================================

export function useBulkRestoreLocations() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (ids: number[]) => locationsApi.bulkRestore(ids),
        onMutate: async (ids: number[]) => {
            await qc.cancelQueries({ queryKey: locationKeys.list() });
            const previous = qc.getQueryData<LocationItem[]>(locationKeys.list());
            qc.setQueryData<LocationItem[]>(locationKeys.list(), (old) =>
                old?.map(item => ids.includes(item.id) ? { ...item, is_active: true } : item)
            );
            return { previous };
        },
        onError: (_err: unknown, _ids: number[], context: { previous?: LocationItem[] } | undefined) => {
            if (context?.previous) qc.setQueryData(locationKeys.list(), context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: locationKeys.list() }),
    }));
}
