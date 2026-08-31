import { Component, createSignal, Show, createMemo, createEffect } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { safeParse } from 'valibot';
import { UserCreateSchema, type UserCreateData } from '@app/schema/frontend';
import type { RoleType } from '@app/schema/dto';
import { TextField, FieldLabel } from '@form/TextField';
import { CardOption } from '@form/CardOption';
import { EntitySelect } from '@shared/ui/selectors';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { handleFormApiErrors } from '@shared/utils/form.utils';
import { MailIcon } from '@icons/MailIcon';
import { KeyIcon } from '@icons/KeyIcon';
import { SparklesIcon } from '@icons/SparklesIcon';
import { AlertTriangleIcon } from '@icons/AlertTriangleIcon';
import { UserRolePicker } from './shared/UserRolePicker';
import { useCheckUserEmail } from '../data/users.queries';

export type UserOnboardingMode = 'invite' | 'direct';

export interface UserCreateFormState {
    mode: UserOnboardingMode;
    isExistingUser: boolean;
    isAlreadyMember: boolean;
    canSubmit: boolean;
}

export interface UserCreateFormProps {
    formId?: string;
    roles: RoleType[];
    rolesLoading?: boolean;
    initialEntity?: { id: string; businessName: string; taxId: string } | null;
    onSubmit: (values: UserCreateData) => void | Promise<void>;
    isSubmitting?: boolean;
    onStateChange?: (state: UserCreateFormState) => void;
}

