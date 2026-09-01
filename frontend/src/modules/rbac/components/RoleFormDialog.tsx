import { Component, Show, createSignal, createEffect, createMemo, on } from 'solid-js';
import { useParams } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { FormDialog } from '@/shared/ui/overlay/FormDialog';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { TextField, FieldLabel } from '@form/TextField';
import { PermissionMatrix } from './PermissionMatrix';
import { RoleBadge } from '@display/Badge';
import { safeParse } from 'valibot';
import { RoleCreateSchema } from '@app/schema/frontend';
import {
    useRole, useRolePermissions, usePermissions,
} from '../data/users.queries';
import {
    useCreateRole, useUpdateRole, useUpdateRolePermissions,
} from '../data/users.mutations';
import { ShieldIcon } from '@/shared/ui/icons';

// =============================================================================
// Types
// =============================================================================

export interface RoleFormDialogProps {
    /** 'create' | 'edit' | 'permissions' */
    mode?: 'create' | 'edit' | 'permissions';
    /** Required when mode='edit' or 'permissions' */
    roleId?: number;
    isOpen?: boolean;
    onClose?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export const RoleFormDialog: Component<RoleFormDialogProps> = (props) => {
    const params = useParams({ strict: false }) as () => { roleId?: string };
    const { close, navigateAway } = useSheetNavigation(props);

    const resolvedRoleId = () => props.roleId ?? (params()?.roleId ? Number(params().roleId) : undefined);
    const resolvedMode = () => props.mode ?? (params()?.roleId ? 'edit' : 'create');

    // ── Queries (conditional) ────────────────────────────────────────────────
    const isEdit = () => resolvedMode() === 'edit' || resolvedMode() === 'permissions';
    const isPermissionsOnly = () => resolvedMode() === 'permissions';
    const roleQuery = useRole(() => (isEdit() ? resolvedRoleId() ?? null : null));
    const rolePermsQuery = useRolePermissions(() => (isEdit() ? resolvedRoleId() ?? null : null));
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
        () => [props.isOpen ?? true, resolvedRoleId(), roleQuery.data] as const,
        ([open, _id, data]) => {
            if (!open) return;
            if (isEdit() && data) {
                setRoleName(data.name ?? '');
                setRoleDescription(data.description ?? '');
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
    const roleData = () => roleQuery.data;
    const isSystem = () => isEdit() && (roleData()?.is_system ?? false);
    const isPending = () =>
        createMutation.isPending || updateRoleMutation.isPending || updatePermsMutation.isPending;

    const title = () => {
        if (resolvedMode() === 'create') return 'Nuevo Rol';
        if (isPermissionsOnly()) return 'Permisos';
        return 'Editar Rol';
    };

    const subtitle = () => {
        if (isEdit() && roleData()) return roleData()!.description ?? undefined;
        return undefined;
    };

    const submitLabel = () => {
        if (resolvedMode() === 'create') return 'Crear Rol';
        if (isPermissionsOnly()) return 'Guardar Permisos';
        return 'Guardar Cambios';
    };

    // Gate: don't show form until role data AND permissions have arrived in edit mode (eliminates pop-in flicker)
    const isReady = () => !isEdit() || (Boolean(roleQuery.data) && !rolePermsQuery.isPending && !allPermsQuery.isPending);

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
        const targetRoleId = resolvedRoleId();

        if (!isPermissionsOnly()) {
            const parsed = safeParse(RoleCreateSchema, { name, description: description ?? null });
            if (!parsed.success) {
                const firstIssue = parsed.issues[0]?.message || 'Nombre de rol inválido';
                toast.error(firstIssue);
                return;
            }
        }

        try {
            if (isPermissionsOnly() && targetRoleId) {
                // Permissions-only mode: only update permissions
                await updatePermsMutation.mutateAsync({
                    roleId: targetRoleId,
                    permissionIds: selectedPermIds(),
                });
                toast.success('Permisos actualizados correctamente');
            } else if (isEdit() && targetRoleId) {
                // Full edit: update role info + permissions in parallel
                await Promise.all([
                    updateRoleMutation.mutateAsync({ id: targetRoleId, name, description }),
                    updatePermsMutation.mutateAsync({ roleId: targetRoleId, permissionIds: selectedPermIds() }),
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
            close();
        } catch (err: any) {
            toast.error(err?.message || 'Error al guardar');
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <FormDialog
            isOpen={props.isOpen ?? true}
            onClose={close}
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
                        <FieldLabel>Permisos</FieldLabel>
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
