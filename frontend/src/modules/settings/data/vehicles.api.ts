import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { CarrierVehicleType, CompanyVehicleItemType } from '@app/schema/dto';

export const vehiclesApi = {
    list: async (): Promise<CompanyVehicleItemType[]> => {
        const { data, error } = await api.settings.vehicles.get();
        if (error) throwApiError(error);
        return data as CompanyVehicleItemType[];
    },

    get: async (id: number): Promise<CompanyVehicleItemType> => {
        const { data, error } = await api.settings.vehicles({ id }).get();
        if (error) throwApiError(error);
        return data as CompanyVehicleItemType;
    },

    create: async (body: CarrierVehicleType): Promise<CompanyVehicleItemType> => {
        const { data, error } = await api.settings.vehicles.post(body);
        if (error) throwApiError(error);
        return data as CompanyVehicleItemType;
    },

    update: async (id: number, body: Partial<CarrierVehicleType>): Promise<CompanyVehicleItemType> => {
        const { data, error } = await api.settings.vehicles({ id }).put(body);
        if (error) throwApiError(error);
        return data as CompanyVehicleItemType;
    },

    delete: async (id: number): Promise<void> => {
        const { error } = await api.settings.vehicles({ id }).delete();
        if (error) throwApiError(error);
    },
};
