import { Component, Show } from 'solid-js';
import type { Role } from '../models/users.types';
import { RoleBadge } from '@shared/ui/Badge';
import { EditIcon, TrashIcon, KeyIcon, UsersIcon } from '@shared/ui/icons';
import Button from '@shared/ui/Button';
import { Tooltip } from '@shared/ui/Tooltip';

interface RoleCardProps {
    role: Role;
    onEdit: () => void;
    onDelete: () => void;
}

const RoleCard: Component<RoleCardProps> = (props) => {
    const isSystem = () => props.role.is_system ?? false;

    return (
        <div
            role="button"
            tabIndex={0}
            class="group bg-card border border-border rounded-2xl shadow-card-soft p-5 hover:border-primary/30 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
            onClick={() => !isSystem() && props.onEdit()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !isSystem() && (e.preventDefault(), props.onEdit())}
        >
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0">
                        <KeyIcon class="size-5 text-primary" />
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <RoleBadge name={props.role.name} />
                            <Show when={isSystem()}>
                                <span class="text-[10px] bg-warning/10 text-warning border border-warning/20 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                    🔒 Sistema
                                </span>
                            </Show>
                        </div>
                        <p class="text-xs text-muted mt-1 truncate max-w-[200px]">
                            {props.role.description || 'Sin descripción'}
                        </p>
                    </div>
                </div>

                <Show when={!isSystem()}>
                    <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <Tooltip content="Editar">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={props.onEdit}
                                class="text-muted hover:text-warning hover:bg-warning/10 h-8 w-8"
                            >
                                <EditIcon class="size-4" />
                            </Button>
                        </Tooltip>
                        <Tooltip content="Eliminar">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={props.onDelete}
                                class="text-muted hover:text-danger hover:bg-danger/10 h-8 w-8"
                            >
                                <TrashIcon class="size-4" />
                            </Button>
                        </Tooltip>
                    </div>
                </Show>
            </div>

            <div class="flex items-center gap-3 text-sm">
                <div class="flex items-center gap-1.5 text-xs text-muted">
                    <UsersIcon class="size-3.5" />
                    <span>{props.role.userCount ?? 0} usuario(s)</span>
                </div>
                <div class="flex items-center gap-1.5 text-xs text-muted">
                    <KeyIcon class="size-3.5" />
                    <span>{props.role.permissionCount ?? 0} permiso(s)</span>
                </div>
            </div>
        </div>
    );
};

export default RoleCard;
