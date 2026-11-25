import { Component, JSX, Show } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import type { RoleType } from '@app/schema/dto';
import { SYSTEM_ROLES } from '@app/schema/enums';
import { ROLE_DISPLAY_META } from '@app/schema/utils';
import { RoleBadge } from '@display/Badge';
import { EditIcon } from '@icons/EditIcon';
import { TrashIcon } from '@icons/TrashIcon';
import { KeyIcon } from '@icons/KeyIcon';
import { UsersIcon } from '@icons/UsersIcon';
import { MoreVerticalIcon } from '@icons/MoreVerticalIcon';
import { ShieldIcon } from '@icons/ShieldIcon';
import { EyeIcon } from '@icons/EyeIcon';
import { Tooltip } from '@/shared/ui/overlay/Tooltip';
import { DropdownMenu } from '@display/DropdownMenu';
import { useAuth } from '@modules/auth/store/auth.store';

// ── Reusable stat display (interactive with Link or static) ──
const StatLink = (p: { icon: JSX.Element; count: number; label: string; to?: string; tooltip?: string }) => {
    const text = () => `${p.label}${p.count !== 1 ? 's' : ''}`;

    return (
        <Show
            when={p.to}
            fallback={
                <span class="flex items-center gap-1.5 text-xs text-muted">
                    {p.icon}
                    <span class="tabular-nums font-medium">{p.count}</span>
                    <span>{text()}</span>
                </span>
            }
        >
            <Tooltip content={p.tooltip!}>
                <Link
                    to={p.to!}
                    search={(prev: any) => ({ ...prev, tab: 'roles' })}
                    preload="intent"
                    class="flex items-center gap-1.5 text-xs text-muted px-2 py-1 rounded-lg hover:bg-info/10 hover:text-info transition-colors"
                    onClick={(e) => e.stopPropagation()}
                >
                    {p.icon}
                    <span class="tabular-nums font-medium">{p.count}</span>
                    <span>{text()}</span>
                </Link>
            </Tooltip>
        </Show>
    );
};

const DEFAULT_ACCENT = 'from-info/70 via-info/30';

export interface RoleCardProps {
    role: RoleType;
    onDelete?: () => void;
    onPrefetch?: () => void;
}

