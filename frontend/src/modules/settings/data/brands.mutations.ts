import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { brandsApi } from './brands.api';
import { brandKeys } from './brands.keys';

export function useCreateBrand() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (body: { name: string; website?: string }) => brandsApi.create(body),
        onSettled: () => qc.invalidateQueries({ queryKey: brandKeys.all }),
    }));
}

export function useUpdateBrand() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: ({ id, data }: { id: number; data: Partial<{ name: string; website: string }> }) =>
            brandsApi.update(id, data),
        onSettled: () => qc.invalidateQueries({ queryKey: brandKeys.all }),
    }));
}

export function useDeactivateBrand() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => brandsApi.deactivate(id),
        onSettled: () => qc.invalidateQueries({ queryKey: brandKeys.all }),
    }));
}

export function useRestoreBrand() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => brandsApi.restore(id),
        onSettled: () => qc.invalidateQueries({ queryKey: brandKeys.all }),
    }));
}
