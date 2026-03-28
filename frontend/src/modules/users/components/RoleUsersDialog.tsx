import { Component, For, Show, createSignal, createMemo, createEffect, on, onCleanup } from 'solid-js';
import { toast } from 'solid-sonner';
import { useQueryClient } from '@tanstack/solid-query';
import { FormDialog } from '@shared/ui/FormDialog';
import { Avatar } from '@shared/ui/Avatar';
import { RoleBadge } from '@shared/ui/Badge';
import { SearchInput } from '@shared/ui/SearchInput';
import Button from '@shared/ui/Button';
import ConfirmDialog from '@shared/ui/ConfirmDialog';
import { UserMinusIcon, PlusIcon, UsersIcon } from '@shared/ui/icons';
import { rbacKeys } from '../data/users.keys';
import {
    useRoleUsers,
    useRemoveUserFromRole,
    useUsers,
    useAssignUserRoles,
} from '../data/users.queries';

// =============================================================================
// Types
// =============================================================================

interface RoleUsersDialogProps {
    roleId: number | null;
    roleName: string;
    isOpen: boolean;
    onClose: () => void;
}

// =============================================================================
// Component
// =============================================================================

const RoleUsersDialog: Component<RoleUsersDialogProps> = (props) => {
    // ── Queries ───────────────────────────────────────────────────────────
    const queryClient = useQueryClient();
    const roleUsersQuery = useRoleUsers(() => props.roleId);
    const removeMutation = useRemoveUserFromRole();
    const assignMutation = useAssignUserRoles();

    // ── Local state ──────────────────────────────────────────────────────
    const [search, setSearch] = createSignal('');
    const [showAddPanel, setShowAddPanel] = createSignal(false);
    const [addSearch, setAddSearch] = createSignal('');
    const [debouncedAddSearch, setDebouncedAddSearch] = createSignal('');
    const [confirmRemove, setConfirmRemove] = createSignal<{ userId: number; username: string } | null>(null);

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
    const assignedUserIds = createMemo(() => new Set(roleUsers().map((u: any) => u.id)));

    const filteredRoleUsers = createMemo(() => {
        const term = search().toLowerCase();
        if (!term) return roleUsers();
        return roleUsers().filter((u: any) =>
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
        if (!target || !props.roleId) return;
        removeMutation.mutate(
            { roleId: props.roleId, userId: target.userId },
            {
                onSuccess: () => {
                    toast.success(`${target.username} removido del rol`);
                    setConfirmRemove(null);
                },
                onError: (err: any) => toast.error(err?.message || 'Error al remover usuario'),
            }
        );
    };

    const handleAssign = (userId: number, username: string) => {
        if (!props.roleId) return;
        const allUsers = allUsersQuery.data?.data ?? [];
        const user = allUsers.find(u => u.id === userId);
        const currentUserRoleIds = user?.roles?.map((r: any) => r.id) ?? [];
        const newRoleIds = [...currentUserRoleIds, props.roleId];

        assignMutation.mutate(
            { userId, roleIds: newRoleIds },
            {
                onSuccess: () => {
                    toast.success(`${username} agregado al rol`);
                    // Immediately invalidate to refresh the users list reactively
                    if (props.roleId) {
                        queryClient.invalidateQueries({ queryKey: rbacKeys.roleUsers(props.roleId) });
                    }
                },
                onError: (err: any) => toast.error(err?.message || 'Error al asignar usuario'),
            }
        );
    };

    return (
        <>
            <FormDialog
                isOpen={props.isOpen}
                onClose={props.onClose}
                title="Usuarios del rol"
                titleExtra={<RoleBadge name={props.roleName} />}
                maxWidth="lg"
                hideFooter
                onSubmit={(e) => e.preventDefault()}
            >
                <div class="space-y-4 py-4">
                    {/* Search + Add button */}
                    <div class="flex items-center gap-2">
                        <SearchInput
                            value={search()}
                            onSearch={setSearch}
                            placeholder="Buscar usuarios..."
                            class="flex-1"
                        />
                        <Button
                            variant={showAddPanel() ? 'outline' : 'primary'}
                            size="sm"
                            icon={<PlusIcon />}
                            onClick={() => setShowAddPanel(!showAddPanel())}
                        >
                            <span class="hidden sm:inline">{showAddPanel() ? 'Cerrar' : 'Agregar'}</span>
                        </Button>
                    </div>

                    {/* Add user panel */}
                    <Show when={showAddPanel()}>
                        <div class="border border-primary/20 bg-primary/5 rounded-xl p-4 space-y-3">
                            <div class="text-xs font-semibold text-primary uppercase tracking-wider">
                                Agregar usuario al rol
                            </div>
                            <SearchInput
                                value={addSearch()}
                                onSearch={setAddSearch}
                                placeholder="Buscar usuario para agregar..."
                                class="w-full"
                            />
                            <div class="max-h-48 overflow-y-auto space-y-1">
                                <Show
                                    when={availableUsers().length > 0}
                                    fallback={
                                        <p class="text-xs text-muted text-center py-3">
                                            {addSearch() ? 'Sin resultados' : 'Todos los usuarios ya están asignados'}
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
                                            <Button
                                                variant="ghost"
                                                size="icon_md"
                                                class="text-muted hover:text-danger hover:bg-danger/10 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                                onClick={() => setConfirmRemove({ userId: user.id, username: user.username })}
                                            >
                                                <UserMinusIcon class="size-4" />
                                            </Button>
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
                description={`¿Quitar a "${confirmRemove()?.username}" del rol "${props.roleName}"?`}
                confirmLabel="Quitar"
                loadingText="Quitando..."
                variant="danger"
                isLoading={removeMutation.isPending}
            />
        </>
    );
};

export default RoleUsersDialog;
