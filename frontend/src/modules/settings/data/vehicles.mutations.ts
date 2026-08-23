import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { toast } from 'solid-sonner';
import { vehiclesApi } from './vehicles.api';
import { vehicleKeys } from './vehicles.keys';
import type { CarrierVehicleType } from '@app/schema/dto';

export function useCreateVehicle() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: (data: CarrierVehicleType) => vehiclesApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
            toast.success('Vehículo registrado correctamente');
        },
        onError: (err: any) => {
            toast.error(err?.message || 'Error al registrar vehículo');
        },
    }));
}

export function useUpdateVehicle() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: ({ id, data }: { id: number; data: Partial<CarrierVehicleType> }) =>
            vehiclesApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
            toast.success('Vehículo actualizado correctamente');
        },
        onError: (err: any) => {
            toast.error(err?.message || 'Error al actualizar vehículo');
        },
    }));
}

export function useDeleteVehicle() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => vehiclesApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
            toast.success('Vehículo eliminado de la flota');
        },
        onError: (err: any) => {
            toast.error(err?.message || 'Error al eliminar vehículo');
        },
    }));
}