export const RoleCard: Component<RoleCardProps> = (props) => {
    const auth = useAuth();
    const isSuperadminRole = () => props.role.name === SYSTEM_ROLES.SUPERADMIN;
    const isSystem = () => props.role.is_system ?? false;
    const isCallerSuperadmin = () => auth.hasRole(SYSTEM_ROLES.SUPERADMIN);
    const userCount = () => props.role.userCount ?? 0;
    const permCount = () => props.role.permissionCount ?? 0;

    const accentColor = () =>
        ROLE_DISPLAY_META[props.role.name.toLowerCase()]?.accent ?? DEFAULT_ACCENT;

    const canEditRole = () => !isSystem() && auth.canEdit('roles');
    const canEditPerms = () => auth.hasPermission('permissions.update');
    const canReadPerms = () => auth.canRead('permissions') || canEditPerms();
    const canEditSystemRole = () => isSystem() && !isSuperadminRole() && isCallerSuperadmin() && (auth.canEdit('roles') || canEditPerms());
    const canDeleteRole = () => !isSystem() && Boolean(props.onDelete) && auth.canDelete('roles');
    const showDropdown = () =>
        (!isSystem() && (canEditRole() || canReadPerms() || canDeleteRole())) || canEditSystemRole();

    const shieldTooltip = () => {
        if (isSuperadminRole()) return 'Rol propietario del sistema (inmutable)';
        if (isCallerSuperadmin()) return 'Rol protegido del sistema (solo Super Administrador puede ajustar sus permisos)';
        return 'Rol protegido del sistema (solo lectura)';
    };

    return (
        <div
            onMouseEnter={() => props.onPrefetch?.()}
            class="group relative bg-card border border-border/60 rounded-2xl shadow-card-soft overflow-hidden hover:shadow-lg transition-shadow"
        >
            {/* Accent top bar — matches badge color */}
            <div class={`h-1 w-full bg-linear-to-r ${accentColor()} to-transparent`} />

            {/* Content */}
            <div class="px-5 pt-4 pb-3 flex flex-col gap-3">
                {/* Header row */}
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                        <RoleBadge name={props.role.name} />
                        <Show when={isSystem()}>
                            <Tooltip content={shieldTooltip()}>
                                <ShieldIcon class="size-3.5 text-danger/60 shrink-0" />
                            </Tooltip>
                        </Show>
                    </div>

                    {/* Actions dropdown — custom roles OR admin/contador when caller is superadmin */}
                    <Show when={showDropdown()}>
                        <DropdownMenu placement="bottom-end">
                            <DropdownMenu.Trigger
                                variant="ghost"
                                size="sm"
                                class="h-7 w-7 p-0 text-muted hover:text-text shrink-0"
                            >
                                <MoreVerticalIcon class="size-4" />
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content class="min-w-44">
                                <Show when={canEditRole() || canEditSystemRole()}>
                                    <DropdownMenu.Item
                                        to={`/users/role/${props.role.id}/edit`}
                                        search={(prev: any) => ({ ...prev, tab: 'roles' })}
                                        preload="intent"
                                    >
                                        <EditIcon class="size-4 mr-2" />
                                        {isSystem() ? 'Configurar rol' : 'Editar rol'}
                                    </DropdownMenu.Item>
                                </Show>
                                <Show when={canReadPerms()}>
                                    <DropdownMenu.Item
                                        to={`/users/role/${props.role.id}/permissions`}
                                        search={(prev: any) => ({ ...prev, tab: 'roles' })}
                                        preload="intent"
                                    >
                                        <KeyIcon class="size-4 mr-2" />
                                        Permisos
                                    </DropdownMenu.Item>
                                </Show>
                                <DropdownMenu.Item
                                    to={`/users/role/${props.role.id}/users`}
                                    search={(prev: any) => ({ ...prev, tab: 'roles' })}
                                    preload="intent"
                                >
                                    <UsersIcon class="size-4 mr-2" />
                                    Usuarios
                                </DropdownMenu.Item>
                                <Show when={canDeleteRole()}>
                                    <DropdownMenu.Separator />
                                    <DropdownMenu.Item onSelect={props.onDelete} destructive>
                                        <TrashIcon class="size-4 mr-2" />
                                        Eliminar
                                    </DropdownMenu.Item>
                                </Show>
                            </DropdownMenu.Content>
                        </DropdownMenu>
                    </Show>

                    {/* Read-only eye button for superadmin role or non-superadmin viewing system roles */}
                    <Show when={!showDropdown() && isSystem() && canReadPerms()}>
                        <Tooltip content="Ver permisos del rol">
                            <Link
                                to={`/users/role/${props.role.id}/permissions`}
                                search={(prev: any) => ({ ...prev, tab: 'roles' })}
                                preload="intent"
                                class="flex items-center justify-center h-7 w-7 rounded-lg text-muted hover:text-text hover:bg-surface/50 transition-colors"
                            >
                                <EyeIcon class="size-4" />
                            </Link>
                        </Tooltip>
                    </Show>
                </div>

                {/* Description */}
                <p class="text-sm text-muted leading-relaxed line-clamp-2 min-h-12">
                    {props.role.description || 'Sin descripción'}
                </p>

                {/* Stats footer — justify-between */}
                <div class="flex items-center justify-between pt-2.5 border-t border-border/40">
                    <StatLink
                        icon={<UsersIcon class="size-3.5" />}
                        count={userCount()}
                        label="usuario"
                        to={`/users/role/${props.role.id}/users`}
                        tooltip="Ver usuarios del rol"
                    />
                    <StatLink
                        icon={<KeyIcon class="size-3.5" />}
                        count={permCount()}
                        label="permiso"
                        to={`/users/role/${props.role.id}/permissions`}
                        tooltip={isSuperadminRole() || (isSystem() && !isCallerSuperadmin()) ? 'Ver permisos' : 'Editar permisos'}
                    />
                </div>
            </div>
        </div>
    );
};

export default RoleCard;
