import { Component, JSX, Show } from 'solid-js';
import type { LinkProps } from '@tanstack/solid-router';
import DropdownMenu, { type DropdownMenuProps } from '@display/DropdownMenu';
import { EditIcon } from '@icons/EditIcon';
import { TrashIcon } from '@icons/TrashIcon';
import { RotateCcwIcon } from '@icons/RotateCcwIcon';
import { MoreVerticalIcon } from '@icons/MoreVerticalIcon';
import { EyeIcon } from '@icons/EyeIcon';
import { useAuth } from '@/modules/auth/store/auth.store';
import { cn } from '@shared/lib/utils';
import type { RbacModule } from '@app/schema/enums';
import { ActionButtons } from './ActionButtons';

export type ActionMenuPlacement = DropdownMenuProps['placement'];

export interface ActionMenuProps {
    /** The permission module name (e.g. 'users', 'suppliers', 'tool_loans') to check capabilities against useAuth() */
    module?: RbacModule;
    
    /** Whether the row item is currently active. If false, shows Restore instead of Delete. Defaults to true */
    isActive?: boolean;

    /** Whether the action menu trigger is disabled */
    disabled?: boolean;

    /** Direct permission overrides if module is omitted or custom logic is needed */
    canView?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canDestroy?: boolean;
    canRestore?: boolean;
    
    /** Handlers for search params injected directly into DropdownMenu.Item */
    showSearch?: LinkProps['search'];
    editSearch?: LinkProps['search'];
    
    /** Handlers for Deep Nested Routing */
    showTo?: string;
    editTo?: string;
    
    /** Handlers for direct mutation/callback calls (slideover, modal, handlers) */
    onView?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onRestore?: () => void;
    
    /** Custom labels for default actions */
    showLabel?: string;
    editLabel?: string;
    deleteLabel?: string;
    restoreLabel?: string;

    /** Trigger & container styling */
    triggerTitle?: string;
    placement?: ActionMenuPlacement;
    class?: string;
    triggerClass?: string;
    contentClass?: string;

    /** Optional extra actions inserted between Edit and Delete */
    children?: JSX.Element;
}

/**
 * ActionMenu — Pure lazy dropdown menu for data table row actions (3+ actions).
 *
 * Performance Characteristics:
 * - Mounts ONLY the 32px trigger button during table rendering and virtual scroll.
 * - The dropdown overlay content is 100% lazy: 0 DOM nodes created until clicked.
 * - Stops event propagation to prevent parent row navigation.
 * - Responsive: visible on touch/mobile, reveals on row hover/focus in desktop.
 */
const ActionMenuComponent: Component<ActionMenuProps> = (props) => {
    const auth = useAuth();

    // Internal permission validators with safe fallbacks
    const canView = () => {
        if (props.canView !== undefined) return props.canView;
        if (props.module) return auth.canRead(props.module);
        return true;
    };

    const canEdit = () => {
        if (props.canEdit !== undefined) return props.canEdit;
        if (props.module) return auth.canEdit(props.module);
        return true;
    };

    const canDelete = () => {
        const active = props.isActive ?? true;
        if (!active) return false;
        if (props.canDelete !== undefined) return props.canDelete;
        if (props.module) return auth.canDelete(props.module);
        return true;
    };

    const canDestroy = () => {
        if (props.canDestroy !== undefined) return props.canDestroy;
        if (props.module) return auth.hasPermission(`${props.module}.destroy`);
        return false;
    };

    const canRestore = () => {
        const active = props.isActive ?? true;
        if (active) return false;
        if (props.canRestore !== undefined) return props.canRestore;
        if (props.module) return auth.hasPermission(`${props.module}.restore`);
        return true;
    };

    const hasViewAction = () => Boolean(props.showTo || props.showSearch || props.onView);
    const hasEditAction = () => Boolean(props.editTo || props.editSearch || props.onEdit);
    const hasRestoreAction = () => Boolean(props.onRestore);
    const hasDeleteAction = () => Boolean(props.onDelete);

    const hasPreviousItems = () => Boolean(
        (hasViewAction() && canView()) ||
        (hasEditAction() && canEdit()) ||
        (hasRestoreAction() && canRestore()) ||
        props.children
    );

    return (
        <div
            class={cn('flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity duration-150', props.class)}
            onClick={(e) => e.stopPropagation()}
        >
            <DropdownMenu placement={props.placement ?? 'bottom-end'}>
                <DropdownMenu.Trigger
                    variant="ghost"
                    class={cn('size-8 p-0 data-expanded:bg-card-alt data-expanded:opacity-100', props.triggerClass)}
                    title={props.triggerTitle ?? 'Acciones'}
                    disabled={props.disabled}
                >
                    <MoreVerticalIcon class="size-4" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Content class={cn('min-w-40', props.contentClass)}>
                    {/* Ver Detalles */}
                    <Show when={hasViewAction() && canView()}>
                        <DropdownMenu.Item
                            to={props.showTo}
                            search={props.showSearch}
                            onSelect={props.onView}
                            preload={props.showTo ? 'intent' : undefined}
                        >
                            <EyeIcon class="size-4 mr-2 text-muted" />
                            <span>{props.showLabel ?? 'Ver detalles'}</span>
                        </DropdownMenu.Item>
                    </Show>

                    {/* Editar */}
                    <Show when={hasEditAction() && canEdit()}>
                        <DropdownMenu.Item
                            to={props.editTo}
                            search={props.editSearch}
                            onSelect={props.onEdit}
                            preload={props.editTo ? 'intent' : undefined}
                        >
                            <EditIcon class="size-4 mr-2 text-muted" />
                            <span>{props.editLabel ?? 'Editar'}</span>
                        </DropdownMenu.Item>
                    </Show>

                    {/* Restaurar */}
                    <Show when={hasRestoreAction() && canRestore()}>
                        <DropdownMenu.Item onSelect={props.onRestore}>
                            <RotateCcwIcon class="size-4 mr-2 text-emerald-500" />
                            <span class="text-emerald-500 font-medium">{props.restoreLabel ?? 'Restaurar'}</span>
                        </DropdownMenu.Item>
                    </Show>
                    
                    {/* Extra Actions / Custom Children */}
                    {props.children}

                    {/* Eliminar (Soft o Destructivo) */}
                    <Show when={hasDeleteAction() && (canDelete() || canDestroy())}>
                        <Show when={hasPreviousItems()}>
                            <DropdownMenu.Separator />
                        </Show>
                        <DropdownMenu.Item onSelect={props.onDelete} destructive>
                            <TrashIcon class="size-4 mr-2" />
                            <span>{props.deleteLabel ?? 'Eliminar'}</span>
                        </DropdownMenu.Item>
                    </Show>
                </DropdownMenu.Content>
            </DropdownMenu>
        </div>
    );
};

export { ActionButtons, type ActionButtonsProps } from './ActionButtons';

export const ActionMenu = Object.assign(ActionMenuComponent, {
    Item: DropdownMenu.Item,
    Separator: DropdownMenu.Separator,
    Group: DropdownMenu.Group,
    GroupLabel: DropdownMenu.GroupLabel,
    Label: DropdownMenu.Label,
    Icon: DropdownMenu.Icon,
    Buttons: ActionButtons,
});

export default ActionMenu;
