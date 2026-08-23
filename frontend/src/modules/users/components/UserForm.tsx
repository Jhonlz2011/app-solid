import { Component, For, Show, createSignal, createMemo } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { UserFormSchema, UserCreateSchema, type UserFormData } from '@app/schema/frontend';
import type { RoleType } from '@app/schema/dto';
import { TextField } from '@form/TextField';
import { EntitySelect } from '@shared/ui/selectors';
import Checkbox from '@form/Checkbox';
import Switch from '@/shared/ui/form/Switch';
import Button from '@form/Button';
import { RoleBadge } from '@display/Badge';
import { SkeletonLoader } from '@display/SkeletonLoader';
import { CopyIcon } from '@icons/CopyIcon';
import { KeyIcon } from '@icons/KeyIcon';
import { copyToClipboard } from '@shared/utils/clipboard';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { toast } from 'solid-sonner';
import { generatePassword } from '@shared/utils/password.utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EntityOption {
    id: string;
    businessName: string;
    taxId: string;
}

export interface UserFormProps {
    defaultValues?: {
        username?: string;
        email?: string;
        isActive?: boolean;
        roleIds?: number[];
        entityId?: string | null;
    };
    formId?: string;
    roles: RoleType[];
    rolesLoading?: boolean;
    /** Show password field (new user creation) */
    showPassword?: boolean;
    /** Show collapsible password change section (edit mode) */
    showPasswordChange?: boolean;
    showIsActive?: boolean;
    showEntityPicker?: boolean;
    initialEntity?: { id: string; businessName: string; taxId: string } | null;
    entities?: EntityOption[];
    entitiesLoading?: boolean;
    onSubmit: (values: UserFormData & { newPassword?: string }) => void | Promise<void>;
    isSubmitting?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

const UserForm: Component<UserFormProps> = (props) => {
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    // Password change section (edit mode)
    const [showPwSection, setShowPwSection] = createSignal(false);
    const [newPassword, setNewPassword] = createSignal('');

    const handleGeneratePassword = () => {
        const pw = generatePassword();
        setNewPassword(pw);
    };

    const handleCopyPassword = async () => {
        const ok = await copyToClipboard(newPassword());
        if (ok) toast.success('Contraseña copiada al portapapeles');
        else toast.error('Error al copiar al portapapeles');
    };

    // ── Form ─────────────────────────────────────────────────────────────────
    const form = createForm(() => {
        const schema = props.showPassword ? UserCreateSchema : UserFormSchema;
        return {
            defaultValues: {
                username: props.defaultValues?.username ?? '',
                email: props.defaultValues?.email ?? '',
                password: '',
                isActive: props.defaultValues?.isActive ?? true,
                roleIds: props.defaultValues?.roleIds ?? [],
                entityId: props.defaultValues?.entityId ?? null,
            } as UserFormData,
            validatorAdapter: valibotValidator(),
            validators: {
                onChange: schema,
                onSubmit: schema,
            },
            onSubmit: async ({ value }) => {
                await props.onSubmit({
                    username: value.username,
                    email: value.email,
                    password: props.showPassword ? value.password : undefined,
                    newPassword: props.showPasswordChange && newPassword().length >= 8 ? newPassword() : undefined,
                    isActive: props.showIsActive ? value.isActive : undefined,
                    roleIds: value.roleIds,
                    entityId: props.showEntityPicker ? value.entityId : undefined,
                } as UserFormData & { newPassword?: string });
            },
        };
    });

    // ── Reactive selectors ───────────────────────────────────────────────────

    const isActive = form.useStore((s) => s.values.isActive);
    const selectedRoleIds = form.useStore((s) => s.values.roleIds);

    const isUserSuperadmin = createMemo(() => {
        const superRole = props.roles?.find(r => r.name === 'superadmin');
        return superRole ? (selectedRoleIds()?.includes(superRole.id) ?? false) : false;
    });

    const visibleRoles = createMemo(() => {
        return (props.roles ?? []).filter(r => r.name !== 'superadmin' || isUserSuperadmin());
    });

    // ── Role toggle ──────────────────────────────────────────────────────────

    const toggleRole = (roleId: number) => {
        const current = form.getFieldValue('roleIds');
        if (current.includes(roleId)) {
            form.setFieldValue('roleIds', current.filter(id => id !== roleId));
        } else {
            form.setFieldValue('roleIds', [...current, roleId]);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
            <form
                id={props.formId ?? 'user-form'}
                onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setHasAttemptedSubmit(true);
                    form.handleSubmit();
                }}
                class="flex flex-col gap-6 py-4"
            >
                {/* ═══ Basic info ═══ */}
                <div class="space-y-4">
                    <div class="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                        <div class="size-1.5 rounded-full bg-primary" />
                        Información de acceso
                    </div>

                    <form.Field name="username">
                        {(field) => (
                            <TextField.Root field={field()} disabled={props.isSubmitting}>
                                <TextField.Label>Nombre de usuario</TextField.Label>
                                <TextField.Input placeholder="ej. juan.perez" autocomplete="username" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>

                    <form.Field name="email">
                        {(field) => (
                            <TextField.Root field={field()} disabled={props.isSubmitting}>
                                <TextField.Label>Correo electrónico</TextField.Label>
                                <TextField.Input type="email" placeholder="ej. juan@empresa.com" autocomplete="email" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>

                    <Show when={props.showPassword}>
                        <form.Field name="password">
                            {(field) => (
                                <TextField.Root field={field()} disabled={props.isSubmitting}>
                                    <TextField.Label>Contraseña</TextField.Label>
                                    <TextField.PasswordInput placeholder="Mínimo 8 caracteres" autocomplete="new-password" />
                                    <TextField.ErrorMessage />
                                </TextField.Root>
                            )}
                        </form.Field>
                    </Show>
                </div>

                {/* ═══ isActive toggle (edit mode) ═══ */}
                <Show when={props.showIsActive}>
                    <div class="flex items-center justify-between p-4 bg-surface/40 rounded-xl border border-border/40">
                        <div class="space-y-0.5">
                            <p class="text-sm font-medium text-text">Estado de la cuenta</p>
                            <p class="text-xs text-muted">
                                {isUserSuperadmin()
                                    ? 'El propietario de la empresa no puede ser desactivado'
                                    : 'Un usuario inactivo no puede iniciar sesión'}
                            </p>
                        </div>
                        <Switch
                            checked={isUserSuperadmin() ? true : (isActive() ?? true)}
                            onChange={(val) => !isUserSuperadmin() && form.setFieldValue('isActive', val)}
                            disabled={props.isSubmitting || isUserSuperadmin()}
                        />
                    </div>
                </Show>

                {/* ═══ Entity picker (Standardized EntitySelect) ═══ */}
                <Show when={props.showEntityPicker}>
                    <form.Field name="entityId">
                        {(field) => (
                            <EntitySelect
                                value={field().state.value}
                                onChange={(id) => field().handleChange(id)}
                                label="Persona vinculada (Empleado)"
                                placeholder="Buscar empleado por nombre o identificación..."
                                isEmployee={true}
                                disabled={props.isSubmitting}
                                field={field()}
                                initialEntity={props.initialEntity}
                            />
                        )}
                    </form.Field>
                </Show>

                {/* ═══ Password change (edit mode) ═══ */}
                <Show when={props.showPasswordChange}>
                    <div class="space-y-3">
                        <div class="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                            <div class="size-1.5 rounded-full bg-amber-500" />
                            Cambiar contraseña
                        </div>

                        <Show
                            when={showPwSection()}
                            fallback={
                                <button
                                    type="button"
                                    onClick={() => setShowPwSection(true)}
                                    class="flex items-center gap-2 w-full p-3 rounded-xl bg-surface/40 border border-border/40 hover:bg-surface/60 hover:border-border transition-all text-left cursor-pointer group"
                                >
                                    <div class="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/15 transition-colors">
                                        <KeyIcon class="size-4 text-amber-600" />
                                    </div>
                                    <div>
                                        <p class="text-sm font-medium text-text">Restablecer contraseña</p>
                                        <p class="text-xs text-muted">Cerrará todas las sesiones del usuario</p>
                                    </div>
                                </button>
                            }
                        >
                            <div class="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                                <p class="text-xs text-muted leading-relaxed">
                                    La nueva contraseña cerrará <strong>todas</strong> las sesiones activas del usuario.
                                </p>
                                <div class="flex gap-2">
                                    <div class="flex-1 relative">
                                        <TextField.Root value={newPassword()} onChange={setNewPassword}>
                                            <TextField.PasswordInput
                                                placeholder="Nueva contraseña (mín. 8 caracteres)"
                                                class="w-full text-sm font-mono bg-card"
                                                disabled={props.isSubmitting}
                                                minLength={8}
                                            />
                                        </TextField.Root>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={handleGeneratePassword} title="Generar">
                                        Generar
                                    </Button>
                                    <Show when={newPassword()}>
                                        <Button variant="outline" size="sm" onClick={handleCopyPassword} title="Copiar">
                                            <CopyIcon class="size-4" />
                                        </Button>
                                    </Show>
                                </div>
                                <Show when={newPassword().length > 0 && newPassword().length < 8}>
                                    <p class="text-xs text-danger font-medium" role="alert">
                                        La contraseña debe tener al menos 8 caracteres
                                    </p>
                                </Show>
                                <div class="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowPwSection(false);
                                            setNewPassword('');
                                        }}
                                        class="text-xs text-muted hover:text-text transition-colors cursor-pointer"
                                    >
                                        Cancelar cambio
                                    </button>
                                </div>
                            </div>
                        </Show>
                    </div>
                </Show>

                {/* ═══ Role selection ═══ */}
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
                                        const isChecked = () => selectedRoleIds()?.includes(role.id) ?? false;
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
                                                    disabled={props.isSubmitting || isLocked()}
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
            </form>
        </FormSubmissionContext.Provider>
    );
};

export default UserForm;
