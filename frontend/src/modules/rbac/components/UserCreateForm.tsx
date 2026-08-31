import { Component, createSignal, Show, createMemo, createEffect } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { UserCreateSchema, type UserCreateData } from '@app/schema/frontend';
import type { RoleType } from '@app/schema/dto';
import { TextField, FieldLabel } from '@form/TextField';
import { CardOption } from '@form/CardOption';
import { FormSectionHeader } from '@form/FormSectionHeader';
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
            onChange: UserCreateSchema,
            onSubmit: UserCreateSchema,
        },
        onSubmit: async ({ value }) => {
            try {
                // If invite mode or existing user, clean up direct password so backend handles it cleanly
                const isExisting = isExistingUser();
                const isDirect = !isExisting && onboardingMode() === 'direct';
                const payload: UserCreateData = {
                    ...value,
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
                    <FormSectionHeader title="Información de acceso" color="primary" />

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

                    {/* ── Mode selector for brand new users ── */}
                    <Show when={!isExistingUser() && !isAlreadyMember()}>
                        <div class="space-y-2 pt-1">
                            <FieldLabel class="mb-1.5" tooltip="Selecciona cómo accederá el nuevo usuario a tu organización">
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

                                    <form.Field name="password">
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
                </div>

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
