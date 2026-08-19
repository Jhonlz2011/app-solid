/**
 * entities.queries.ts — TanStack Query Hooks for Generic Entities
 */
import { createQuery, createInfiniteQuery, keepPreviousData, useQueryClient } from '@tanstack/solid-query';
import { createEffect } from 'solid-js';
import type { EntityApi } from './entities.api';
import type { EntityKeys } from './entities.keys';
import type { EntityFilters, FacetData, EntityReferences } from '@app/schema/dto';
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';
import type { api } from '@shared/lib/eden';

export type AnyFacetsEndpoint = typeof api.suppliers.facets;

export function createEntityQueries(api: EntityApi, keys: EntityKeys, facetsEndpoint: AnyFacetsEndpoint) {
    return {
        useList: (filters: () => EntityFilters) => {
            const queryClient = useQueryClient();
            const query = createQuery(() => ({
                queryKey: keys.list(filters()),
                queryFn: () => api.list(filters()),
                staleTime: STALE_TIME.SHORT,
                gcTime: GC_TIME.DEFAULT,
                placeholderData: keepPreviousData,
            }));

            // Auto-prefetch NEXT and PREVIOUS pages
            createEffect(() => {
                const data = query.data;
                const currentFilters = filters();
                if (!data) return;

                if (data.meta.nextCursor && data.meta.hasNextPage) {
                    queryClient.prefetchQuery({
                        queryKey: keys.list({ ...currentFilters, cursor: data.meta.nextCursor, direction: 'next' }),
                        queryFn: () => api.list({ ...currentFilters, cursor: data.meta.nextCursor!, direction: 'next' }),
                        staleTime: STALE_TIME.SHORT,
                    });
                }

                if (data.meta.prevCursor && data.meta.hasPrevPage) {
                    queryClient.prefetchQuery({
                        queryKey: keys.list({ ...currentFilters, cursor: data.meta.prevCursor, direction: 'prev' }),
                        queryFn: () => api.list({ ...currentFilters, cursor: data.meta.prevCursor!, direction: 'prev' }),
                        staleTime: STALE_TIME.SHORT,
                    });
                }
            });

            return query;
        },

        useInfinite: (filters: () => Omit<EntityFilters, 'cursor' | 'direction'>) => {
            return createInfiniteQuery(() => ({
                queryKey: [...keys.lists(), 'infinite', filters()] as const,
                queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
                    return api.list({
                        ...filters(),
                        cursor: pageParam,
                        direction: pageParam ? 'next' : 'first',
                        limit: 20,
                    });
                },
                getNextPageParam: (lastPage) =>
                    lastPage.meta.hasNextPage ? lastPage.meta.nextCursor ?? undefined : undefined,
                initialPageParam: undefined as string | undefined,
                staleTime: STALE_TIME.SHORT,
                gcTime: GC_TIME.DEFAULT,
            }));
        },

        useFacets: (
            search: () => string | undefined,
            columnFilters?: () => {
                personType?: string[];
                taxIdType?: string[];
                isActive?: string[];
                businessName?: string[];
            }
        ) => {
            return createQuery(() => ({
                queryKey: keys.facets(search(), columnFilters?.()),
                queryFn: async (): Promise<FacetData> => {
                    const cf = columnFilters?.();
                    const { data, error } = await facetsEndpoint.get({
                        query: {
                            search: search(),
                            personType: cf?.personType?.length ? cf.personType.join(',') : undefined,
                            taxIdType: cf?.taxIdType?.length ? cf.taxIdType.join(',') : undefined,
                            isActive: cf?.isActive?.length ? cf.isActive.join(',') : undefined,
                            businessName: cf?.businessName?.length ? cf.businessName.join(',') : undefined,
                        },
                    });
                    if (error) throw error; // Will be handled by Error Boundary or similar
                    return data as unknown as FacetData;
                },
                staleTime: STALE_TIME.MEDIUM,
                gcTime: GC_TIME.DEFAULT,
                retry: 2,
                placeholderData: keepPreviousData,
            }));
        },

        useDetail: (id: () => number, enabled?: () => boolean) => {
            return createQuery(() => ({
                queryKey: keys.detail(id()),
                queryFn: () => api.get(id()),
                enabled: (enabled ? enabled() : true) && !!id() && id() > 0,
                staleTime: STALE_TIME.MEDIUM,
                gcTime: GC_TIME.DEFAULT,
            }));
        },

        useCheckReferences: (id: () => number | null, enabled: () => boolean) => {
            return createQuery(() => ({
                queryKey: [...keys.all, 'can-delete', id()],
                queryFn: async (): Promise<EntityReferences> => {
                    return await api.canDelete(id()!);
                },
                enabled: enabled() && id() !== null,
                staleTime: 10_000,
                gcTime: GC_TIME.PREFLIGHT,
                retry: false,
            }));
        },
    };
}

export type EntityQueries = ReturnType<typeof createEntityQueries>;
