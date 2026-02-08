import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { api } from '@shared/lib/eden';
import type { SupplierFormData } from '@app/schema/frontend';

// Type utilities - Extract types from Eden
type SuppliersListResponse = Awaited<ReturnType<typeof api.api.suppliers.get>>['data'];
// Extract individual item type from list response
export type SupplierListItem = NonNullable<SuppliersListResponse>['data'][number];

// Use the shared schema type for API payloads
export type SupplierBody = SupplierFormData;

export interface SupplierFilters {
    search?: string;
    limit?: number;
    offset?: number;
}

export const supplierKeys = {
    all: ['suppliers'] as const,
    lists: () => [...supplierKeys.all, 'list'] as const,
    list: (filters: SupplierFilters) => [...supplierKeys.lists(), filters] as const,
    details: () => [...supplierKeys.all, 'detail'] as const,
    detail: (id: number) => [...supplierKeys.details(), id] as const,
};

export function useSuppliers(filters: () => SupplierFilters) {
    return createQuery(() => ({
        queryKey: supplierKeys.list(filters()),
        queryFn: async () => {
            const { data, error } = await api.api.suppliers.get({
                query: {
                    limit: filters().limit,
                    offset: filters().offset,
                    search: filters().search,
                }
            });
            if (error) throw new Error(String(error.value));
            return data!;
        },
        staleTime: 1000 * 60 * 2,
    }));
}

export function useSupplier(id: () => number) {
    return createQuery(() => ({
        queryKey: supplierKeys.detail(id()),
        queryFn: async () => {
            const { data, error } = await api.api.suppliers({ id: id() }).get();
            if (error) throw new Error(String(error.value));
            return data!;
        },
        enabled: !!id(),
        staleTime: 1000 * 60 * 5,
    }));
}

export function useCreateSupplier() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: async (body: SupplierBody) => {
            const { data, error } = await api.api.suppliers.post(body);
            if (error) throw new Error(String(error.value));
            return data!;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
        },
    }));
}

export function useUpdateSupplier() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async ({ id, data: body }: { id: number; data: Partial<SupplierBody> }) => {
            const { data, error } = await api.api.suppliers({ id }).put(body);
            if (error) throw new Error(String(error.value));
            return data!;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
            if (data?.id) queryClient.invalidateQueries({ queryKey: supplierKeys.detail(data.id) });
        },
    }));
}

export function useDeleteSupplier() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (id: number) => {
            const { error } = await api.api.suppliers({ id }).delete();
            if (error) throw new Error(String(error.value));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
        },
    }));
}

export function useBulkDeleteSupplier() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: async (ids: number[]) => {
            await Promise.all(ids.map(async id => {
                const { error } = await api.api.suppliers({ id }).delete();
                if (error) throw new Error(String(error.value));
            }));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
        },
    }));
}

export const suppliersApi = {
    list: async (filters: SupplierFilters) => {
        const { data, error } = await api.api.suppliers.get({
            query: {
                limit: filters.limit,
                offset: filters.offset,
                search: filters.search,
            }
        });
        if (error) throw new Error(String(error.value));
        return data!;
    },
    get: async (id: number) => {
        const { data, error } = await api.api.suppliers({ id }).get();
        if (error) throw new Error(String(error.value));
        return data!;
    },
};
