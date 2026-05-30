import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { warehousesApi } from './warehouses.api';
import { warehouseKeys } from './warehouses.keys';

// =============================================================================
// Warehouse Mutations
// =============================================================================

export function useCreateWarehouse() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (body: { code: string; name: string; address?: string; is_mobile?: boolean; manager_id?: number }) =>
            warehousesApi.create(body),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: warehouseKeys.warehouses });
        },
    }));
}

export function useUpdateWarehouse() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: ({ id, data }: { id: number; data: Parameters<typeof warehousesApi.update>[1] }) =>
            warehousesApi.update(id, data),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: warehouseKeys.warehouses });
        },
    }));
}

export function useDeactivateWarehouse() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => warehousesApi.deactivate(id),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: warehouseKeys.warehouses });
        },
    }));
}

export function useRestoreWarehouse() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => warehousesApi.restore(id),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: warehouseKeys.warehouses });
        },
    }));
}
