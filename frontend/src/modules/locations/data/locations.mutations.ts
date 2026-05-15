import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { locationsApi, type LocationItem } from './locations.api';
import { locationKeys } from './locations.keys';

type CreateLocationInput = {
    warehouse_id?: number | null;
    parent_id?: number | null;
    name: string;
    barcode?: string | null;
    type?: 'VIEW' | 'INTERNAL';
};

export function useCreateLocation() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (body: CreateLocationInput) => locationsApi.create(body),
        onSettled: () => qc.invalidateQueries({ queryKey: locationKeys.all }),
    }));
}

export function useUpdateLocation() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: ({ id, data }: { id: number; data: Partial<{ name: string; barcode: string | null; type: 'VIEW' | 'INTERNAL'; is_active: boolean }> }) =>
            locationsApi.update(id, data),
        onSettled: () => qc.invalidateQueries({ queryKey: locationKeys.all }),
    }));
}

export function useReparentLocation() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: ({ id, parentId }: { id: number; parentId: number | null }) =>
            locationsApi.reparent(id, parentId),
        onSettled: () => qc.invalidateQueries({ queryKey: locationKeys.all }),
    }));
}

export function useDeactivateLocation() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => locationsApi.deactivate(id),
        onMutate: async (id: number) => {
            await qc.cancelQueries({ queryKey: locationKeys.all });
            const previous = qc.getQueryData<LocationItem[]>(locationKeys.all);
            qc.setQueryData<LocationItem[]>(locationKeys.all, (old) =>
                old?.map(item => item.id === id ? { ...item, is_active: false } : item)
            );
            return { previous };
        },
        onError: (_err: unknown, _id: number, context: { previous?: LocationItem[] } | undefined) => {
            if (context?.previous) qc.setQueryData(locationKeys.all, context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: locationKeys.all }),
    }));
}

export function useRestoreLocation() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => locationsApi.restore(id),
        onMutate: async (id: number) => {
            await qc.cancelQueries({ queryKey: locationKeys.all });
            const previous = qc.getQueryData<LocationItem[]>(locationKeys.all);
            qc.setQueryData<LocationItem[]>(locationKeys.all, (old) =>
                old?.map(item => item.id === id ? { ...item, is_active: true } : item)
            );
            return { previous };
        },
        onError: (_err: unknown, _id: number, context: { previous?: LocationItem[] } | undefined) => {
            if (context?.previous) qc.setQueryData(locationKeys.all, context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: locationKeys.all }),
    }));
}

export function useHardDeleteLocation() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => locationsApi.hardDelete(id),
        onMutate: async (id: number) => {
            await qc.cancelQueries({ queryKey: locationKeys.all });
            const previous = qc.getQueryData<LocationItem[]>(locationKeys.all);
            qc.setQueryData<LocationItem[]>(locationKeys.all, (old) =>
                old?.filter(item => item.id !== id)
            );
            return { previous };
        },
        onError: (_err: unknown, _id: number, context: { previous?: LocationItem[] } | undefined) => {
            if (context?.previous) qc.setQueryData(locationKeys.all, context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: locationKeys.all }),
    }));
}
