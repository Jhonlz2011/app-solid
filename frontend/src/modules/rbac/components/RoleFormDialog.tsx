import { Component, For, Show, createSignal, createEffect, createMemo, on } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { useParams } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { FormDialog } from '@/shared/ui/overlay/FormDialog';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { TextField, FieldLabel } from '@form/TextField';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { handleFormApiErrors } from '@shared/utils/form.utils';
import { PermissionMatrix } from './PermissionMatrix';
import { RoleBadge } from '@display/Badge';
import { RoleCreateSchema } from '@app/schema/frontend';
import { SYSTEM_ROLES, type PermissionSlug } from '@app/schema/enums';
import { getRoleDisplayLabel } from '@app/schema/utils';
import { useAuth } from '@modules/auth/store/auth.store';
import {
    useRole, useRolePermissions, usePermissions, useRoles,
} from '../data/users.queries';
import {
    useCreateRole, useUpdateRole, useUpdateRolePermissions,
} from '../data/users.mutations';
import { usersApi } from '../data/users.api';
import { ShieldIcon } from '@icons/ShieldIcon';
import { CopyIcon } from '@icons/CopyIcon';

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

const ACCOUNTANT_BLOCKED_ACTIONS = ['delete', 'destroy'] as const;

// =============================================================================
// Component
// =============================================================================

