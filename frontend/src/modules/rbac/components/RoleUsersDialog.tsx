import { Component, For, Show, createSignal, createMemo, createEffect, on, onCleanup } from 'solid-js';
import { useParams } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { useQueryClient } from '@tanstack/solid-query';
import { FormDialog } from '@/shared/ui/overlay/FormDialog';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { Avatar } from '@/shared/ui/display/Avatar';
import { RoleBadge } from '@display/Badge';
import { SearchInput } from '@form/SearchInput';
import Button from '@form/Button';
import ConfirmDialog from '@overlay/ConfirmDialog';
import { UserMinusIcon } from '@icons/UserMinusIcon';
import { PlusIcon } from '@icons/PlusIcon';
import { UsersIcon } from '@icons/UsersIcon';
import { ShieldIcon } from '@icons/ShieldIcon';

import { rbacKeys } from '../data/users.keys';
import {
    useRoleUsers,
    useUsers,
    useRole,
} from '../data/users.queries';
import {
    useRemoveUserFromRole,
    useAssignUserRoles,
} from '../data/users.mutations';
import type { RoleUserType } from '@app/schema/dto';

// =============================================================================
// Types
// =============================================================================

export interface RoleUsersDialogProps {
    roleId?: number | null;
    roleName?: string;
    isOpen?: boolean;
    onClose?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export const RoleUsersDialog: Component<RoleUsersDialogProps> = (props) => {
    const params = useParams({ strict: false }) as () => { roleId?: string };
    const { close, navigateAway } = useSheetNavigation(props);

    const resolvedRoleId = () => props.roleId ?? (params()?.roleId ? Number(params().roleId) : null);
    const roleQuery = useRole(resolvedRoleId);
    const resolvedRoleName = () => props.roleName || roleQuery.data?.name || 'Rol';

    // ── Queries ───────────────────────────────────────────────────────────
    const queryClient = useQueryClient();
    const roleUsersQuery = useRoleUsers(resolvedRoleId);
    const removeMutation = useRemoveUserFromRole();
    const assignMutation = useAssignUserRoles();

    // ── Local state ──────────────────────────────────────────────────────
    const [search, setSearch] = createSignal('');
    const [showAddPanel, setShowAddPanel] = createSignal(false);
    const [addSearch, setAddSearch] = createSignal('');
    const [debouncedAddSearch, setDebouncedAddSearch] = createSignal('');
    const [confirmRemove, setConfirmRemove] = createSignal<{ userId: string; username: string } | null>(null);

    // Reset state when dialog closes/opens
    createEffect(on(() => props.isOpen, (open) => {
        if (open) {
            setShowAddPanel(false);
            setAddSearch('');
            setDebouncedAddSearch('');
        }
    }));

    // Debounce addSearch — 300ms
    createEffect(on(addSearch, (val) => {
        const timer = setTimeout(() => setDebouncedAddSearch(val), 300);
        onCleanup(() => clearTimeout(timer));
    }));

    // ── All users query (for add panel) — only fetches when panel is open ──
    const allUsersFilters = () => ({
        search: debouncedAddSearch() || undefined,
        page: 1,
        limit: 50,
    });
    const allUsersQuery = useUsers(allUsersFilters, () => showAddPanel());

    // ── Derived ──────────────────────────────────────────────────────────
    const roleUsers = () => roleUsersQuery.data ?? [];
    const assignedUserIds = createMemo(() => new Set(roleUsers().map((u: RoleUserType) => u.id)));

    const filteredRoleUsers = createMemo(() => {
        const term = search().toLowerCase();
        if (!term) return roleUsers();
        return roleUsers().filter((u: RoleUserType) =>
            u.username?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term)
        );
    });

    // Filter out: already assigned users AND superadmin users
    const availableUsers = createMemo(() => {
        const all = allUsersQuery.data?.data ?? [];
        return all.filter(u => {
            if (assignedUserIds().has(u.id)) return false;
            // Exclude users with superadmin role
            const hasSuperadmin = u.roles?.some((r: any) => r.name === 'superadmin');
            if (hasSuperadmin) return false;
            return true;
        });
    });

    // ── Handlers ─────────────────────────────────────────────────────────
    const handleRemove = () => {
        const target = confirmRemove();
        const targetRoleId = resolvedRoleId();
        if (!target || !targetRoleId) return;
        removeMutation.mutate(
            { roleId: targetRoleId, userId: target.userId },
            {
                onSuccess: () => {
                    toast.success(`${target.username} removido del rol`);
                    setConfirmRemove(null);
                },
                onError: (err: any) => toast.error(err?.message || 'Error al remover usuario'),
            }
        );
    };

    const handleAssign = (userId: string, username: string) => {
        const targetRoleId = resolvedRoleId();
        if (!targetRoleId) return;
        const allUsers = allUsersQuery.data?.data ?? [];
        const user = allUsers.find(u => u.id === userId);
        const currentUserRoleIds = user?.roles?.map((r: any) => r.id) ?? [];
        const newRoleIds = [...currentUserRoleIds, targetRoleId];

        assignMutation.mutate(
            { userId, roleIds: newRoleIds },
            {
                onSuccess: () => {
                    toast.success(`${username} agregado al rol`);
                    // Immediately invalidate to refresh the users list reactively
                    queryClient.invalidateQueries({ queryKey: rbacKeys.roleUsers(targetRoleId) });
                    queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
                },
                onError: (err: any) => toast.error(err?.message || 'Error al agregar usuario'),
            }
        );
    };

