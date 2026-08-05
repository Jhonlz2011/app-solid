/**
 * employees.queries.ts — TanStack Query Hooks (read-only) for Employees module
 *
 * Only `createQuery` / `createInfiniteQuery` hooks live here.
 * All mutations are in `employees.mutations.ts`.
 */
import { createQuery, createInfiniteQuery, keepPreviousData, useQueryClient } from '@tanstack/solid-query';
import { createEffect, type Accessor } from 'solid-js';
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import { employeesApi } from './employees.api';
import { employeeKeys } from './employees.keys';
import type { EntityFilters, FacetData, EntityReferences } from '@app/schema/shared-dto';

// =============================================================================
// List with Cursor Pagination + Auto-prefetch
// =============================================================================

export function useEmployees(filters: () => EntityFilters) {
    const queryClient = useQueryClient();
    const query = createQuery(() => ({
        queryKey: employeeKeys.list(filters()),
        queryFn: () => employeesApi.list(filters()),
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 30,
        placeholderData: keepPreviousData,
    }));

    // Auto-prefetch NEXT and PREVIOUS pages
    createEffect(() => {
        const data = query.data;
        const currentFilters = filters();
        if (!data) return;

        if (data.meta.nextCursor && data.meta.hasNextPage) {
            queryClient.prefetchQuery({
                queryKey: employeeKeys.list({ ...currentFilters, cursor: data.meta.nextCursor, direction: 'next' }),
                queryFn: () => employeesApi.list({ ...currentFilters, cursor: data.meta.nextCursor!, direction: 'next' }),
                staleTime: 1000 * 60 * 2,
            });
        }

        if (data.meta.prevCursor && data.meta.hasPrevPage) {
            queryClient.prefetchQuery({
                queryKey: employeeKeys.list({ ...currentFilters, cursor: data.meta.prevCursor, direction: 'prev' }),
                queryFn: () => employeesApi.list({ ...currentFilters, cursor: data.meta.prevCursor!, direction: 'prev' }),
                staleTime: 1000 * 60 * 2,
            });
        }
    });

    return query;
}

// =============================================================================
// Infinite Scroll (mobile card view)
// =============================================================================

export function useInfiniteEmployees(filters: () => Omit<EntityFilters, 'cursor' | 'direction'>) {
    return createInfiniteQuery(() => ({
        queryKey: [...employeeKeys.lists(), 'infinite', filters()] as const,
        queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
            return employeesApi.list({
                ...filters(),
                cursor: pageParam,
                direction: pageParam ? 'next' : 'first',
                limit: 20,
            });
        },
        getNextPageParam: (lastPage: Awaited<ReturnType<typeof employeesApi.list>>) =>
            lastPage.meta.hasNextPage ? lastPage.meta.nextCursor ?? undefined : undefined,
        initialPageParam: undefined as string | undefined,
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 30,
    }));
}

// =============================================================================
// Faceted Filter Options
// =============================================================================

export function useEmployeeFacets(
    search: () => string | undefined,
    columnFilters?: () => {
        personType?: string[];
        taxIdType?: string[];
        isActive?: string[];
        businessName?: string[];
    }
) {
    return createQuery(() => ({
        queryKey: employeeKeys.facets(search(), columnFilters?.()),
        queryFn: async (): Promise<FacetData> => {
            const cf = columnFilters?.();
            const { data, error } = await api.api.employees.facets.get({
                query: {
                    search: search(),
                    personType: cf?.personType?.length ? cf.personType.join(',') : undefined,
                    taxIdType: cf?.taxIdType?.length ? cf.taxIdType.join(',') : undefined,
                    isActive: cf?.isActive?.length ? cf.isActive.join(',') : undefined,
                    businessName: cf?.businessName?.length ? cf.businessName.join(',') : undefined,
                },
            });
            if (error) throwApiError(error);
            return data as unknown as FacetData;
        },
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        retry: 2,
        placeholderData: keepPreviousData,
    }));
}

// =============================================================================
// Single Employee Detail
// =============================================================================

export function useEmployee(id: () => number) {
    return createQuery(() => ({
        queryKey: employeeKeys.detail(id()),
        queryFn: () => employeesApi.get(id()),
        enabled: !!id(),
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
    }));
}

// =============================================================================
// Reference Check (pre-flight for hard delete)
// =============================================================================

export function useCheckEmployeeReferences(id: () => number | null, enabled: () => boolean) {
    return createQuery(() => ({
        queryKey: employeeKeys.references(id()!),
        queryFn: async (): Promise<EntityReferences> => {
            return await employeesApi.canDelete(id()!);
        },
        enabled: enabled() && id() !== null,
        staleTime: 10_000,
        gcTime: 30_000,
        retry: false,
    }));
}
