import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { brandsApi, type BrandItem } from './brands.api';
import { brandKeys } from './brands.keys';
import { updateCacheItem, type CacheShape } from '@shared/utils/query.utils';

/** Shared onSettled for all brand mutations */
function brandOnSettled(qc: ReturnType<typeof useQueryClient>) {
    return () => {
        qc.invalidateQueries({ queryKey: brandKeys.lists() });
        qc.invalidateQueries({ queryKey: [...brandKeys.all, 'all'] });
    };
}

function applyIsActiveToCache(qc: ReturnType<typeof useQueryClient>, ids: number[], isActive: boolean) {
    qc.setQueriesData<CacheShape<BrandItem>>({ queryKey: brandKeys.lists() }, (old) => {
        if (!old) return old;
        return ids.reduce<CacheShape<BrandItem>>(
            (acc, id) => updateCacheItem(acc, { id, is_active: isActive } as unknown as BrandItem) ?? acc,
            old
        );
    });
}

export function useCreateBrand() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (body: { name: string; website?: string }) => brandsApi.create(body),
        onSettled: brandOnSettled(qc),
    }));
}

export function useUpdateBrand() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: ({ id, data }: { id: number; data: Partial<{ name: string; website: string }> }) =>
            brandsApi.update(id, data),
        onSettled: brandOnSettled(qc),
    }));
}

export function useDeactivateBrand() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => brandsApi.deactivate(id),
        onMutate: async (id: number) => {
            await qc.cancelQueries({ queryKey: brandKeys.lists() });
            const prev = qc.getQueriesData({ queryKey: brandKeys.lists() });
            applyIsActiveToCache(qc, [id], false);
            return { prev };
        },
        onError: (_: unknown, __: number, ctx: any) => {
            ctx?.prev?.forEach(([key, data]: [unknown, unknown]) => qc.setQueryData(key as any, data));
        },
        onSettled: brandOnSettled(qc),
    }));
}

export function useRestoreBrand() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => brandsApi.restore(id),
        onMutate: async (id: number) => {
            await qc.cancelQueries({ queryKey: brandKeys.lists() });
            const prev = qc.getQueriesData({ queryKey: brandKeys.lists() });
            applyIsActiveToCache(qc, [id], true);
            return { prev };
        },
        onError: (_: unknown, __: number, ctx: any) => {
            ctx?.prev?.forEach(([key, data]: [unknown, unknown]) => qc.setQueryData(key as any, data));
        },
        onSettled: brandOnSettled(qc),
    }));
}

export function useBulkDeactivateBrand() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (ids: number[]) => brandsApi.bulkDeactivate(ids),
        onMutate: async (ids: number[]) => {
            await qc.cancelQueries({ queryKey: brandKeys.lists() });
            const prev = qc.getQueriesData({ queryKey: brandKeys.lists() });
            applyIsActiveToCache(qc, ids, false);
            return { prev };
        },
        onError: (_: unknown, __: number[], ctx: any) => {
            ctx?.prev?.forEach(([key, data]: [unknown, unknown]) => qc.setQueryData(key as any, data));
        },
        onSettled: brandOnSettled(qc),
    }));
}

export function useBulkRestoreBrand() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (ids: number[]) => brandsApi.bulkRestore(ids),
        onMutate: async (ids: number[]) => {
            await qc.cancelQueries({ queryKey: brandKeys.lists() });
            const prev = qc.getQueriesData({ queryKey: brandKeys.lists() });
            applyIsActiveToCache(qc, ids, true);
            return { prev };
        },
        onError: (_: unknown, __: number[], ctx: any) => {
            ctx?.prev?.forEach(([key, data]: [unknown, unknown]) => qc.setQueryData(key as any, data));
        },
        onSettled: brandOnSettled(qc),
    }));
}
