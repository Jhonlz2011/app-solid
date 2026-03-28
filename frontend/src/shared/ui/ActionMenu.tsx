import { Component, JSX, Show } from 'solid-js';
import DropdownMenu from '@shared/ui/DropdownMenu';
import { EditIcon, TrashIcon, RotateCcwIcon, MoreVerticalIcon, EyeIcon } from '@shared/ui/icons';
import { useAuth } from '@/modules/auth/store/auth.store';

export interface ActionMenuProps {
    /** The permission module name (e.g. 'users', 'suppliers') to check capabilities against useAuth() */
    module: string;
    
    /** Whether the row item is currently active. If false, shows Restore instead of Delete */
    isActive: boolean;
    
    /** Handlers for search params injected directly into DropdownMenu.Item */
    showSearch: (prev: any) => any;
    editSearch?: (prev: any) => any;
    
    /** Handlers for direct mutation calls */
    onDelete?: () => void;
    onRestore?: () => void;
    
    /** Optional extra actions inserted before Delete */
    children?: JSX.Element;
}

const ActionMenu: Component<ActionMenuProps> = (props) => {
    const auth = useAuth();
    
    // Internal permission validators based on the provided module string
    const canEdit = () => auth.canEdit(props.module as any);
    const canDelete = () => auth.canDelete(props.module as any) && props.isActive;
    const canDestroy = () => auth.hasPermission(`${props.module}.destroy` as any);
    const canRestore = () => auth.hasPermission(`${props.module}.restore` as any) && !props.isActive;
    
    return (
        <div class="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <DropdownMenu placement="bottom-end">
                <DropdownMenu.Trigger variant="ghost" class="size-8 p-0 data-[expanded]:bg-card-alt data-[expanded]:opacity-100" title="Acciones">
                    <MoreVerticalIcon class="size-4" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Content class="min-w-[160px]">
                    <DropdownMenu.Item to="." search={props.showSearch} preload="intent">
                        <EyeIcon class="size-4 mr-2" />
                        <span>Ver detalles</span>
                    </DropdownMenu.Item>
                    
                    <Show when={props.editSearch && canEdit()}>
                        <DropdownMenu.Item to="." search={props.editSearch} preload="intent">
                            <EditIcon class="size-4 mr-2" />
                            <span>Editar</span>
                        </DropdownMenu.Item>
                    </Show>

                    <Show when={props.onRestore && canRestore()}>
                        <DropdownMenu.Item onSelect={props.onRestore}>
                            <RotateCcwIcon class="size-4 mr-2 text-emerald-500" />
                            <span class="text-emerald-500 font-medium">Restaurar</span>
                        </DropdownMenu.Item>
                    </Show>
                    
                    {props.children}

                    <Show when={props.onDelete && (canDelete() || canDestroy())}>
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item onSelect={props.onDelete} destructive>
                            <TrashIcon class="size-4 mr-2" />
                            <span>Eliminar</span>
                        </DropdownMenu.Item>
                    </Show>
                </DropdownMenu.Content>
            </DropdownMenu>
        </div>
    );
};

export default ActionMenu;
