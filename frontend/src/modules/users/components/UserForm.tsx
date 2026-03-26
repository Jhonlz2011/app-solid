import { Component, For, Show, createSignal, createMemo } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { UserFormSchema, type UserFormData } from '@app/schema/frontend';
import type { Role } from '../models/users.types';
import { TextField } from '@shared/ui/TextField';
import { Autocomplete } from '@shared/ui/Autocomplete';
import Checkbox from '@shared/ui/Checkbox';
import Switch from '@shared/ui/Switch';
import Button from '@shared/ui/Button';
import { RoleBadge } from '@shared/ui/Badge';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import { CloseIcon, EyeIcon, EyeOffIcon, CopyIcon, KeyIcon } from '@shared/ui/icons';
import { copyToClipboard } from '@shared/utils/clipboard';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { toast } from 'solid-sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EntityOption {
    id: number;
    businessName: string;
    taxId: string;
}

export interface UserFormProps {
    defaultValues?: {
        username?: string;
        email?: string;
        isActive?: boolean;
        roleIds?: number[];
        entityId?: number | null;
    };
    formId?: string;
    roles: Role[];
    rolesLoading?: boolean;
    /** Show password field (new user creation) */
    showPassword?: boolean;
    /** Show collapsible password change section (edit mode) */
    showPasswordChange?: boolean;
    showIsActive?: boolean;
    showEntityPicker?: boolean;
    entities?: EntityOption[];
    entitiesLoading?: boolean;
    onSubmit: (values: UserFormData & { newPassword?: string }) => void | Promise<void>;
    isSubmitting?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const generatePassword = (length = 16): string => {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

// ─── Component ───────────────────────────────────────────────────────────────

const UserForm: Component<UserFormProps> = (props) => {
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    // Entity selection (managed outside TanStack Form since it uses Autocomplete)
    const [entitySearchText, setEntitySearchText] = createSignal('');

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

    const form = createForm(() => ({
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
            onChange: UserFormSchema,
            onSubmit: UserFormSchema,
        },
        onSubmit: async ({ value }) => {
            // In create mode, password is required
            if (props.showPassword && (!value.password || value.password.length < 8)) {
                form.setFieldMeta('password', (prev) => ({
                    ...prev,
                    errors: ['La contraseña debe tener al menos 8 caracteres'],
                    errorMap: { ...prev.errorMap, onSubmit: 'La contraseña debe tener al menos 8 caracteres' },
                }));
                return;
            }

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
    }));

    // ── Reactive selectors ───────────────────────────────────────────────────

    const isActive = form.useStore((s) => s.values.isActive);
    const selectedRoleIds = form.useStore((s) => s.values.roleIds);
    const selectedEntityId = form.useStore((s) => s.values.entityId);

    const selectedEntity = createMemo(() =>
        props.entities?.find(e => e.id === selectedEntityId()) ?? null
    );

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
                            <p class="text-xs text-muted">Un usuario inactivo no puede iniciar sesión</p>
                        </div>
                        <Switch
                            checked={isActive() ?? true}
                            onChange={(val) => form.setFieldValue('isActive', val)}
                            disabled={props.isSubmitting}
                        />
                    </div>
                </Show>

                {/* ═══ Entity picker (Autocomplete) ═══ */}
                <Show when={props.showEntityPicker}>
                    <div class="space-y-3">
                        <div class="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                            <div class="size-1.5 rounded-full bg-emerald-500" />
                            Persona vinculada
                        </div>

                        {/* Selected entity card */}
                        <Show when={selectedEntity()}>
                            {(entity) => (
                                <div class="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                    <div class="size-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                                        <span class="text-emerald-600 text-sm font-bold">
                                            {entity().businessName.charAt(0)}
                                        </span>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <p class="text-sm font-semibold text-text truncate">{entity().businessName}</p>
                                        <p class="text-xs text-muted">{entity().taxId}</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            form.setFieldValue('entityId', null);
                                            setEntitySearchText('');
                                        }}
                                        disabled={props.isSubmitting}
                                        class="text-muted hover:text-danger shrink-0"
                                        title="Desvincular persona"
                                    >
                                        <CloseIcon class="size-4" />
                                    </Button>
                                </div>
                            )}
                        </Show>

                        {/* Autocomplete picker */}
                        <Show when={!selectedEntity()}>
                            <Show
                                when={!props.entitiesLoading}
                                fallback={<SkeletonLoader type="text" count={1} />}
                            >
                                <Autocomplete.Root>
                                    <Autocomplete.Input<EntityOption>
                                        value={entitySearchText()}
                                        onInputChange={setEntitySearchText}
                                        options={props.entities ?? []}
                                        optionValue={(e) => String(e.id)}
                                        optionLabel={(e) => e.businessName}
                                        optionDescription={(e) => e.taxId}
                                        onSelect={(entity) => {
                                            if (entity) {
                                                form.setFieldValue('entityId', entity.id);
                                                setEntitySearchText(entity.businessName);
                                            }
                                        }}
                                        placeholder="Buscar por nombre o RUC/cédula..."
                                        disabled={props.isSubmitting}
                                        minLength={1}
                                    />
                                </Autocomplete.Root>
                            </Show>
                        </Show>
                    </div>
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
                            when={props.roles.length > 0}
                            fallback={<p class="text-sm text-muted">No hay roles disponibles</p>}
                        >
                            <div class="space-y-2">
                                <For each={props.roles}>
                                    {(role) => {
                                        const isChecked = () => selectedRoleIds()?.includes(role.id) ?? false;
                                        return (
                                            <label class="flex items-center gap-3 p-3 rounded-xl hover:bg-surface/50 cursor-pointer transition-colors border border-transparent hover:border-border/40 group">
                                                <Checkbox
                                                    name="roleIds"
                                                    value={String(role.id)}
                                                    checked={isChecked()}
                                                    onChange={() => toggleRole(role.id)}
                                                    disabled={props.isSubmitting}
                                                />
                                                <div class="flex-1 min-w-0">
                                                    <div class="flex items-center gap-2">
                                                        <RoleBadge name={role.name} />
                                                        <Show when={role.is_system}>
                                                            <span class="text-[10px] text-muted bg-surface px-1.5 py-0.5 rounded border border-border/60">Sistema</span>
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
