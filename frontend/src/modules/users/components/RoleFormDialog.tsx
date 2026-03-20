import { Component, Show, createSignal, createEffect, on } from 'solid-js';
import { toast } from 'solid-sonner';
import { FormDialog } from '@shared/ui/FormDialog';
import { TextField } from '@shared/ui/TextField';
import { PermissionMatrix } from '@shared/ui/PermissionMatrix';
import {
    useRole, useRolePermissions, usePermissions,
    useCreateRole, useUpdateRole, useUpdateRolePermissions,
    type Role,
} from '../data/users.api';

// =============================================================================
// Types
// =============================================================================

interface RoleFormDialogProps {
    /** 'create' for new role, 'edit' for existing */
    mode: 'create' | 'edit';
    /** Required when mode='edit' */
    roleId?: number;
    isOpen: boolean;
    onClose: () => void;
}

// =============================================================================
// Component
// =============================================================================

const RoleFormDialog: Component<RoleFormDialogProps> = (props) => {
    // ── Queries (conditional) ────────────────────────────────────────────────
    const isEdit = () => props.mode === 'edit';
    const roleQuery = useRole(() => (isEdit() ? props.roleId ?? null : null));
    const rolePermsQuery = useRolePermissions(() => (isEdit() ? props.roleId ?? null : null));
    const allPermsQuery = usePermissions();

    // ── Mutations ────────────────────────────────────────────────────────────
    const createMutation = useCreateRole();
    const updateRoleMutation = useUpdateRole();
    const updatePermsMutation = useUpdateRolePermissions();

    // ── Permission selection state ───────────────────────────────────────────
    const [selectedPermIds, setSelectedPermIds] = createSignal<number[]>([]);

    // Sync from server when editing — explicit dependency with on() guard
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
            }
        }
    ));

    // ── Derived ──────────────────────────────────────────────────────────────
    // Eden doesn't expose is_system on the single-role response — widen the type
    const roleData = () => roleQuery.data as Role | undefined;
    const isSystem = () => isEdit() && (roleData()?.is_system ?? false);
    const isPending = () =>
        createMutation.isPending || updateRoleMutation.isPending || updatePermsMutation.isPending;

    const title = () => isEdit() ? 'Editar Rol' : 'Nuevo Rol';
    const submitLabel = () => isEdit() ? 'Guardar Cambios' : 'Crear Rol';

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
        const form = e.currentTarget as HTMLFormElement;
        const data = new FormData(form);
        const name = (data.get('name') as string).trim();
        const description = (data.get('description') as string) || undefined;

        if (!name) return;

        try {
            if (isEdit() && props.roleId) {
                // Update role info + permissions in parallel
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
            toast.error(err?.message || `Error al ${isEdit() ? 'actualizar' : 'crear'} rol`);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <FormDialog
            isOpen={props.isOpen}
            onClose={props.onClose}
            title={title()}
            onSubmit={handleSubmit}
            submitLabel={submitLabel()}
            isLoading={isPending()}
            maxWidth="xl"
        >
            {/* System role warning */}
            <Show when={isSystem()}>
                <div class="flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/20 rounded-xl px-4 py-3">
                    🔒 Este es un rol de sistema y no puede modificarse
                </div>
            </Show>

            {/* Name + Description */}
            <TextField.Root defaultValue={isEdit() ? roleData()?.name ?? '' : ''} disabled={isPending() || isSystem()}>
                <TextField.Label>Nombre del rol</TextField.Label>
                <TextField.Input name="name" placeholder="ej. editor, revisor" required />
            </TextField.Root>
            <TextField.Root defaultValue={isEdit() ? roleData()?.description ?? '' : ''} disabled={isPending() || isSystem()}>
                <TextField.Label>Descripción</TextField.Label>
                <TextField.Input name="description" placeholder="Describe las responsabilidades de este rol" />
            </TextField.Root>

            {/* Permissions */}
            <div class="space-y-2 pt-2">
                <div class="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                    <div class="size-1.5 rounded-full bg-info" />
                    {isEdit() ? 'Permisos asignados' : 'Permisos iniciales'}
                </div>
                <PermissionMatrix
                    allPermissions={allPermsQuery.data?.all ?? []}
                    selectedIds={new Set(selectedPermIds())}
                    onToggle={handleToggle}
                    onModuleToggle={handleModuleToggle}
                />
            </div>
        </FormDialog>
    );
};

export default RoleFormDialog;
