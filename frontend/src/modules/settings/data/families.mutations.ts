import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { familiesApi } from './families.api';
import { familyKeys } from './families.keys';

export function useCreateFamily() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (body: { name: string; categoryId?: number; description?: string }) =>
            familiesApi.create(body),
        onSettled: () => qc.invalidateQueries({ queryKey: familyKeys.all }),
    }));
}

export function useUpdateFamily() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: ({ id, data }: { id: number; data: Partial<{ name: string; categoryId: number | null; description: string | null }> }) =>
            familiesApi.update(id, data),
        onSettled: () => qc.invalidateQueries({ queryKey: familyKeys.all }),
    }));
}

export function useDeactivateFamily() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => familiesApi.deactivate(id),
        onSettled: () => qc.invalidateQueries({ queryKey: familyKeys.all }),
    }));
}

export function useRestoreFamily() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => familiesApi.restore(id),
        onSettled: () => qc.invalidateQueries({ queryKey: familyKeys.all }),
    }));
}
