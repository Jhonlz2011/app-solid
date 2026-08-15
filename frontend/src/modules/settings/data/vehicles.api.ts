import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { CarrierVehiclePayload, CompanyVehicleItem } from '@app/schema/dto';

export const vehiclesApi = {
    list: async (): Promise<CompanyVehicleItem[]> => {
        const { data, error } = await api.api.settings.vehicles.get();
        if (error) throwApiError(error);
        return data as CompanyVehicleItem[];
    },

    get: async (id: number): Promise<CompanyVehicleItem> => {
        const { data, error } = await api.api.settings.vehicles({ id }).get();
        if (error) throwApiError(error);
        return data as CompanyVehicleItem;
    },

    create: async (body: CarrierVehiclePayload): Promise<CompanyVehicleItem> => {
        const { data, error } = await api.api.settings.vehicles.post(body);
        if (error) throwApiError(error);
        return data as CompanyVehicleItem;
    },

    update: async (id: number, body: Partial<CarrierVehiclePayload>): Promise<CompanyVehicleItem> => {
        const { data, error } = await api.api.settings.vehicles({ id }).put(body);
        if (error) throwApiError(error);
        return data as CompanyVehicleItem;
    },

    delete: async (id: number): Promise<void> => {
        const { error } = await api.api.settings.vehicles({ id }).delete();
        if (error) throwApiError(error);
    },
};
