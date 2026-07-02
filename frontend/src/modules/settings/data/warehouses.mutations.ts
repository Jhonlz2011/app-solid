import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { warehousesApi, type WarehouseItem, type CreateWarehouseBody, type UpdateWarehouseBody } from './warehouses.api';
import { warehouseKeys } from './warehouses.keys';

// =============================================================================
// Warehouse Mutations — Optimistic Updates for 0ms UX
//
// Toast notifications are NOT included here because consumers (WarehouseEditSheet,
// WarehouseNewSheet, WarehouseList) already provide their own inline toast
// callbacks with navigation logic. Adding toasts here would cause duplicates.
// =============================================================================

export function useCreateWarehouse() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationKey: ['inventory', 'warehouses', 'create'],
        mutationFn: (body: CreateWarehouseBody) => warehousesApi.create(body),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: warehouseKeys.warehouses });
        },
    }));
}

export function useUpdateWarehouse() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationKey: ['inventory', 'warehouses', 'update'],
        mutationFn: ({ id, data }: { id: number; data: UpdateWarehouseBody }) =>
            warehousesApi.update(id, data),

        // Optimistic: update the item in the list cache immediately
        onMutate: async ({ id, data }) => {
            await qc.cancelQueries({ queryKey: warehouseKeys.warehouses });
            const previous = qc.getQueryData<WarehouseItem[]>(warehouseKeys.warehouses);
            qc.setQueryData<WarehouseItem[]>(warehouseKeys.warehouses, (old) =>
                old?.map(w => w.id === id ? { ...w, ...data } as WarehouseItem : w) ?? []
            );
            return { previous };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) qc.setQueryData(warehouseKeys.warehouses, context.previous);
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: warehouseKeys.warehouses });
        },
    }));
}

export function useDeactivateWarehouse() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => warehousesApi.deactivate(id),

        // Optimistic: mark as inactive immediately in the list
        onMutate: async (id) => {
            await qc.cancelQueries({ queryKey: warehouseKeys.warehouses });
            const previous = qc.getQueryData<WarehouseItem[]>(warehouseKeys.warehouses);
            qc.setQueryData<WarehouseItem[]>(warehouseKeys.warehouses, (old) =>
                old?.map(w => w.id === id ? { ...w, is_active: false } : w) ?? []
            );
            return { previous };
        },
        onError: (_err, _id, context) => {
            if (context?.previous) qc.setQueryData(warehouseKeys.warehouses, context.previous);
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: warehouseKeys.warehouses });
        },
    }));
}

export function useRestoreWarehouse() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => warehousesApi.restore(id),

        // Optimistic: mark as active immediately in the list
        onMutate: async (id) => {
            await qc.cancelQueries({ queryKey: warehouseKeys.warehouses });
            const previous = qc.getQueryData<WarehouseItem[]>(warehouseKeys.warehouses);
            qc.setQueryData<WarehouseItem[]>(warehouseKeys.warehouses, (old) =>
                old?.map(w => w.id === id ? { ...w, is_active: true } : w) ?? []
            );
            return { previous };
        },
        onError: (_err, _id, context) => {
            if (context?.previous) qc.setQueryData(warehouseKeys.warehouses, context.previous);
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: warehouseKeys.warehouses });
        },
    }));
}