    return (
        <>
            <FormDialog
                isOpen={props.isOpen ?? true}
                onClose={close}
                title={`Usuarios — ${resolvedRoleName()}`}
                subtitle={`Administra qué usuarios pertenecen al rol "${resolvedRoleName()}"`}
                titleExtra={<RoleBadge name={resolvedRoleName()} />}
                onSubmit={(e) => { e.preventDefault(); close(); }}
                submitLabel="Listo"
                hideFooter={false}
                maxWidth="lg"
            >
                <div class="space-y-4">
                    {/* Header bar: search + add user toggle */}
                    <div class="flex items-center gap-2">
                        <SearchInput
                            value={search()}
                            onSearch={setSearch}
                            placeholder="Buscar usuarios asignados..."
                            class="flex-1"
                        />
                        <Show when={resolvedRoleName() !== 'superadmin'}>
                            <Button
                                variant={showAddPanel() ? 'secondary' : 'default'}
                                size="sm"
                                class="gap-1.5 shrink-0"
                                onClick={() => setShowAddPanel(prev => !prev)}
                            >
                                <PlusIcon class={`size-4 transition-transform ${showAddPanel() ? 'rotate-45' : ''}`} />
                                {showAddPanel() ? 'Cerrar' : 'Agregar'}
                            </Button>
                        </Show>
                    </div>

                    {/* Add user panel (expandable) */}
                    <Show when={showAddPanel()}>
                        <div class="p-3 bg-surface/40 border border-border rounded-xl space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-semibold text-text">Agregar usuarios a este rol</span>
                                <span class="text-xs text-muted">{availableUsers().length} disponible{availableUsers().length !== 1 ? 's' : ''}</span>
                            </div>

                            <SearchInput
                                value={addSearch()}
                                onSearch={setAddSearch}
                                placeholder="Filtrar por nombre o email..."
                                class="w-full"
                            />

                            <div class="max-h-48 overflow-y-auto space-y-1 pr-1">
                                <Show
                                    when={availableUsers().length > 0}
                                    fallback={
                                        <p class="text-xs text-muted text-center py-4">
                                            {addSearch() ? 'No se encontraron usuarios disponibles' : 'Todos los usuarios ya tienen este rol asignado'}
                                        </p>
                                    }
                                >
                                    <For each={availableUsers()}>
                                        {(user) => (
                                            <Button
                                                variant="ghost"
                                                size="none"
                                                class="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface text-left"
                                                onClick={() => handleAssign(user.id, user.username)}
                                                disabled={assignMutation.isPending}
                                            >
                                                <Avatar name={user.username} size="sm" />
                                                <div class="flex-1 min-w-0">
                                                    <div class="text-sm font-medium text-text truncate">{user.username}</div>
                                                    <div class="text-xs text-muted truncate">{user.email}</div>
                                                </div>
                                                <PlusIcon class="size-4 text-primary shrink-0" />
                                            </Button>
                                        )}
                                    </For>
                                </Show>
                            </div>
                        </div>
                    </Show>

                    {/* Current users list */}
                    <Show
                        when={!roleUsersQuery.isPending}
                        fallback={
                            <div class="space-y-2">
                                <For each={Array(3)}>
                                    {() => <div class="h-14 bg-surface rounded-xl animate-pulse" />}
                                </For>
                            </div>
                        }
                    >
                        <Show
                            when={filteredRoleUsers().length > 0}
                            fallback={
                                <div class="flex flex-col items-center justify-center py-10 text-center">
                                    <UsersIcon class="size-8 opacity-20 mb-3" />
                                    <p class="text-sm text-muted">
                                        {search() ? 'Sin resultados' : 'No hay usuarios asignados a este rol'}
                                    </p>
                                </div>
                            }
                        >
                            <div class="space-y-1">
                                <For each={filteredRoleUsers()}>
                                    {(user: any) => (
                                        <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-surface/50 transition-colors group/item">
                                            <Avatar name={user.username} size="sm" />
                                            <div class="flex-1 min-w-0">
                                                <div class="text-sm font-medium text-text truncate">{user.username}</div>
                                                <div class="text-xs text-muted truncate">{user.email}</div>
                                            </div>
                                            <Show when={resolvedRoleName() !== 'superadmin'}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon_md"
                                                    class="text-muted hover:text-danger hover:bg-danger/10 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                                    onClick={() => setConfirmRemove({ userId: user.id, username: user.username })}
                                                >
                                                    <UserMinusIcon class="size-4" />
                                                </Button>
                                            </Show>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </Show>
                    </Show>

                    {/* Footer count */}
                    <div class="text-xs text-muted text-center pt-2 border-t border-border/40">
                        {roleUsers().length} usuario{roleUsers().length !== 1 ? 's' : ''} asignado{roleUsers().length !== 1 ? 's' : ''}
                    </div>
                </div>
            </FormDialog>

            {/* Confirm remove */}
            <ConfirmDialog
                isOpen={confirmRemove() !== null}
                onClose={() => setConfirmRemove(null)}
                onConfirm={handleRemove}
                title="Quitar usuario del rol"
                description={`¿Quitar a "${confirmRemove()?.username}" del rol "${resolvedRoleName()}"?`}
                confirmLabel="Quitar"
                loadingText="Quitando..."
                variant="danger"
                isLoading={removeMutation.isPending}
            />
        </>
    );
};

export default RoleUsersDialog;
