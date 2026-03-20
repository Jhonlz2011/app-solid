import { Component, For, Show, createSignal, createMemo } from 'solid-js';
import type { Role } from '../models/users.types';
import { TextField } from '@shared/ui/TextField';
import { Autocomplete } from '@shared/ui/Autocomplete';
import Checkbox from '@shared/ui/Checkbox';
import Switch from '@shared/ui/Switch';
import Button from '@shared/ui/Button';
import { RoleBadge } from '@shared/ui/Badge';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import { CloseIcon, EyeIcon, EyeOffIcon, CopyIcon, KeyIcon } from '@shared/ui/icons';
import { toast } from 'solid-sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EntityOption {
    id: number;
    businessName: string;
    taxId: string;
}

interface UserFormProps {
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
    onSubmit: (values: {
        username: string;
        email: string;
        password?: string;
        newPassword?: string;
        isActive?: boolean;
        roleIds: number[];
        entityId?: number | null;
    }) => void | Promise<void>;
    isSubmitting?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const generatePassword = (length = 16): string => {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

// ─── Component ───────────────────────────────────────────────────────────────

const UserForm: Component<UserFormProps> = (props) => {
    const [isActive, setIsActive] = createSignal(props.defaultValues?.isActive ?? true);
    const [selectedRoleIds, setSelectedRoleIds] = createSignal(
        new Set(props.defaultValues?.roleIds ?? [])
    );

    // Entity selection
    const [selectedEntityId, setSelectedEntityId] = createSignal<number | null>(
        props.defaultValues?.entityId ?? null
    );
    const [entitySearchText, setEntitySearchText] = createSignal('');

    const selectedEntity = createMemo(() =>
        props.entities?.find(e => e.id === selectedEntityId()) ?? null
    );

    // Password change section
    const [showPwSection, setShowPwSection] = createSignal(false);
    const [newPassword, setNewPassword] = createSignal('');
    const [showNewPw, setShowNewPw] = createSignal(false);

    const handleGeneratePassword = () => {
        const pw = generatePassword();
        setNewPassword(pw);
        setShowNewPw(true);
    };

    const handleCopyPassword = () => {
        navigator.clipboard.writeText(newPassword());
        toast.success('Contraseña copiada al portapapeles');
    };

    const toggleRole = (roleId: number) => {
        setSelectedRoleIds(prev => {
            const next = new Set(prev);
            if (next.has(roleId)) { next.delete(roleId); } else { next.add(roleId); }
            return next;
        });
    };

    const handleSubmit = (e: Event) => {
        e.preventDefault();
        const form = e.currentTarget as HTMLFormElement;
        const data = new FormData(form);

        props.onSubmit({
            username: data.get('username') as string,
            email: data.get('email') as string,
            password: props.showPassword ? (data.get('password') as string) : undefined,
            newPassword: props.showPasswordChange && newPassword().length >= 8 ? newPassword() : undefined,
            isActive: props.showIsActive ? isActive() : undefined,
            roleIds: Array.from(selectedRoleIds()),
            entityId: props.showEntityPicker ? selectedEntityId() : undefined,
        });
    };

    return (
        <form id={props.formId ?? 'user-form'} onSubmit={handleSubmit} class="flex flex-col gap-6 py-4">
            {/* ═══ Basic info ═══ */}
            <div class="space-y-4">
                <div class="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                    <div class="size-1.5 rounded-full bg-primary" />
                    Información de acceso
                </div>
                <TextField.Root defaultValue={props.defaultValues?.username} disabled={props.isSubmitting}>
                    <TextField.Label>Nombre de usuario</TextField.Label>
                    <TextField.Input name="username" placeholder="ej. juan.perez" required autocomplete="username" />
                </TextField.Root>
                <TextField.Root defaultValue={props.defaultValues?.email} disabled={props.isSubmitting}>
                    <TextField.Label>Correo electrónico</TextField.Label>
                    <TextField.Input name="email" type="email" placeholder="ej. juan@empresa.com" required autocomplete="email" />
                </TextField.Root>
                <Show when={props.showPassword}>
                    <TextField.Root disabled={props.isSubmitting}>
                        <TextField.Label>Contraseña</TextField.Label>
                        <TextField.Input name="password" type="password" placeholder="Mínimo 8 caracteres" required autocomplete="new-password" minLength={8} />
                    </TextField.Root>
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
                        checked={isActive()}
                        onChange={setIsActive}
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
                                        setSelectedEntityId(null);
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
                            <Autocomplete<EntityOption>
                                value={entitySearchText()}
                                onInputChange={setEntitySearchText}
                                options={props.entities ?? []}
                                optionValue={(e) => String(e.id)}
                                optionLabel={(e) => e.businessName}
                                optionDescription={(e) => e.taxId}
                                onSelect={(entity) => {
                                    if (entity) {
                                        setSelectedEntityId(entity.id);
                                        setEntitySearchText(entity.businessName);
                                    }
                                }}
                                placeholder="Buscar por nombre o RUC/cédula..."
                                disabled={props.isSubmitting}
                                minLength={1}
                            />
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
                                    <input
                                        type={showNewPw() ? 'text' : 'password'}
                                        value={newPassword()}
                                        onInput={(e) => setNewPassword(e.currentTarget.value)}
                                        placeholder="Nueva contraseña (mín. 8)"
                                        class="w-full px-3 py-2.5 text-sm font-mono bg-card border border-border/60 rounded-xl text-text placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 pr-9 transition-all"
                                        disabled={props.isSubmitting}
                                        minLength={8}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPw(v => !v)}
                                        class="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted hover:text-text transition-colors cursor-pointer"
                                    >
                                        <Show when={showNewPw()} fallback={<EyeIcon class="size-4" />}>
                                            <EyeOffIcon class="size-4" />
                                        </Show>
                                    </button>
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
                            <div class="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPwSection(false);
                                        setNewPassword('');
                                        setShowNewPw(false);
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
                                    const isChecked = () => selectedRoleIds().has(role.id);
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
    );
};

export default UserForm;
