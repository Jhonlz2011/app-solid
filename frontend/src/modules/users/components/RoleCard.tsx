import { Component, Show } from 'solid-js';
import type { Role } from '../models/users.types';
import { RoleBadge } from '@shared/ui/Badge';
import { EditIcon, TrashIcon, KeyIcon, UsersIcon, MoreVerticalIcon, ShieldIcon, EyeIcon } from '@shared/ui/icons';
import Button from '@shared/ui/Button';
import { Tooltip } from '@shared/ui/Tooltip';
import { DropdownMenu } from '@shared/ui/DropdownMenu';

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
            <div class="p-5 flex flex-col gap-3">
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
                    {/* Users stat */}
                    <Show
                        when={!isSystem()}
                        fallback={
                            <span class="flex items-center gap-1.5 text-xs text-muted">
                                <UsersIcon class="size-3.5" />
                                <span class="tabular-nums font-medium">{userCount()}</span>
                                <span>usuario{userCount() !== 1 ? 's' : ''}</span>
                            </span>
                        }
                    >
                        <Tooltip content="Ver usuarios del rol">
                            <Button
                                variant="ghost"
                                size="none"
                                radius="lg"
                                class="flex items-center gap-1.5 text-xs text-muted px-2 py-1 hover:bg-info/10 hover:text-info"
                                onClick={(e) => { e.stopPropagation(); props.onUsersClick(); }}
                            >
                                <UsersIcon class="size-3.5" />
                                <span class="tabular-nums font-medium">{userCount()}</span>
                                <span>usuario{userCount() !== 1 ? 's' : ''}</span>
                            </Button>
                        </Tooltip>
                    </Show>

                    {/* Permissions stat */}
                    <Show
                        when={!isSystem()}
                        fallback={
                            <span class="flex items-center gap-1.5 text-xs text-muted">
                                <KeyIcon class="size-3.5" />
                                <span class="tabular-nums font-medium">{permCount()}</span>
                                <span>permiso{permCount() !== 1 ? 's' : ''}</span>
                            </span>
                        }
                    >
                        <Tooltip content="Editar permisos">
                            <Button
                                variant="ghost"
                                size="none"
                                radius="lg"
                                class="flex items-center gap-1.5 text-xs text-muted px-2 py-1 hover:bg-info/10 hover:text-info"
                                onClick={(e) => { e.stopPropagation(); props.onPermissionsClick(); }}
                            >
                                <KeyIcon class="size-3.5" />
                                <span class="tabular-nums font-medium">{permCount()}</span>
                                <span>permiso{permCount() !== 1 ? 's' : ''}</span>
                            </Button>
                        </Tooltip>
                    </Show>
                </div>
            </div>
        </div>
    );
};

export default RoleCard;