export const UserCreateForm: Component<UserCreateFormProps> = (props) => {
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);
    const [onboardingMode, setOnboardingMode] = createSignal<UserOnboardingMode>('invite');

    const form = createForm(() => ({
        defaultValues: {
            username: undefined as string | undefined,
            email: '',
            password: undefined as string | undefined,
            roleIds: [] as number[],
            entityId: null as string | null,
        } as UserCreateData,
        validators: {
            onSubmit: ({ value }) => {
                if (!value.roleIds || value.roleIds.length === 0) {
                    return 'Debes asignar al menos un rol al usuario';
                }
                const parseRes = safeParse(UserCreateSchema, value);
                if (!parseRes.success) {
                    return parseRes.issues[0]?.message || 'Datos del formulario inválidos';
                }
                if (onboardingMode() === 'direct' && !isExistingUser()) {
                    if (!value.password || value.password.trim().length < 8) {
                        return 'La contraseña es obligatoria (mínimo 8 caracteres) en credenciales directas';
                    }
                }
                return undefined;
            },
        },
        onSubmit: async ({ value }) => {
            try {
                // If invite mode or existing user, clean up direct password so backend handles it cleanly
                const isExisting = isExistingUser();
                const isDirect = !isExisting && onboardingMode() === 'direct';
                const payload: UserCreateData = {
                    ...value,
                    mode: isExisting ? 'invite' : onboardingMode(),
                    password: isDirect && value.password?.trim() ? value.password.trim() : undefined,
                    username: isDirect && value.username?.trim() ? value.username.trim() : undefined,
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

    createEffect(() => {
        props.onStateChange?.({
            mode: onboardingMode(),
            isExistingUser: isExistingUser(),
            isAlreadyMember: isAlreadyMember(),
            canSubmit: !isAlreadyMember(),
        });
    });

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
                class="flex flex-col gap-4 py-4"
            >
                {/* ═══ 1. User Identity & Live Detection ═══ */}
                <div class="space-y-4">
                    <form.Field name="email">
                        {(field) => (
                            <TextField.Root field={field()} disabled={props.isSubmitting}>
                                <div class="flex items-center justify-between gap-2">
                                    <TextField.Label>Correo electrónico *</TextField.Label>
                                    {/* Non-intrusive live user detection */}
                                    <Show when={!checkQuery.isFetching && isExistingUser()}>
                                        <span class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0 rounded-full border border-emerald-500/20 animate-in fade-in">
                                            <SparklesIcon class="size-3" />
                                            Usuario (@{checkQuery.data?.username})
                                        </span>
                                    </Show>

                                    <Show when={!checkQuery.isFetching && isAlreadyMember()}>
                                        <span class="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-500/10 px-2 py-0 rounded-full border border-amber-500/20 animate-in fade-in">
                                            <AlertTriangleIcon class="size-3" />
                                            Ya es miembro en esta empresa
                                        </span>
                                    </Show>
                                </div>

                                <TextField.Input
                                    type="email"
                                    placeholder="ej. colaborador@empresa.com"
                                    autocomplete="email"
                                    loading={checkQuery.isFetching}
                                />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>
                </div>

                 {/* ── Mode selector for brand new users ── */}
                    <Show when={!isExistingUser() && !isAlreadyMember()}>
                        <div class="space-y-1">
                            <FieldLabel class='ml-1' tooltip="Selecciona cómo accederá el nuevo usuario a tu organización">
                                Método de Incorporación
                            </FieldLabel>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <CardOption
                                    size="sm"
                                    isSelected={onboardingMode() === 'invite'}
                                    onSelect={() => setOnboardingMode('invite')}
                                    icon={<MailIcon class="size-4" />}
                                    title="Invitación por Correo"
                                    description="Acceso 1-Click con Google / Microsoft o clave personal."
                                    variant="primary"
                                    disabled={props.isSubmitting}
                                />

                                <CardOption
                                    size="sm"
                                    isSelected={onboardingMode() === 'direct'}
                                    onSelect={() => setOnboardingMode('direct')}
                                    icon={<KeyIcon class="size-4" />}
                                    title="Credenciales Directas"
                                    description="Asigna usuario y contraseña inicial manualmente."
                                    variant="primary"
                                    disabled={props.isSubmitting}
                                />
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

                                    <form.Field
                                        name="password"
                                        validators={{
                                            onChange: ({ value }) => {
                                                if (onboardingMode() === 'direct' && !isExistingUser()) {
                                                    if (!value || value.trim().length < 8) {
                                                        return 'La contraseña es requerida y debe tener al menos 8 caracteres';
                                                    }
                                                }
                                                return undefined;
                                            },
                                        }}
                                    >
                                        {(field) => (
                                            <TextField.Root field={field()} disabled={props.isSubmitting}>
                                                <TextField.Label>Contraseña *</TextField.Label>
                                                <TextField.PasswordInput placeholder="Mínimo 8 caracteres" autocomplete="new-password" />
                                                <TextField.ErrorMessage />
                                            </TextField.Root>
                                        )}
                                    </form.Field>
                                </div>
                            </Show>
                        </div>
                    </Show>

                {/* ═══ 2. Entity picker (Employee link) ═══ */}
                <form.Field name="entityId">
                    {(field) => (
                        <EntitySelect
                            value={field().state.value}
                            onChange={(id) => field().handleChange(id)}
                            label="Persona vinculada"
                            tooltip="Asocia la cuenta de usuario a una ficha de empleado existente"
                            placeholder="Buscar empleado por nombre o identificación..."
                            isEmployee={true}
                            disabled={props.isSubmitting || isAlreadyMember()}
                            field={field()}
                            initialEntity={props.initialEntity}
                        />
                    )}
                </form.Field>

                {/* ═══ 3. Role selection ═══ */}
                <form.Field
                    name="roleIds"
                    validators={{
                        onChange: ({ value }) => (!value || value.length === 0) ? 'Debes asignar al menos un rol al usuario' : undefined,
                        onBlur: ({ value }) => (!value || value.length === 0) ? 'Debes asignar al menos un rol al usuario' : undefined,
                    }}
                >
                    {(field) => {
                        const hasError = () => (field().state.meta.isTouched || hasAttemptedSubmit()) && (!field().state.value || field().state.value.length === 0);
                        const errorMsg = () => field().state.meta.errors[0] || 'Debes asignar al menos un rol al usuario';
                        return (
                            <div class="space-y-1">
                                <UserRolePicker
                                    roles={props.roles}
                                    rolesLoading={props.rolesLoading}
                                    selectedRoleIds={field().state.value ?? []}
                                    onChange={(ids) => {
                                        field().handleChange(ids);
                                        field().handleBlur();
                                    }}
                                    disabled={props.isSubmitting || isAlreadyMember()}
                                />
                                <Show when={hasError()}>
                                    <p class="text-xs text-danger font-medium mt-1 animate-in fade-in duration-150" role="alert">
                                        {String(errorMsg())}
                                    </p>
                                </Show>
                            </div>
                        );
                    }}
                </form.Field>
            </form>
        </FormSubmissionContext.Provider>
    );
};

export default UserCreateForm;
