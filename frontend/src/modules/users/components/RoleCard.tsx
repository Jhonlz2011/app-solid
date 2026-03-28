import { Component, JSX, Show } from 'solid-js';
import type { Role } from '../models/users.types';
import { RoleBadge } from '@shared/ui/Badge';
import { EditIcon, TrashIcon, KeyIcon, UsersIcon, MoreVerticalIcon, ShieldIcon, EyeIcon } from '@shared/ui/icons';
import Button from '@shared/ui/Button';
import { Tooltip } from '@shared/ui/Tooltip';
import { DropdownMenu } from '@shared/ui/DropdownMenu';

// ── Reusable stat display (interactive or static) ──
const StatButton = (p: { icon: JSX.Element; count: number; label: string; onClick?: () => void; tooltip?: string }) => {
    const text = () => `${p.label}${p.count !== 1 ? 's' : ''}`;

    return (
        <Show
            when={p.onClick}
            fallback={
                <span class="flex items-center gap-1.5 text-xs text-muted">
                    {p.icon}
                    <span class="tabular-nums font-medium">{p.count}</span>
                    <span>{text()}</span>
                </span>
            }
        >
            <Tooltip content={p.tooltip!}>
                <Button
                    variant="ghost"
                    size="none"
                    radius="lg"
                    class="flex items-center gap-1.5 text-xs text-muted px-2 py-1 hover:bg-info/10 hover:text-info"
                    onClick={(e) => { e.stopPropagation(); p.onClick!(); }}
                >
                    {p.icon}
                    <span class="tabular-nums font-medium">{p.count}</span>
                    <span>{text()}</span>
                </Button>
            </Tooltip>
        </Show>
    );
};

// ── Badge-to-accent color map (mirrors roleVariants in Badge.tsx) ──
const ROLE_ACCENT_COLORS: Record<string, string> = {
    superadmin: 'from-danger/70 via-danger/30',
    admin: 'from-warning/70 via-warning/30',
};
const DEFAULT_ACCENT = 'from-info/70 via-info/30';

interface RoleCardProps {
    role: Role;
    onEdit: () => void;
    onDelete: () => void;
    onUsersClick: () => void;
    onPermissionsClick: () => void;
    onMouseEnter?: () => void;
}

const RoleCard: Component<RoleCardProps> = (props) => {
    const isSystem = () => props.role.is_system ?? false;
    const userCount = () => props.role.userCount ?? 0;
    const permCount = () => props.role.permissionCount ?? 0;
    const accentColor = () => ROLE_ACCENT_COLORS[props.role.name] ?? DEFAULT_ACCENT;

    return (
        <div
            class="group relative bg-card border border-border/60 rounded-2xl shadow-card-soft overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            onMouseEnter={props.onMouseEnter}
        >
            {/* Accent top bar — matches badge color */}
            <div class={`h-1 w-full bg-gradient-to-r ${accentColor()} to-transparent`} />

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
                            <DropdownMenu.Content class="min-w-[160px]">
                                <DropdownMenu.Item onSelect={props.onEdit}>
                                    <EditIcon class="size-4 mr-2" />
                                    Editar rol
                                </DropdownMenu.Item>
                                <DropdownMenu.Item onSelect={props.onPermissionsClick}>
                                    <KeyIcon class="size-4 mr-2" />
                                    Permisos
                                </DropdownMenu.Item>
                                <DropdownMenu.Separator />
                                <DropdownMenu.Item onSelect={props.onDelete} destructive>
                                    <TrashIcon class="size-4 mr-2" />
                                    Eliminar
                                </DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu>
                    </Show>
                    <Show when={isSystem()}>
                        <Tooltip content="Ver permisos del rol">
                            <Button
                                variant="ghost"
                                size="sm"
                                class="h-7 w-7 p-0 text-muted hover:text-text shrink-0"
                                onClick={(e) => { e.stopPropagation(); props.onPermissionsClick(); }}
                            >
                                <EyeIcon class="size-4" />
                            </Button>
                        </Tooltip>
                    </Show>
                </div>

                {/* Description */}
                <p class="text-sm text-muted leading-relaxed line-clamp-2 min-h-12">
                    {props.role.description || 'Sin descripción'}
                </p>

                {/* Stats footer — justify-between */}
                <div class="flex items-center justify-between pt-2.5 border-t border-border/40">
                    <StatButton
                        icon={<UsersIcon class="size-3.5" />}
                        count={userCount()}
                        label="usuario"
                        onClick={!isSystem() ? props.onUsersClick : undefined}
                        tooltip={!isSystem() ? 'Ver usuarios del rol' : undefined}
                    />
                    <StatButton
                        icon={<KeyIcon class="size-3.5" />}
                        count={permCount()}
                        label="permiso"
                        onClick={!isSystem() ? props.onPermissionsClick : undefined}
                        tooltip={!isSystem() ? 'Editar permisos' : undefined}
                    />
                </div>
            </div>
        </div>
    );
};

export default RoleCard;
