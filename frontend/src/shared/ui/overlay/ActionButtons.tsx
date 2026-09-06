import { Component, JSX, Show } from 'solid-js';
import { Link, type LinkProps } from '@tanstack/solid-router';
import { buttonVariants } from '@form/button-shared';
import { EditIcon } from '@icons/EditIcon';
import { TrashIcon } from '@icons/TrashIcon';
import { RotateCcwIcon } from '@icons/RotateCcwIcon';
import { EyeIcon } from '@icons/EyeIcon';
import { useAuth } from '@/modules/auth/store/auth.store';
import { cn } from '@shared/lib/utils';
import type { RbacModule } from '@app/schema/enums';

export interface ActionButtonsProps {
    /** The permission module name (e.g. 'brands', 'attributes', 'uom') to check capabilities against useAuth() */
    module?: RbacModule;

    /** Whether the row item is currently active. If false, shows Restore instead of Delete. Defaults to true */
    isActive?: boolean;

    /** Whether the action buttons are disabled */
    disabled?: boolean;

    /** Direct permission overrides if module is omitted or custom logic is needed */
    canView?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canDestroy?: boolean;
    canRestore?: boolean;

    /** Handlers for search params injected directly into Link */
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

    /** Custom labels for default actions (used for native title and aria-label) */
    showLabel?: string;
    editLabel?: string;
    deleteLabel?: string;
    restoreLabel?: string;

    /** Container & button styling */
    class?: string;
    buttonClass?: string;

    /** Optional extra actions inserted between Edit and Delete */
    children?: JSX.Element;
}

/**
 * ActionButtons — Zero-overhead, high-performance inline action row for data tables.
 *
 * Performance Characteristics:
 * - 0 Kobalte Tooltip/Popover Portals in the DOM during row render
 * - 0 window.matchMedia listeners attached per row
 * - Native HTML5 `title` and `aria-label` for instant, accessible tooltips
 * - Stops event propagation to prevent parent row navigation
 * - Responsive: visible on touch/mobile, reveals on row hover/focus in desktop
 */
export const ActionButtons: Component<ActionButtonsProps> = (props) => {
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

    return (
        <div
            class={cn(
                'flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity duration-150',
                props.class
            )}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Ver Detalles */}
            <Show when={hasViewAction() && canView()}>
                <Show
                    when={props.showTo}
                    fallback={
                        <button
                            type="button"
                            disabled={props.disabled}
                            title={props.showLabel ?? 'Ver detalles'}
                            aria-label={props.showLabel ?? 'Ver detalles'}
                            class={cn(
                                buttonVariants({ variant: 'ghost', size: 'icon_sm', radius: 'lg' }),
                                'text-muted hover:text-text cursor-pointer',
                                props.buttonClass
                            )}
                            onClick={props.onView}
                        >
                            <EyeIcon class="size-4" />
                        </button>
                    }
                >
                    {(to) => (
                        <Link
                            to={to()}
                            search={props.showSearch}
                            preload="intent"
                            title={props.showLabel ?? 'Ver detalles'}
                            aria-label={props.showLabel ?? 'Ver detalles'}
                            class={cn(
                                buttonVariants({ variant: 'ghost', size: 'icon_sm', radius: 'lg' }),
                                'text-muted hover:text-text cursor-pointer',
                                props.disabled && 'pointer-events-none opacity-50 cursor-not-allowed',
                                props.buttonClass
                            )}
                            onClick={(e: MouseEvent) => {
                                if (props.disabled) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    return;
                                }
                                props.onView?.();
                            }}
                        >
                            <EyeIcon class="size-4" />
                        </Link>
                    )}
                </Show>
            </Show>

            {/* Editar */}
            <Show when={hasEditAction() && canEdit()}>
                <Show
                    when={props.editTo}
                    fallback={
                        <button
                            type="button"
                            disabled={props.disabled}
                            title={props.editLabel ?? 'Editar'}
                            aria-label={props.editLabel ?? 'Editar'}
                            class={cn(
                                buttonVariants({ variant: 'ghost', size: 'icon_sm', radius: 'lg' }),
                                'text-muted hover:text-text cursor-pointer',
                                props.buttonClass
                            )}
                            onClick={props.onEdit}
                        >
                            <EditIcon class="size-4" />
                        </button>
                    }
                >
                    {(to) => (
                        <Link
                            to={to()}
                            search={props.editSearch}
                            preload="intent"
                            title={props.editLabel ?? 'Editar'}
                            aria-label={props.editLabel ?? 'Editar'}
                            class={cn(
                                buttonVariants({ variant: 'ghost', size: 'icon_sm', radius: 'lg' }),
                                'text-muted hover:text-text cursor-pointer',
                                props.disabled && 'pointer-events-none opacity-50 cursor-not-allowed',
                                props.buttonClass
                            )}
                            onClick={(e: MouseEvent) => {
                                if (props.disabled) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    return;
                                }
                                props.onEdit?.();
                            }}
                        >
                            <EditIcon class="size-4" />
                        </Link>
                    )}
                </Show>
            </Show>

            {/* Custom Children */}
            {props.children}

            {/* Restaurar */}
            <Show when={hasRestoreAction() && canRestore()}>
                <button
                    type="button"
                    disabled={props.disabled}
                    title={props.restoreLabel ?? 'Restaurar'}
                    aria-label={props.restoreLabel ?? 'Restaurar'}
                    class={cn(
                        buttonVariants({ variant: 'ghost', size: 'icon_sm', radius: 'lg' }),
                        'text-emerald-500 hover:bg-emerald-500/10 cursor-pointer',
                        props.buttonClass
                    )}
                    onClick={props.onRestore}
                >
                    <RotateCcwIcon class="size-4" />
                </button>
            </Show>

            {/* Eliminar (Soft o Destructivo) */}
            <Show when={hasDeleteAction() && (canDelete() || canDestroy())}>
                <button
                    type="button"
                    disabled={props.disabled}
                    title={props.deleteLabel ?? 'Eliminar'}
                    aria-label={props.deleteLabel ?? 'Eliminar'}
                    class={cn(
                        buttonVariants({ variant: 'ghost', size: 'icon_sm', radius: 'lg' }),
                        'text-muted hover:text-danger hover:bg-danger/10 cursor-pointer',
                        props.buttonClass
                    )}
                    onClick={props.onDelete}
                >
                    <TrashIcon class="size-4" />
                </button>
            </Show>
        </div>
    );
};

export default ActionButtons;
