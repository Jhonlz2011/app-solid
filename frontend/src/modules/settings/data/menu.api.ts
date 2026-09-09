import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { MenuItemResponseType, MenuItemUpdateType, MenuItemReorderItemType } from '@app/schema/backend';

export const menuApi = {
    list: async (): Promise<MenuItemResponseType[]> => {
        const { data, error } = await api.modules.items.get();
        if (error) throwApiError(error);
        return (data ?? []) as MenuItemResponseType[];
    },

    update: async (id: number, body: MenuItemUpdateType): Promise<MenuItemResponseType> => {
        const { data, error } = await api.modules({ id }).put(body);
        if (error) throwApiError(error);
        return data as MenuItemResponseType;
    },

    reorder: async (items: MenuItemReorderItemType[]): Promise<{ updated: number }> => {
        const { data, error } = await api.modules.reorder.put({ items });
        if (error) throwApiError(error);
        return data as { updated: number };
    },

    resetDefaults: async (): Promise<{ success: boolean; message: string }> => {
        const { data, error } = await api.modules['reset-defaults'].post();
        if (error) throwApiError(error);
        return data as { success: boolean; message: string };
    },

    refreshCache: async (): Promise<{ success: boolean; message: string }> => {
        const { data, error } = await api.modules['refresh-cache'].post();
        if (error) throwApiError(error);
        return data as { success: boolean; message: string };
    },
};
