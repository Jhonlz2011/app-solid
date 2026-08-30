import { Component, createSignal, Show, createMemo } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { UserCreateSchema, type UserCreateData } from '@app/schema/frontend';
import type { RoleType } from '@app/schema/dto';
import { TextField } from '@form/TextField';
import { EntitySelect } from '@shared/ui/selectors';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { handleFormApiErrors } from '@shared/utils/form.utils';
import { UserRolePicker } from './shared/UserRolePicker';
import { useCheckUserEmail } from '../data/users.queries';

export interface UserCreateFormProps {
    formId?: string;
    roles: RoleType[];
    rolesLoading?: boolean;
    initialEntity?: { id: string; businessName: string; taxId: string } | null;
    onSubmit: (values: UserCreateData) => void | Promise<void>;
    isSubmitting?: boolean;
}

export const UserCreateForm: Component<UserCreateFormProps> = (props) => {
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);
    const [onboardingMode, setOnboardingMode] = createSignal<'invite' | 'direct'>('invite');

    const form = createForm(() => ({
        defaultValues: {
            username: '',
            email: '',
            password: '',
            roleIds: [] as number[],
            entityId: null as string | null,
        } as UserCreateData,
        validators: {
            onChange: UserCreateSchema,
            onSubmit: UserCreateSchema,
        },
        onSubmit: async ({ value }) => {
            try {
                // If invite mode or existing user, clean up direct password so backend handles it cleanly
                const isExisting = isExistingUser();
                const payload: UserCreateData = {
                    ...value,
                    password: (!isExisting && onboardingMode() === 'direct') ? value.password : undefined,
                    username: (!isExisting && onboardingMode() === 'direct') ? value.username : undefined,
                };
                await props.onSubmit(payload);
            } catch (err) {
                handleFormApiErrors(form, err, 'Error al crear el usuario', props.formId ?? 'user-create-form');
            }
        },
    }));

    const emailValue = form.useStore((s) => s.values.email);
    const selectedRoleIds = form.useStore((s) => s.values.roleIds);

    // Live email check query
    const checkQuery = useCheckUserEmail(() => emailValue());

    const isAlreadyMember = createMemo(() => Boolean(checkQuery.data?.isAlreadyMember));
    const isExistingUser = createMemo(() => Boolean(checkQuery.data?.exists && !checkQuery.data?.isAlreadyMember));

    return (
        <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
            <form
                id={props.formId ?? 'user-create-form'}
                onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setHasAttemptedSubmit(true);
                    if (isAlreadyMember()) return;
                    form.handleSubmit();
                }}
                class="flex flex-col gap-6 py-4"
            >
                {/* ═══ 1. User Identity & Live Detection ═══ */}
                <div class="space-y-4">
                    <div class="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                        <div class="size-1.5 rounded-full bg-primary" />
                        Identidad y Acceso
                    </div>

                    <form.Field name="email">
                        {(field) => (
                            <TextField.Root field={field()} disabled={props.isSubmitting}>
                                <TextField.Label>Correo electrónico *</TextField.Label>
                                <TextField.Input type="email" placeholder="ej. colaborador@empresa.com" autocomplete="email" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>

                    {/* ── Live Feedback Banners ── */}
                    <Show when={checkQuery.isFetching}>
                        <div class="p-3 bg-surface/60 rounded-xl border border-border/40 flex items-center gap-2.5 text-xs text-muted animate-pulse">
                            <div class="size-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <span>Verificando correo en Zelys...</span>
                        </div>
                    </Show>

                    <Show when={!checkQuery.isFetching && isAlreadyMember()}>
                        <div class="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
                            <span class="text-base shrink-0">⚠️</span>
                            <div class="space-y-0.5">
                                <p class="text-xs font-semibold text-amber-600 dark:text-amber-400">Usuario ya registrado en esta empresa</p>
                                <p class="text-xs text-muted">
                                    Este correo ya es miembro de tu equipo. Si deseas modificar sus roles o ficha, hazlo desde la edición de usuarios.
                                </p>
                            </div>
                        </div>
                    </Show>

                    <Show when={!checkQuery.isFetching && isExistingUser()}>
                        <div class="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-3">
                            <span class="text-base shrink-0">✨</span>
                            <div class="space-y-0.5">
                                <div class="flex items-center gap-2">
                                    <p class="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Usuario de Zelys detectado</p>
                                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-mono font-bold">
                                        @{checkQuery.data?.username}
                                    </span>
                                </div>
                                <p class="text-xs text-muted">
                                    Este usuario ya tiene cuenta en la plataforma. Se le otorgará acceso a esta empresa con los roles seleccionados y se le enviará una invitación por correo.
                                </p>
                            </div>
                        </div>
                    </Show>

                    {/* ── Mode selector for brand new users ── */}
                    <Show when={!isExistingUser() && !isAlreadyMember()}>
                        <div class="space-y-3 pt-1">
                            <div class="text-[11px] font-semibold text-muted uppercase tracking-wider">
                                Método de Incorporación
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setOnboardingMode('invite')}
                                    class={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
                                        onboardingMode() === 'invite'
                                            ? 'bg-primary/10 border-primary shadow-xs'
                                            : 'bg-surface/50 border-border/60 hover:bg-surface'
                                    }`}
                                >
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2">
                                            <span class="text-base">✉️</span>
                                            <span class="text-xs font-semibold text-heading">Invitación por Correo</span>
                                        </div>
                                        <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                                            Recomendado
                                        </span>
                                    </div>
                                    <p class="text-[11px] text-muted">
                                        Acceso 1-Click con Google / Microsoft o configuración de clave por el usuario.
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setOnboardingMode('direct')}
                                    class={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
                                        onboardingMode() === 'direct'
                                            ? 'bg-primary/10 border-primary shadow-xs'
                                            : 'bg-surface/50 border-border/60 hover:bg-surface'
                                    }`}
                                >
                                    <div class="flex items-center gap-2">
                                        <span class="text-base">🔑</span>
                                        <span class="text-xs font-semibold text-heading">Credenciales Directas</span>
                                    </div>
                                    <p class="text-[11px] text-muted">
                                        Asigna usuario y contraseña inicial manualmente (para personal de Caja / POS).
                                    </p>
                                </button>
                            </div>

                            {/* ── Direct credential fields (only when direct mode selected) ── */}
                            <Show when={onboardingMode() === 'direct'}>
                                <div class="p-4 bg-surface/40 rounded-xl border border-border/60 space-y-4 mt-2">
                                    <form.Field name="username">
                                        {(field) => (
                                            <TextField.Root field={field()} disabled={props.isSubmitting}>
                                                <TextField.Label>Nombre de usuario (Opcional)</TextField.Label>
                                                <TextField.Input placeholder="Se generará del correo si se deja vacío" autocomplete="username" />
                                                <TextField.ErrorMessage />
                                            </TextField.Root>
                                        )}
                                    </form.Field>

                                    <form.Field name="password">
                                        {(field) => (
                                            <TextField.Root field={field()} disabled={props.isSubmitting}>
                                                <TextField.Label>Contraseña inicial *</TextField.Label>
                                                <TextField.PasswordInput placeholder="Mínimo 8 caracteres" autocomplete="new-password" />
                                                <TextField.ErrorMessage />
                                            </TextField.Root>
                                        )}
                                    </form.Field>
                                </div>
                            </Show>
                        </div>
                    </Show>
                </div>

                {/* ═══ 2. Entity picker (Employee link) ═══ */}
                <form.Field name="entityId">
                    {(field) => (
                        <EntitySelect
                            value={field().state.value}
                            onChange={(id) => field().handleChange(id)}
                            label="Persona vinculada (Empleado)"
                            placeholder="Buscar empleado por nombre o identificación..."
                            isEmployee={true}
                            disabled={props.isSubmitting || isAlreadyMember()}
                            field={field()}
                            initialEntity={props.initialEntity}
                        />
                    )}
                </form.Field>

                {/* ═══ 3. Role selection ═══ */}
                <UserRolePicker
                    roles={props.roles}
                    rolesLoading={props.rolesLoading}
                    selectedRoleIds={selectedRoleIds() ?? []}
                    onChange={(ids) => form.setFieldValue('roleIds', ids)}
                    disabled={props.isSubmitting || isAlreadyMember()}
                />
            </form>
        </FormSubmissionContext.Provider>
    );
};

export default UserCreateForm;
