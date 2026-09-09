import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { toast } from 'solid-sonner';
import { menuApi } from './menu.api';
import { menuKeys } from './menu.keys';
import { actions } from '@shared/store/modules.store';
import type { MenuItemUpdateType, MenuItemReorderItemType } from '@app/schema/backend';

export function useUpdateMenuItem() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: ({ id, data }: { id: number; data: MenuItemUpdateType }) =>
            menuApi.update(id, data),
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: menuKeys.all });
            await actions.refreshModules();
            toast.success('Módulo actualizado correctamente');
        },
        onError: (err: any) => {
            toast.error(err?.message || 'Error al actualizar módulo');
        },
    }));
}

export function useReorderMenuItems() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: (items: MenuItemReorderItemType[]) => menuApi.reorder(items),
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: menuKeys.all });
            await actions.refreshModules();
            toast.success('Orden de módulos guardado');
        },
        onError: (err: any) => {
            toast.error(err?.message || 'Error al reordenar módulos');
        },
    }));
}

export function useResetMenuDefaults() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: () => menuApi.resetDefaults(),
        onSuccess: async (res) => {
            queryClient.invalidateQueries({ queryKey: menuKeys.all });
            await actions.refreshModules();
            toast.success(res?.message || 'Menú restaurado a los valores por defecto');
        },
        onError: (err: any) => {
            toast.error(err?.message || 'Error al restaurar menú');
        },
    }));
}
