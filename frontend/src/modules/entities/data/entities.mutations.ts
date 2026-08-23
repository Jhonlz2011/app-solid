/**
 * entities.mutations.ts — TanStack Mutation Hooks for Generic Entities
 */
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { throwApiError } from '@shared/utils/api-errors';
import type { EntityFormData } from '@app/schema/frontend';
import { addOptimisticItem, removeCacheItems, updateCacheItem, type CacheShape } from '@shared/utils/query.utils';
import type { AnyEntityEndpoint, EntityApi, EntityListItem } from './entities.api';
import type { EntityKeys } from './entities.keys';

export function createEntityMutations(api: EntityApi, keys: EntityKeys, endpoint: AnyEntityEndpoint) {
    function onSettled(queryClient: ReturnType<typeof useQueryClient>) {
        return () => {
            queryClient.invalidateQueries({ queryKey: keys.lists() });
            queryClient.invalidateQueries({ queryKey: [...keys.all, 'facets'], exact: false });
        };
    }

    function applyIsActiveToCache(
        queryClient: ReturnType<typeof useQueryClient>,
        ids: string[],
        isActive: boolean
    ) {
        queryClient.setQueriesData<CacheShape<EntityListItem>>({ queryKey: keys.lists() }, (old) => {
            if (!old) return old;
            return ids.reduce<CacheShape<EntityListItem> | undefined>(
                (acc, id) => updateCacheItem(acc, { id, is_active: isActive } as unknown as EntityListItem) ?? acc,
                old
            );
        });
    }

    return {
        useCreate: () => {
            const queryClient = useQueryClient();
            return createMutation(() => ({
                mutationKey: [...keys.all, 'create'],
                mutationFn: async (body: EntityFormData) => {
                    const { data, error } = await endpoint.post(body);
                    if (error) throwApiError(error);
                    return data!;
                },
                onMutate: async (newEntity) => {
                    await queryClient.cancelQueries({ queryKey: keys.lists() });
                    const previousLists = queryClient.getQueriesData({ queryKey: keys.lists() });

                    queryClient.setQueriesData<CacheShape<EntityListItem>>({ queryKey: keys.lists() }, (old) => {
                        if (!old) return old;
                        const optimisticEntity = {
                            id: `temp-${Date.now()}`,
                            business_name: newEntity.businessName,
                            trade_name: newEntity.tradeName,
                            tax_id: newEntity.taxId,
                            is_active: true,
                            _optimistic: true,
                        } as unknown as EntityListItem;

                        return addOptimisticItem(old, optimisticEntity);
                    });

                    return { previousLists };
                },
                onError: (_err: unknown, _newEntity: EntityFormData, context: any) => {
                    context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => {
                        queryClient.setQueryData(key as any, data);
                    });
                },
                onSettled: onSettled(queryClient),
            }));
        },

        useUpdate: () => {
            const queryClient = useQueryClient();
            return createMutation(() => ({
                mutationKey: [...keys.all, 'update'],
                mutationFn: async ({ id, data: body }: { id: string; data: Partial<EntityFormData> }) => {
                    const { data, error } = await endpoint({ id }).put(body);
                    if (error) throwApiError(error);
                    return data!;
                },
                onMutate: async ({ id, data: updates }) => {
                    await queryClient.cancelQueries({ queryKey: keys.detail(id) });
                    const previousEntity = queryClient.getQueryData(keys.detail(id));

                    if (previousEntity) {
                        queryClient.setQueryData(keys.detail(id), (old: unknown) => {
                            if (!old || typeof old !== 'object') return old;
                            return { ...old as object, ...updates };
                        });
                    }

                    return { previousEntity };
                },
                onError: (_err, { id }, context) => {
                    if (context?.previousEntity) {
                        queryClient.setQueryData(keys.detail(id), context.previousEntity);
                    }
                },
                onSettled: (_data, _err, { id }) => {
                    queryClient.invalidateQueries({ queryKey: keys.lists() });
                    queryClient.invalidateQueries({ queryKey: keys.detail(id) });
                    queryClient.invalidateQueries({ queryKey: [...keys.all, 'facets'], exact: false });
                },
            }));
        },

        useDelete: () => {
            const queryClient = useQueryClient();
            return createMutation(() => ({
                mutationFn: async (id: string) => {
                    await api.deactivate(id);
                    return id;
                },
                onMutate: async (id: string) => {
                    await queryClient.cancelQueries({ queryKey: keys.lists() });
                    const previousLists = queryClient.getQueriesData({ queryKey: keys.lists() });
                    applyIsActiveToCache(queryClient, [id], false);
                    return { previousLists };
                },
                onError: (_err: unknown, _id: string, context: any) => {
                    context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
                },
                onSettled: onSettled(queryClient),
            }));
        },

        useBulkDelete: () => {
            const queryClient = useQueryClient();
            return createMutation(() => ({
                mutationFn: async (ids: string[]) => {
                    return await api.bulkDelete(ids);
                },
                onMutate: async (ids: string[]) => {
                    await queryClient.cancelQueries({ queryKey: keys.lists() });
                    const previousLists = queryClient.getQueriesData({ queryKey: keys.lists() });
                    applyIsActiveToCache(queryClient, ids, false);
                    return { previousLists };
                },
                onError: (_err: unknown, _ids: string[], context: any) => {
                    context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
                },
                onSettled: onSettled(queryClient),
            }));
        },

        useBulkRestore: () => {
            const queryClient = useQueryClient();
            return createMutation(() => ({
                mutationFn: async (ids: string[]) => {
                    return await api.bulkRestore(ids);
                },
                onMutate: async (ids: string[]) => {
                    await queryClient.cancelQueries({ queryKey: keys.lists() });
                    const previousLists = queryClient.getQueriesData({ queryKey: keys.lists() });
                    applyIsActiveToCache(queryClient, ids, true);
                    return { previousLists };
                },
                onError: (_err: unknown, _ids: string[], context: any) => {
                    context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
                },
                onSettled: onSettled(queryClient),
            }));
        },

        useRestore: () => {
            const queryClient = useQueryClient();
            return createMutation(() => ({
                mutationFn: async (id: string) => {
                    await api.restore(id);
                    return id;
                },
                onMutate: async (id: string) => {
                    await queryClient.cancelQueries({ queryKey: keys.lists() });
                    const previousLists = queryClient.getQueriesData({ queryKey: keys.lists() });
                    applyIsActiveToCache(queryClient, [id], true);
                    return { previousLists };
                },
                onError: (_err: unknown, _id: string, context: any) => {
                    context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
                },
                onSettled: onSettled(queryClient),
            }));
        },

        useHardDelete: () => {
            const queryClient = useQueryClient();
            return createMutation(() => ({
                mutationFn: async (id: string) => {
                    await api.hardDelete(id);
                    return id;
                },
                onMutate: async (id: string) => {
                    await queryClient.cancelQueries({ queryKey: keys.lists() });
                    const previousLists = queryClient.getQueriesData({ queryKey: keys.lists() });

                    queryClient.setQueriesData<CacheShape<EntityListItem>>({ queryKey: keys.lists() }, (old) => {
                        if (!old) return old;
                        return removeCacheItems(old, [id]);
                    });

                    return { previousLists };
                },
                onError: (_err: unknown, _id: string, context: any) => {
                    context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => {
                        queryClient.setQueryData(key as any, data);
                    });
                },
                onSettled: onSettled(queryClient),
            }));
        },
    };
}

export type EntityMutations = ReturnType<typeof createEntityMutations>;