export const RoleFormDialog: Component<RoleFormDialogProps> = (props) => {
    const params = useParams({ strict: false }) as () => { roleId?: string };
    const { close } = useSheetNavigation(props);
    const auth = useAuth();

    const resolvedRoleId = () => props.roleId ?? (params()?.roleId ? Number(params().roleId) : undefined);
    const resolvedMode = () => props.mode ?? (params()?.roleId ? 'edit' : 'create');

    // ── Queries (conditional) ────────────────────────────────────────────────
    const isEdit = () => resolvedMode() === 'edit' || resolvedMode() === 'permissions';
    const isPermissionsOnly = () => resolvedMode() === 'permissions';
    const roleQuery = useRole(() => (isEdit() ? resolvedRoleId() ?? null : null));
    const rolePermsQuery = useRolePermissions(() => (isEdit() ? resolvedRoleId() ?? null : null));
    const allPermsQuery = usePermissions();
    const rolesQuery = useRoles();

    // ── Mutations ────────────────────────────────────────────────────────────
    const createMutation = useCreateRole();
    const updateRoleMutation = useUpdateRole();
    const updatePermsMutation = useUpdateRolePermissions();

    // ── Permission selection & template copy state ───────────────────────────
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);
    const [selectedPermSlugs, setSelectedPermSlugs] = createSignal<PermissionSlug[]>([]);
    const [copyingFromId, setCopyingFromId] = createSignal<string>('');
    const [isCopyingTemplate, setIsCopyingTemplate] = createSignal(false);

    // ── Derived mutability rules (confirmed with user) ───────────────────────
    const roleData = () => roleQuery.data;
    const isSuperadminRole = () => isEdit() && roleData()?.name === SYSTEM_ROLES.SUPERADMIN;
    const isAccountantRole = () => isEdit() && roleData()?.name === SYSTEM_ROLES.CONTADOR;
    const isSystem = () => isEdit() && Boolean(roleData()?.is_system);
    const isCallerSuperadmin = () => auth.hasRole(SYSTEM_ROLES.SUPERADMIN);
    // Only superadmin role is strictly immutable; admin & contador are editable ONLY by superadmin
    const isReadOnly = () => isSuperadminRole() || (isSystem() && !isCallerSuperadmin());
    const isNameLocked = () => isSystem();
    const blockedActions = () => (isAccountantRole() ? ACCOUNTANT_BLOCKED_ACTIONS : []);

    // ── TanStack Form ────────────────────────────────────────────────────────
    const form = createForm(() => ({
        defaultValues: {
            name: '',
            description: '',
        },
        validators: {
            onChange: ({ value }) => {
                if (isPermissionsOnly()) return undefined;
                const result = RoleCreateSchema['~standard'].validate({
                    name: value.name,
                    description: value.description || null,
                });
                if (result instanceof Promise) return undefined;
                if (result.issues) {
                    const fields: Record<string, string> = {};
                    for (const issue of result.issues) {
                        const key = issue.path?.[0];
                        const fieldName = typeof key === 'object' && key !== null && 'key' in key
                            ? String((key as { key: unknown }).key)
                            : String(key ?? '');
                        if (fieldName && !fields[fieldName]) fields[fieldName] = issue.message;
                    }
                    return { fields };
                }
                return undefined;
            },
        },
        onSubmit: async ({ value }) => {
            if (isReadOnly()) return;
            const name = value.name.trim();
            const description = value.description.trim() || undefined;
            const targetRoleId = resolvedRoleId();

            try {
                if (isPermissionsOnly() && targetRoleId) {
                    await updatePermsMutation.mutateAsync({
                        roleId: targetRoleId,
                        permissionSlugs: selectedPermSlugs(),
                    });
                    toast.success('Permisos actualizados correctamente');
                } else if (isEdit() && targetRoleId) {
                    // Single atomic backend transaction (role metadata + permissions)
                    await updateRoleMutation.mutateAsync({
                        id: targetRoleId,
                        name: isNameLocked() ? (roleData()?.name ?? name) : name,
                        description,
                        permissionSlugs: selectedPermSlugs(),
                    });
                    toast.success('Rol actualizado correctamente');
                } else {
                    // Single atomic backend transaction (create role + permissions)
                    await createMutation.mutateAsync({
                        name,
                        description,
                        permissionSlugs: selectedPermSlugs(),
                    });
                    toast.success(`Rol "${name}" creado correctamente`);
                }
                close();
            } catch (err) {
                handleFormApiErrors(form, err, 'Error al guardar el rol', 'role-form-dialog');
            }
        },
    }));

    // Sync form fields from server when editing
    createEffect(on(
        () => [props.isOpen ?? true, resolvedRoleId(), roleQuery.data] as const,
        ([open, _id, data]) => {
            if (!open) return;
            if (isEdit() && data) {
                form.reset({
                    name: data.name ?? '',
                    description: data.description ?? '',
                });
            } else if (!isEdit()) {
                form.reset({ name: '', description: '' });
            }
        }
    ));

    // Sync permissions from server when editing
    createEffect(on(
        () => rolePermsQuery.data,
        (perms) => {
            if (isEdit() && perms) {
                setSelectedPermSlugs(perms.map(p => p.slug as PermissionSlug));
            }
        }
    ));

    // Reset when dialog opens in create mode
    createEffect(on(
        () => props.isOpen,
        (open) => {
            if (open && !isEdit()) {
                setSelectedPermSlugs([]);
                setCopyingFromId('');
                setHasAttemptedSubmit(false);
                form.reset({ name: '', description: '' });
            }
        }
    ));

    // ── Derived UI state ─────────────────────────────────────────────────────
    const selectedSet = createMemo(() => new Set(selectedPermSlugs()));
    const isPending = () =>
        createMutation.isPending || updateRoleMutation.isPending || updatePermsMutation.isPending;

    const title = () => {
        if (resolvedMode() === 'create') return 'Nuevo Rol';
        if (isPermissionsOnly()) return 'Permisos del Rol';
        return isSystem() ? 'Configurar Rol del Sistema' : 'Editar Rol';
    };

    const subtitle = () => {
        if (isEdit() && roleData()) return roleData()!.description ?? undefined;
        return 'Define el nombre, propósito y permisos exactos de acceso.';
    };

    const submitLabel = () => {
        if (resolvedMode() === 'create') return 'Crear Rol';
        if (isPermissionsOnly()) return 'Guardar Permisos';
        return 'Guardar Cambios';
    };

    const isReady = () => !isEdit() || (Boolean(roleQuery.data) && !rolePermsQuery.isPending && !allPermsQuery.isPending);

    const templateRoles = createMemo(() =>
        (rolesQuery.data ?? []).filter(r => r.name !== SYSTEM_ROLES.SUPERADMIN)
    );

    // ── Handlers ─────────────────────────────────────────────────────────────
    const isBlockedSlug = (slug: string) => {
        const action = slug.split('.')[1] ?? '';
        return (blockedActions() as readonly string[]).includes(action);
    };

    const handleToggle = (slug: string) => {
        if (isReadOnly() || isBlockedSlug(slug)) return;
        const target = allPermsQuery.data?.all?.find(p => p.slug === slug);
        if (target && target.planAllowed === false) return;
        const permSlug = slug as PermissionSlug;
        setSelectedPermSlugs(prev =>
            prev.includes(permSlug) ? prev.filter(s => s !== permSlug) : [...prev, permSlug]
        );
    };

    const handleModuleToggle = (prefix: string, selected: boolean) => {
        if (isReadOnly()) return;
        const perms = allPermsQuery.data?.all ?? [];
        const moduleSlugs = perms
            .filter(p => p.slug.startsWith(prefix + '.') && p.planAllowed !== false && !isBlockedSlug(p.slug))
            .map(p => p.slug as PermissionSlug);
        setSelectedPermSlugs(prev => {
            const set = new Set(prev);
            moduleSlugs.forEach(slug => (selected ? set.add(slug) : set.delete(slug)));
            return Array.from(set);
        });
    };

    const handleBulkSelect = (slugs: string[]) => {
        if (isReadOnly()) return;
        setSelectedPermSlugs(slugs.filter(s => !isBlockedSlug(s)) as PermissionSlug[]);
    };

    const handleCopyFromRole = async (sourceRoleIdStr: string) => {
        setCopyingFromId(sourceRoleIdStr);
        const sourceId = Number(sourceRoleIdStr);
        if (!sourceId || Number.isNaN(sourceId)) return;

        setIsCopyingTemplate(true);
        try {
            const perms = await usersApi.getRolePermissions(sourceId);
            const allowedSet = new Set(
                (allPermsQuery.data?.all ?? [])
                    .filter(p => p.planAllowed !== false)
                    .map(p => p.slug)
            );
            const slugs = perms
                .map(p => p.slug as PermissionSlug)
                .filter(slug => allowedSet.size === 0 || allowedSet.has(slug));
            setSelectedPermSlugs(slugs);
            const sourceRole = rolesQuery.data?.find(r => r.id === sourceId);
            toast.success(`Se copiaron ${slugs.length} permisos desde "${getRoleDisplayLabel(sourceRole?.name ?? '')}"`);
        } catch (err: any) {
            toast.error(err?.message || 'No se pudieron cargar los permisos del rol seleccionado');
        } finally {
            setIsCopyingTemplate(false);
        }
    };

    const handleSubmit = (e: Event) => {
        e.preventDefault();
        if (isReadOnly()) return;
        setHasAttemptedSubmit(true);
        form.handleSubmit();
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
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
                                    {selectedPermSlugs().length}/{allPermsQuery.data?.all?.filter(p => p.planAllowed !== false).length ?? 0}
                                </span>
                            </Show>
                        </div>
                    </Show>
                }
                onSubmit={handleSubmit}
                submitLabel={submitLabel()}
                isLoading={isPending()}
                maxWidth="xl"
                hideFooter={isReadOnly()}
            >
                <Show
                    when={isReady()}
                    fallback={
                        <div class="space-y-4">
                            <div class="h-10 bg-surface rounded-xl animate-pulse" />
                            <div class="h-10 bg-surface rounded-xl animate-pulse" />
                            <div class="h-40 bg-surface rounded-xl animate-pulse" />
                        </div>
                    }
                >
                    {/* System role status banners */}
                    <Show when={isSuperadminRole()}>
                        <div class="flex items-center gap-2.5 text-xs text-warning bg-warning/10 border border-warning/20 rounded-xl px-4 py-3">
                            <ShieldIcon class="size-4 shrink-0" />
                            <span>
                                El rol <strong>Super Administrador</strong> es el propietario de la empresa y es estrictamente inmutable.
                            </span>
                        </div>
                    </Show>

                    <Show when={isSystem() && !isSuperadminRole() && !isCallerSuperadmin()}>
                        <div class="flex items-center gap-2.5 text-xs text-warning bg-warning/10 border border-warning/20 rounded-xl px-4 py-3">
                            <ShieldIcon class="size-4 shrink-0" />
                            <span>
                                Este es un rol protegido del sistema. Solo el <strong>Super Administrador</strong> puede modificar sus permisos.
                            </span>
                        </div>
                    </Show>

                    <Show when={isSystem() && !isSuperadminRole() && isCallerSuperadmin()}>
                        <div class="flex items-center gap-2.5 text-xs text-info bg-info/10 border border-info/20 rounded-xl px-4 py-3">
                            <ShieldIcon class="size-4 shrink-0" />
                            <span>
                                Rol protegido del sistema: su identificador está bloqueado, pero como <strong>Super Administrador</strong> puedes ajustar sus permisos
                                {isAccountantRole() ? ' (las acciones destructivas permanecen deshabilitadas para Contador).' : '.'}
                            </span>
                        </div>
                    </Show>

                    {/* Name + Description — hidden in permissions-only mode */}
                    <Show when={!isPermissionsOnly()}>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <form.Field name="name">
                                {(field) => (
                                    <TextField.Root
                                        field={field}
                                        disabled={isPending() || isReadOnly() || isNameLocked()}
                                    >
                                        <TextField.Label>Nombre del rol *</TextField.Label>
                                        <TextField.Input
                                            name="name"
                                            placeholder="ej. supervisor_caja, bodeguero"
                                            required
                                        />
                                        <TextField.ErrorMessage />
                                    </TextField.Root>
                                )}
                            </form.Field>

                            <form.Field name="description">
                                {(field) => (
                                    <TextField.Root
                                        field={field}
                                        disabled={isPending() || isReadOnly()}
                                    >
                                        <TextField.Label>Descripción</TextField.Label>
                                        <TextField.Input
                                            name="description"
                                            placeholder="Describe las responsabilidades de este rol"
                                        />
                                        <TextField.ErrorMessage />
                                    </TextField.Root>
                                )}
                            </form.Field>
                        </div>
                    </Show>

                    {/* Copy permissions template selector (create mode only) */}
                    <Show when={!isEdit() && templateRoles().length > 0}>
                        <div class="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl border border-border/70 bg-surface/30">
                            <div class="flex items-center gap-2 text-xs text-muted shrink-0">
                                <CopyIcon class="size-4 text-primary" />
                                <span class="font-medium text-text">Partir de una plantilla:</span>
                            </div>
                            <select
                                value={copyingFromId()}
                                disabled={isCopyingTemplate() || isPending()}
                                onChange={(e) => handleCopyFromRole(e.currentTarget.value)}
                                class="flex-1 h-8 px-2.5 text-xs rounded-lg border border-border bg-card text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                                <option value="">Empezar en blanco...</option>
                                <For each={templateRoles()}>
                                    {(role) => (
                                        <option value={String(role.id)}>
                                            Copiar permisos de {getRoleDisplayLabel(role.name)} ({role.permissionCount ?? 0} permisos)
                                        </option>
                                    )}
                                </For>
                            </select>
                        </div>
                    </Show>

                    {/* Permissions Matrix */}
                    <div class="space-y-2">
                        <Show when={!isPermissionsOnly()}>
                            <FieldLabel>Permisos del rol</FieldLabel>
                        </Show>
                        <PermissionMatrix
                            allPermissions={allPermsQuery.data?.all ?? []}
                            selectedSlugs={selectedSet()}
                            onToggle={handleToggle}
                            onModuleToggle={handleModuleToggle}
                            onBulkSelect={handleBulkSelect}
                            disabled={isReadOnly() || isPending()}
                            blockedActions={blockedActions()}
                            blockedActionsReason="El rol Contador no permite acciones destructivas (.delete / .destroy)"
                        />
                    </div>
                </Show>
            </FormDialog>
        </FormSubmissionContext.Provider>
    );
};

export default RoleFormDialog;
