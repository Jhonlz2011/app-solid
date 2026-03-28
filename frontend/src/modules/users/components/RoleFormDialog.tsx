import { Component, Show, createSignal, createEffect, createMemo, on } from 'solid-js';
import { toast } from 'solid-sonner';
import { FormDialog } from '@shared/ui/FormDialog';
import { TextField } from '@shared/ui/TextField';
import { PermissionMatrix } from './PermissionMatrix';
import { RoleBadge } from '@shared/ui/Badge';
import {
    useRole, useRolePermissions, usePermissions,
    useCreateRole, useUpdateRole, useUpdateRolePermissions
} from '../data/users.queries';

import type { Role } from '../models/users.types';
import { ShieldIcon } from '@/shared/ui/icons';

// =============================================================================
// Types
// =============================================================================

interface RoleFormDialogProps {
    /** 'create' | 'edit' | 'permissions' */
    mode: 'create' | 'edit' | 'permissions';
    /** Required when mode='edit' or 'permissions' */
    roleId?: number;
    isOpen: boolean;
    onClose: () => void;
}

// =============================================================================
// Component
// =============================================================================

const RoleFormDialog: Component<RoleFormDialogProps> = (props) => {
    // ── Queries (conditional) ────────────────────────────────────────────────
    const isEdit = () => props.mode === 'edit' || props.mode === 'permissions';
    const isPermissionsOnly = () => props.mode === 'permissions';
    const roleQuery = useRole(() => (isEdit() ? props.roleId ?? null : null));
    const rolePermsQuery = useRolePermissions(() => (isEdit() ? props.roleId ?? null : null));
    const allPermsQuery = usePermissions();

    // ── Mutations ────────────────────────────────────────────────────────────
    const createMutation = useCreateRole();
    const updateRoleMutation = useUpdateRole();
    const updatePermsMutation = useUpdateRolePermissions();

    // ── Form state (controlled) ─────────────────────────────────────────────
    const [roleName, setRoleName] = createSignal('');
    const [roleDescription, setRoleDescription] = createSignal('');

    // ── Permission selection state ───────────────────────────────────────────
    const [selectedPermIds, setSelectedPermIds] = createSignal<number[]>([]);

    // Sync form fields from server when editing — keyed to roleId to prevent stale data
    createEffect(on(
        () => [props.isOpen, props.roleId, roleQuery.data] as const,
        ([open, _id, data]) => {
            if (!open) return;
            if (isEdit() && data) {
                const rd = data as Role;
                setRoleName(rd.name ?? '');
                setRoleDescription(rd.description ?? '');
            } else if (!isEdit()) {
                setRoleName('');
                setRoleDescription('');
            }
        }
    ));

    // Sync permissions from server when editing
    createEffect(on(
        () => rolePermsQuery.data,
        (perms) => {
            if (isEdit() && perms) {
                setSelectedPermIds(perms.map(p => p.id));
            }
        }
    ));

    // Reset when dialog opens in create mode
    createEffect(on(
        () => props.isOpen,
        (open) => {
            if (open && !isEdit()) {
                setSelectedPermIds([]);
                setRoleName('');
                setRoleDescription('');
            }
        }
    ));

    // ── Derived ──────────────────────────────────────────────────────────────
    const selectedSet = createMemo(() => new Set(selectedPermIds()));
    const roleData = () => roleQuery.data as Role | undefined;
    const isSystem = () => isEdit() && (roleData()?.is_system ?? false);
    const isPending = () =>
        createMutation.isPending || updateRoleMutation.isPending || updatePermsMutation.isPending;

    const title = () => {
        if (props.mode === 'create') return 'Nuevo Rol';
        if (isPermissionsOnly()) return 'Permisos';
        return 'Editar Rol';
    };

    const subtitle = () => {
        if (isEdit() && roleData()) return roleData()!.description ?? undefined;
        return undefined;
    };

    const submitLabel = () => {
        if (props.mode === 'create') return 'Crear Rol';
        if (isPermissionsOnly()) return 'Guardar Permisos';
        return 'Guardar Cambios';
    };

    // Gate: don't show form until data has actually arrived in edit mode
    const isReady = () => !isEdit() || !!roleQuery.data;

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleToggle = (id: number) => {
        if (isSystem()) return;
        setSelectedPermIds(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleModuleToggle = (prefix: string, selected: boolean) => {
        if (isSystem()) return;
        const perms = allPermsQuery.data?.all ?? [];
        const moduleIds = perms.filter(p => p.slug.startsWith(prefix + '.')).map(p => p.id);
        setSelectedPermIds(prev => {
            const set = new Set(prev);
            moduleIds.forEach(id => selected ? set.add(id) : set.delete(id));
            return Array.from(set);
        });
    };

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        const name = roleName().trim();
        const description = roleDescription().trim() || undefined;

        if (!isPermissionsOnly() && !name) return;

        try {
            if (isPermissionsOnly() && props.roleId) {
                // Permissions-only mode: only update permissions
                await updatePermsMutation.mutateAsync({
                    roleId: props.roleId,
                    permissionIds: selectedPermIds(),
                });
                toast.success('Permisos actualizados correctamente');
            } else if (isEdit() && props.roleId) {
                // Full edit: update role info + permissions in parallel
                await Promise.all([
                    updateRoleMutation.mutateAsync({ id: props.roleId, name, description }),
                    updatePermsMutation.mutateAsync({ roleId: props.roleId, permissionIds: selectedPermIds() }),
                ]);
                toast.success('Rol actualizado correctamente');
            } else {
                // Create role, then assign permissions
                const created = await createMutation.mutateAsync({ name, description });
                if (selectedPermIds().length > 0) {
                    await updatePermsMutation.mutateAsync({
                        roleId: created.id,
                        permissionIds: selectedPermIds(),
                    });
                }
                toast.success(`Rol "${name}" creado correctamente`);
            }
            props.onClose();
        } catch (err: any) {
            toast.error(err?.message || 'Error al guardar');
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <FormDialog
            isOpen={props.isOpen}
            onClose={props.onClose}
            title={title()}
            subtitle={subtitle()}
            titleExtra={
                <Show when={isEdit() && roleData()}>
                    <div class="flex items-center gap-2">
                        <RoleBadge name={roleData()!.name} />
                        <Show when={isPermissionsOnly()}>
                            <span class="text-xs text-muted tabular-nums">
                                {selectedPermIds().length}/{allPermsQuery.data?.all?.length ?? 0}
                            </span>
                        </Show>
                    </div>
                </Show>
            }
            onSubmit={handleSubmit}
            submitLabel={submitLabel()}
            isLoading={isPending()}
            maxWidth="xl"
            hideFooter={isSystem()}
        >
            {/* Loading gate for edit mode — prevents flash */}
            <Show
                when={isReady()}
                fallback={
                    <div class="space-y-4">
                        <div class="h-10 bg-surface rounded-xl animate-pulse" />
                        <div class="h-10 bg-surface rounded-xl animate-pulse" />
                        <div class="h-32 bg-surface rounded-xl animate-pulse" />
                    </div>
                }
            >
                {/* System role warning */}
                <Show when={isSystem()}>
                    <div class="flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/20 rounded-xl px-4 py-3">
                        <ShieldIcon class="size-4"/> Este es un rol de sistema y no puede modificarse
                    </div>
                </Show>



                {/* Name + Description — hidden in permissions-only mode */}
                <Show when={!isPermissionsOnly()}>
                    <TextField.Root
                        value={roleName()}
                        onChange={setRoleName}
                        disabled={isPending() || isSystem()}
                    >
                        <TextField.Label>Nombre del rol</TextField.Label>
                        <TextField.Input name="name" placeholder="ej. editor, revisor" required />
                    </TextField.Root>
                    <TextField.Root
                        value={roleDescription()}
                        onChange={setRoleDescription}
                        disabled={isPending() || isSystem()}
                    >
                        <TextField.Label>Descripción</TextField.Label>
                        <TextField.Input name="description" placeholder="Describe las responsabilidades de este rol" />
                    </TextField.Root>
                </Show>

                {/* Permissions */}
                <div class="space-y-2">
                    <Show when={!isPermissionsOnly()}>
                        <div class="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-2 pt-2">
                            <div class="size-1.5 rounded-full bg-info" />
                            {isEdit() ? 'Permisos asignados' : 'Permisos iniciales'}
                        </div>
                    </Show>
                    <PermissionMatrix
                        allPermissions={allPermsQuery.data?.all ?? []}
                        selectedIds={selectedSet()}
                        onToggle={handleToggle}
                        onModuleToggle={handleModuleToggle}
                    />
                </div>
            </Show>
        </FormDialog>
    );
};

export default RoleFormDialog;
