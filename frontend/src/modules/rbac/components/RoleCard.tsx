import { Component, JSX, Show } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import type { RoleType } from '@app/schema/dto';
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

// ── Badge-to-accent color map (mirrors rolePresentations in Badge.tsx) ──
const ROLE_ACCENT_COLORS: Record<string, string> = {
    superadmin: 'from-danger/70 via-danger/30',
    admin: 'from-warning/70 via-warning/30',
};
const DEFAULT_ACCENT = 'from-info/70 via-info/30';

export interface RoleCardProps {
    role: RoleType;
    onDelete?: () => void;
}

export const RoleCard: Component<RoleCardProps> = (props) => {
    const isSystem = () => props.role.is_system ?? false;
    const userCount = () => props.role.userCount ?? 0;
    const permCount = () => props.role.permissionCount ?? 0;
    const accentColor = () => ROLE_ACCENT_COLORS[props.role.name] ?? DEFAULT_ACCENT;

    return (
        <div class="group relative bg-card border border-border/60 rounded-2xl shadow-card-soft overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all">
            {/* Accent top bar — matches badge color */}
            <div class={`h-1 w-full bg-linear-to-r ${accentColor()} to-transparent`} />

            {/* Content */}
            <div class="px-5 pt-4 pb-3 flex flex-col gap-3">
                {/* Header row */}
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                        <RoleBadge name={props.role.name} />
                        <Show when={isSystem()}>
                            <Tooltip content="Rol protegido del sistema">
                                <ShieldIcon class="size-3.5 text-danger/60" />
                            </Tooltip>
                        </Show>
                    </div>

                    {/* Actions dropdown — always visible for non-system */}
                    <Show when={!isSystem()}>
                        <DropdownMenu placement="bottom-end">
                            <DropdownMenu.Trigger
                                variant="ghost"
                                size="sm"
                                class="h-7 w-7 p-0 text-muted hover:text-text shrink-0"
                            >
                                <MoreVerticalIcon class="size-4" />
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content class="min-w-40">
                                <DropdownMenu.Item as={Link} to={`/users/role/${props.role.id}/edit`} preload="intent">
                                    <EditIcon class="size-4 mr-2" />
                                    Editar rol
                                </DropdownMenu.Item>
                                <DropdownMenu.Item as={Link} to={`/users/role/${props.role.id}/permissions`} preload="intent">
                                    <KeyIcon class="size-4 mr-2" />
                                    Permisos
                                </DropdownMenu.Item>
                                <DropdownMenu.Item as={Link} to={`/users/role/${props.role.id}/users`} preload="intent">
                                    <UsersIcon class="size-4 mr-2" />
                                    Usuarios
                                </DropdownMenu.Item>
                                <Show when={props.onDelete}>
                                    <DropdownMenu.Separator />
                                    <DropdownMenu.Item onSelect={props.onDelete} destructive>
                                        <TrashIcon class="size-4 mr-2" />
                                        Eliminar
                                    </DropdownMenu.Item>
                                </Show>
                            </DropdownMenu.Content>
                        </DropdownMenu>
                    </Show>
                    <Show when={isSystem()}>
                        <Tooltip content="Ver permisos del rol">
                            <Link
                                to={`/users/role/${props.role.id}/permissions`}
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
                        tooltip={isSystem() ? 'Ver permisos' : 'Editar permisos'}
                    />
                </div>
            </div>
        </div>
    );
};

export default RoleCard;
