/**
 * employees.mutations.ts — TanStack Mutation Hooks for Employees module
 *
 * All `createMutation` hooks with optimistic updates live here.
 */
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { EntityFormData } from '@app/schema/frontend';
import { addOptimisticItem, removeCacheItems, updateCacheItem, type CacheShape } from '@shared/utils/query.utils';
import { employeesApi, type EmployeeListItem } from './employees.api';
import { employeeKeys } from './employees.keys';

// =============================================================================
// Shared Mutation Helpers (DRY within module)
// =============================================================================

/** Shared onSettled for all employee mutations — invalidates list + facet caches */
function employeeOnSettled(queryClient: ReturnType<typeof useQueryClient>) {
    return () => {
        queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
        queryClient.invalidateQueries({ queryKey: [...employeeKeys.all, 'facets'], exact: false });
    };
}

/** Applies `is_active` patch for multiple IDs via sequential updateCacheItem calls. */
function applyIsActiveToCache(
    queryClient: ReturnType<typeof useQueryClient>,
    ids: number[],
    isActive: boolean
) {
    queryClient.setQueriesData<CacheShape<EmployeeListItem>>({ queryKey: employeeKeys.lists() }, (old) => {
        if (!old) return old;
        return ids.reduce<CacheShape<EmployeeListItem>>(
            (acc, id) => updateCacheItem(acc, { id, is_active: isActive } as unknown as EmployeeListItem) ?? acc,
            old
        );
    });
}

// =============================================================================
// Create
// =============================================================================

export function useCreateEmployee() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationKey: ['employees', 'create'],
        mutationFn: async (body: EntityFormData) => {
            const { data, error } = await api.api.employees.post(body);
            if (error) throwApiError(error);
            return data!;
        },
        onMutate: async (newEmployee) => {
            await queryClient.cancelQueries({ queryKey: employeeKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: employeeKeys.lists() });

            queryClient.setQueriesData<CacheShape<EmployeeListItem>>({ queryKey: employeeKeys.lists() }, (old) => {
                if (!old) return old;
                const optimisticEmployee = {
                    id: -Date.now(),
                    business_name: newEmployee.businessName,
                    trade_name: newEmployee.tradeName,
                    tax_id: newEmployee.taxId,
                    is_active: true,
                    _optimistic: true,
                } as unknown as EmployeeListItem;

                return addOptimisticItem(old, optimisticEmployee);
            });

            return { previousLists };
        },
        onError: (_err: unknown, _newEmployee: EntityFormData, context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => {
                queryClient.setQueryData(key as any, data);
            });
        },
        onSettled: employeeOnSettled(queryClient),
    }));
}

// =============================================================================
// Update
// =============================================================================

export function useUpdateEmployee() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationKey: ['employees', 'update'],
        mutationFn: async ({ id, data: body }: { id: number; data: Partial<EntityFormData> }) => {
            const { data, error } = await api.api.employees({ id }).put(body);
            if (error) throwApiError(error);
            return data!;
        },
        onMutate: async ({ id, data: updates }) => {
            await queryClient.cancelQueries({ queryKey: employeeKeys.detail(id) });
            const previousEmployee = queryClient.getQueryData(employeeKeys.detail(id));

            if (previousEmployee) {
                queryClient.setQueryData(employeeKeys.detail(id), (old: unknown) => {
                    if (!old || typeof old !== 'object') return old;
                    return { ...old as object, ...updates };
                });
            }

            return { previousEmployee };
        },
        onError: (_err, { id }, context) => {
            if (context?.previousEmployee) {
                queryClient.setQueryData(employeeKeys.detail(id), context.previousEmployee);
            }
        },
        onSettled: (_data, _err, { id }) => {
            queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
            queryClient.invalidateQueries({ queryKey: employeeKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: [...employeeKeys.all, 'facets'], exact: false });
        },
    }));
}

// =============================================================================
// Deactivate (soft delete)
// =============================================================================

export function useDeleteEmployee() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (id: number) => {
            await employeesApi.deactivate(id);
            return id;
        },
        onMutate: async (id: number) => {
            await queryClient.cancelQueries({ queryKey: employeeKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: employeeKeys.lists() });
            applyIsActiveToCache(queryClient, [id], false);
            return { previousLists };
        },
        onError: (_err: unknown, _id: number, context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
        },
        onSettled: employeeOnSettled(queryClient),
    }));
}

// =============================================================================
// Bulk Deactivate
// =============================================================================

export function useBulkDeleteEmployee() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (ids: number[]) => {
            return await employeesApi.bulkDelete(ids);
        },
        onMutate: async (ids: number[]) => {
            await queryClient.cancelQueries({ queryKey: employeeKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: employeeKeys.lists() });
            applyIsActiveToCache(queryClient, ids, false);
            return { previousLists };
        },
        onError: (_err: unknown, _ids: number[], context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
        },
        onSettled: employeeOnSettled(queryClient),
    }));
}

// =============================================================================
// Bulk Restore
// =============================================================================

export function useBulkRestoreEmployee() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (ids: number[]) => {
            return await employeesApi.bulkRestore(ids);
        },
        onMutate: async (ids: number[]) => {
            await queryClient.cancelQueries({ queryKey: employeeKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: employeeKeys.lists() });
            applyIsActiveToCache(queryClient, ids, true);
            return { previousLists };
        },
        onError: (_err: unknown, _ids: number[], context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
        },
        onSettled: employeeOnSettled(queryClient),
    }));
}

// =============================================================================
// Restore (single)
// =============================================================================

export function useRestoreEmployee() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (id: number) => {
            await employeesApi.restore(id);
            return id;
        },
        onMutate: async (id: number) => {
            await queryClient.cancelQueries({ queryKey: employeeKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: employeeKeys.lists() });
            applyIsActiveToCache(queryClient, [id], true);
            return { previousLists };
        },
        onError: (_err: unknown, _id: number, context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => queryClient.setQueryData(key as any, data));
        },
        onSettled: employeeOnSettled(queryClient),
    }));
}

// =============================================================================
// Hard Delete (permanent)
// =============================================================================

export function useHardDeleteEmployee() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (id: number) => {
            await employeesApi.hardDelete(id);
            return id;
        },
        onMutate: async (id: number) => {
            await queryClient.cancelQueries({ queryKey: employeeKeys.lists() });
            const previousLists = queryClient.getQueriesData({ queryKey: employeeKeys.lists() });

            queryClient.setQueriesData<CacheShape<EmployeeListItem>>({ queryKey: employeeKeys.lists() }, (old) => {
                if (!old) return old;
                return removeCacheItems(old, [id]);
            });

            return { previousLists };
        },
        onError: (_err: unknown, _id: number, context: any) => {
            context?.previousLists?.forEach(([key, data]: [unknown, unknown]) => {
                queryClient.setQueryData(key as any, data);
            });
        },
        onSettled: employeeOnSettled(queryClient),
    }));
}
