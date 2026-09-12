import { Component, createSignal, Show, createMemo, createEffect } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { UserCreateSchema, type UserCreateData } from '@app/schema/frontend';
import type { RoleType } from '@app/schema/dto';
import { TextField, FieldLabel } from '@form/TextField';
import { CardOption } from '@form/CardOption';
import { EntitySelect } from '@shared/ui/selectors';
import { FormSubmissionContext, hasFieldError, getFieldError } from '@shared/ui/form/form.types';
import { handleFormApiErrors } from '@shared/utils/form.utils';
import { MailIcon } from '@icons/MailIcon';
import { KeyIcon } from '@icons/KeyIcon';
import { SparklesIcon } from '@icons/SparklesIcon';
import { AlertTriangleIcon } from '@icons/AlertTriangleIcon';
import { UserRolePicker } from './shared/UserRolePicker';
import { useCheckUserEmail } from '../data/users.queries';
import { createUsernameAvailabilityValidator } from '@shared/ui/form/validators/availability.validators';
import { AvailabilityBadge } from '@shared/ui/form/AvailabilityBadge';
import { Badge } from '@display/Badge';

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
            mode: onboardingMode(),
        } as UserCreateData,
        validators: {
            onChange: UserCreateSchema,
            onSubmit: UserCreateSchema,
        },
        onSubmit: async ({ value }) => {
            try {
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

    // Live email check query
    const checkQuery = useCheckUserEmail(() => emailValue());

    const isAlreadyMember = createMemo(() => Boolean(checkQuery.data?.isAlreadyMember));
    const isExistingUser = createMemo(() => Boolean(checkQuery.data?.exists && !checkQuery.data?.isAlreadyMember));

    const validateDirectPassword = ({ value }: { value: string | undefined }) => {
        if (onboardingMode() === 'direct' && !isExistingUser()) {
            if (!value || value.trim().length < 8) {
                return 'La contraseña es obligatoria (mínimo 8 caracteres)';
            }
        }
        return undefined;
    };

    createEffect(() => {
        props.onStateChange?.({
            mode: onboardingMode(),
            isExistingUser: isExistingUser(),
            isAlreadyMember: isAlreadyMember(),
            canSubmit: !isAlreadyMember() && form.state.canSubmit && !form.state.isValidating,
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
                    if (isAlreadyMember() || !form.state.canSubmit || form.state.isValidating) return;
                    form.handleSubmit();
                }}
                class="flex flex-col gap-4 py-4"
            >
                {/* ═══ 1. User Identity & Live Detection ═══ */}
                <div class="space-y-4">
                    <form.Field name="email">
                        {(field) => (
                            <TextField.Root field={field} disabled={props.isSubmitting}>
                                <TextField.Label
                                    badge={
                                        <div class="flex items-center gap-1.5 min-h-5">
                                            {/* Non-intrusive live user detection */}
                                            <Show when={!checkQuery.isFetching && isExistingUser()}>
                                                <Badge size="sm" variant="success" class="animate-in fade-in">
                                                    <SparklesIcon class="size-3" />
                                                    Usuario (@{checkQuery.data?.username})
                                                </Badge>
                                            </Show>

                                            <Show when={!checkQuery.isFetching && isAlreadyMember()}>
                                                <Badge size="sm" variant="warning" class="animate-in fade-in">
                                                    <AlertTriangleIcon class="size-3" />
                                                    Ya es miembro en esta empresa
                                                </Badge>
                                            </Show>
                                        </div>
                                    }
                                >
                                    Correo electrónico *
                                </TextField.Label>

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
                                    <form.Field
                                        name="username"
                                        asyncDebounceMs={350}
                                        validators={{
                                            onChangeAsync: createUsernameAvailabilityValidator({
                                                enabled: () => onboardingMode() === 'direct',
                                            }),
                                        }}
                                    >
                                        {(field) => (
                                            <TextField.Root field={field} disabled={props.isSubmitting}>
                                                <TextField.Label
                                                    optional
                                                    badge={
                                                        <AvailabilityBadge
                                                            field={field}
                                                            availableLabel="Disponible"
                                                            takenLabel="En uso"
                                                        />
                                                    }
                                                >
                                                    Nombre de usuario
                                                </TextField.Label>
                                                <TextField.Input
                                                    placeholder="Se generará del correo si se deja vacío"
                                                    autocomplete="username"
                                                    onInput={(e) => {
                                                        const raw = e.currentTarget.value;
                                                        const v = raw.toLowerCase().replace(/[^a-z0-9._-]/g, '');
                                                        if (v !== raw) {
                                                            e.currentTarget.value = v;
                                                            field().handleChange(v);
                                                        }
                                                    }}
                                                />
                                                <TextField.ErrorMessage />
                                            </TextField.Root>
                                        )}
                                    </form.Field>

                                    <form.Field
                                        name="password"
                                        validators={{
                                            onChange: validateDirectPassword,
                                            onSubmit: validateDirectPassword,
                                        }}
                                    >
                                        {(field) => (
                                            <TextField.Root field={field} disabled={props.isSubmitting}>
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
                        onSubmit: ({ value }) => (!value || value.length === 0) ? 'Debes asignar al menos un rol al usuario' : undefined,
                    }}
                >
                    {(field) => {
                        const hasError = () => hasFieldError(field(), hasAttemptedSubmit());
                        const errorMsg = () => getFieldError(field()) || 'Debes asignar al menos un rol al usuario';
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
