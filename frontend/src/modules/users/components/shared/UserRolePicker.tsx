import { Component, For, Show, createMemo } from 'solid-js';
import type { RoleType } from '@app/schema/dto';
import Checkbox from '@form/Checkbox';
import { RoleBadge } from '@display/Badge';
import { SkeletonLoader } from '@display/SkeletonLoader';

export interface UserRolePickerProps {
    roles: RoleType[];
    rolesLoading?: boolean;
    selectedRoleIds: number[];
    onChange: (roleIds: number[]) => void;
    disabled?: boolean;
}

export const UserRolePicker: Component<UserRolePickerProps> = (props) => {
    const isUserSuperadmin = createMemo(() => {
        const superRole = props.roles?.find(r => r.name === 'superadmin');
        return superRole ? (props.selectedRoleIds?.includes(superRole.id) ?? false) : false;
    });

    const visibleRoles = createMemo(() => {
        return (props.roles ?? []).filter(r => r.name !== 'superadmin' || isUserSuperadmin());
    });

    const toggleRole = (roleId: number) => {
        const current = props.selectedRoleIds ?? [];
        if (current.includes(roleId)) {
            props.onChange(current.filter(id => id !== roleId));
        } else {
            props.onChange([...current, roleId]);
        }
    };

    return (
        <div class="space-y-3">
            <div class="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                <div class="size-1.5 rounded-full bg-info" />
                Roles asignados
            </div>
            <Show
                when={!props.rolesLoading}
                fallback={
                    <div class="space-y-2">
                        <SkeletonLoader type="text" count={3} />
                    </div>
                }
            >
                <Show
                    when={visibleRoles().length > 0}
                    fallback={<p class="text-sm text-muted">No hay roles disponibles</p>}
                >
                    <div class="space-y-2">
                        <For each={visibleRoles()}>
                            {(role) => {
                                const isChecked = () => props.selectedRoleIds?.includes(role.id) ?? false;
                                const isSuperadminRole = () => role.name === 'superadmin';
                                const isLocked = () => isSuperadminRole() && isChecked();
                                return (
                                    <label
                                        class="flex items-center gap-3 p-3 rounded-xl transition-colors border border-transparent group"
                                        classList={{
                                            'cursor-pointer hover:bg-surface/50 hover:border-border/40': !isLocked(),
                                            'cursor-not-allowed bg-surface/30 opacity-80': isLocked(),
                                        }}
                                    >
                                        <Checkbox
                                            name="roleIds"
                                            value={String(role.id)}
                                            checked={isChecked()}
                                            onChange={() => !isLocked() && toggleRole(role.id)}
                                            disabled={props.disabled || isLocked()}
                                        />
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2">
                                                <RoleBadge name={role.name} />
                                                <Show when={isLocked()}>
                                                    <span class="text-[11px] text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-md">
                                                        Propietario (Inmutable)
                                                    </span>
                                                </Show>
                                            </div>
                                            <Show when={role.description}>
                                                <p class="text-xs text-muted mt-0.5 truncate">{role.description}</p>
                                            </Show>
                                        </div>
                                    </label>
                                );
                            }}
                        </For>
                    </div>
                </Show>
            </Show>
        </div>
    );
};
