import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { warehousesApi, locationsApi } from './warehouses.api';
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

// =============================================================================
// Location Mutations
// =============================================================================

export function useCreateLocation() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (body: { warehouse_id: number; name: string; parent_id?: number | null; barcode?: string | null; type?: 'VIEW' | 'INTERNAL' }) =>
            locationsApi.create(body),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: warehouseKeys.locations });
        },
    }));
}

export function useUpdateLocation() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: ({ id, data }: { id: number; data: Parameters<typeof locationsApi.update>[1] }) =>
            locationsApi.update(id, data),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: warehouseKeys.locations });
        },
    }));
}

export function useDeactivateLocation() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => locationsApi.deactivate(id),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: warehouseKeys.locations });
        },
    }));
}

export function useRestoreLocation() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => locationsApi.restore(id),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: warehouseKeys.locations });
        },
    }));
}
