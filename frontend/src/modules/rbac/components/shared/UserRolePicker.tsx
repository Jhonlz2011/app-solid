import { Component, For, Show, createMemo, createSignal } from 'solid-js';
import type { RoleType } from '@app/schema/dto';
import Checkbox from '@form/Checkbox';
import { RoleBadge } from '@display/Badge';
import { SkeletonLoader } from '@display/SkeletonLoader';
import { FieldLabel } from '@form/TextField';
import { SearchInput } from '@form/SearchInput';
import Button from '@form/Button';
import { PlusIcon } from '@icons/PlusIcon';
import RoleFormDialog from '../RoleFormDialog';

export interface UserRolePickerProps {
    roles: RoleType[];
    rolesLoading?: boolean;
    selectedRoleIds: number[];
    onChange: (roleIds: number[]) => void;
    disabled?: boolean;
    showSearch?: boolean;
}

export const UserRolePicker: Component<UserRolePickerProps> = (props) => {
    const [searchQuery, setSearchQuery] = createSignal('');
    const [isCreateRoleOpen, setIsCreateRoleOpen] = createSignal(false);

    const isUserSuperadmin = createMemo(() => {
        const superRole = props.roles?.find((r) => r.name === 'superadmin');
        return superRole ? (props.selectedRoleIds?.includes(superRole.id) ?? false) : false;
    });

    const baseRoles = createMemo(() => {
        return (props.roles ?? []).filter((r) => r.name !== 'superadmin' || isUserSuperadmin());
    });

    const visibleRoles = createMemo(() => {
        const query = searchQuery().trim().toLowerCase();
        if (!query) return baseRoles();
        return baseRoles().filter(
            (r) =>
                r.name.toLowerCase().includes(query) ||
                (r.description && r.description.toLowerCase().includes(query))
        );
    });

    const toggleRole = (roleId: number) => {
        const current = props.selectedRoleIds ?? [];
        if (current.includes(roleId)) {
            props.onChange(current.filter((id) => id !== roleId));
        } else {
            props.onChange([...current, roleId]);
        }
    };

    const selectedCount = () => props.selectedRoleIds?.length ?? 0;

    return (
        <div class="space-y-3">
            <div class="flex items-center justify-between gap-2">
                <FieldLabel>Roles asignados *</FieldLabel>
                <div class="flex items-center gap-2">
                    <Show when={selectedCount() > 0}>
                        <span class="text-xs text-muted font-normal">
                            {selectedCount()} seleccionado{selectedCount() === 1 ? '' : 's'}
                        </span>
                    </Show>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="h-7 px-2 text-xs text-primary hover:bg-primary/10 gap-1 font-medium"
                        icon={<PlusIcon class="size-3.5" />}
                        onClick={() => setIsCreateRoleOpen(true)}
                    >
                        Nuevo
                    </Button>
                </div>
            </div>

            <Show
                when={!props.rolesLoading}
                fallback={
                    <div class="space-y-2">
                        <SkeletonLoader type="text" count={3} />
                    </div>
                }
            >
                <Show when={(props.showSearch !== false && baseRoles().length > 3) || searchQuery()}>
                    <SearchInput
                        value={searchQuery()}
                        onSearch={setSearchQuery}
                        placeholder="Buscar roles por nombre o descripción..."
                        class="w-full"
                    />
                </Show>

                <Show
                    when={visibleRoles().length > 0}
                    fallback={
                        <Show
                            when={searchQuery()}
                            fallback={<p class="text-sm text-muted">No hay roles disponibles</p>}
                        >
                            <div class="text-center py-6 text-muted bg-surface/30 rounded-xl border border-dashed border-border/50 text-xs">
                                No se encontraron roles coincidentes con "{searchQuery()}"
                            </div>
                        </Show>
                    }
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
                                                        Propietario
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
            {/* Quick role creation dialog */}
            <RoleFormDialog
                isOpen={isCreateRoleOpen()}
                mode="create"
                onClose={() => setIsCreateRoleOpen(false)}
            />
        </div>
    );
};

export default UserRolePicker;
