import { Component, createSignal, Show, createMemo, createEffect } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { UserCreateSchema, type UserCreateData } from '@app/schema/frontend';
import type { RoleType } from '@app/schema/dto';
import { TextField, FieldLabel } from '@form/TextField';
import { EntitySelect } from '@shared/ui/selectors';
import { FormSubmissionContext, hasFieldError, getFieldError } from '@shared/ui/form/form.types';
import { handleFormApiErrors } from '@shared/utils/form.utils';
import { SparklesIcon } from '@icons/SparklesIcon';
import { AlertTriangleIcon } from '@icons/AlertTriangleIcon';
import { useCheckUserEmail } from '../data/users.queries';
import { UserRolePicker } from './shared/UserRolePicker';
import { Badge } from '@display/Badge';

export type UserOnboardingMode = 'invite';

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
    initialRoleName?: string;
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
                const payload: UserCreateData = {
                    ...value,
                    mode: 'invite',
                    username: value.username?.trim() || undefined,
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

    createEffect(() => {
        props.onStateChange?.({
            mode: onboardingMode(),
            isExistingUser: isExistingUser(),
            isAlreadyMember: isAlreadyMember(),
            canSubmit: !isAlreadyMember() && form.state.canSubmit && !form.state.isValidating,
        });
    });

    createEffect(() => {
        if (props.initialRoleName && props.roles && props.roles.length > 0) {
            const target = props.roles.find(r => r.name.toLowerCase() === props.initialRoleName?.toLowerCase());
            const currentRoles = form.getFieldValue('roleIds') ?? [];
            if (target && currentRoles.length === 0) {
                form.setFieldValue('roleIds', [target.id]);
            }
        }
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

                <div class="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-muted">
                    Se enviará una invitación de un solo uso. El usuario definirá su propia contraseña después de verificar su correo.
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
                <form.Field
                    name="roleIds"
                    validators={{
                        onSubmit: ({ value }) => (!value || value.length === 0) ? 'Debes asignar al menos un rol al usuario' : undefined,
                    }}
                >
                    {(field) => {
                        const hasError = () => hasFieldError(field(), hasAttemptedSubmit());
                        const errorMsg = () => getFieldError(field()) || 'Debes asignar al menos un rol al usuario';
                        const isAccountantSelected = () => {
                            const selectedIds = field().state.value ?? [];
                            return props.roles.some(r => r.name.toLowerCase() === 'contador' && selectedIds.includes(r.id));
                        };

                        return (
                            <div class="space-y-1">
                                <UserRolePicker
                                    roles={props.roles}
                                    rolesLoading={props.rolesLoading}
                                    selectedRoleIds={field().state.value ?? []}
                                    onChange={(ids: number[]) => {
                                        field().handleChange(ids);
                                        field().handleBlur();
                                    }}
                                    disabled={props.isSubmitting || isAlreadyMember()}
                                />

                                <Show when={isAccountantSelected()}>
                                    <div class="p-3 bg-primary/10 border border-primary/25 rounded-xl flex items-start gap-2.5 text-xs text-primary animate-in fade-in slide-in-from-top-1 duration-200 mt-2">
                                        <SparklesIcon class="size-4 shrink-0 mt-0.5 text-primary" />
                                        <div>
                                            <strong class="font-semibold block">Asiento Gratuito de Contador Externo</strong>
                                            <span>Este usuario ocupará el slot de cortesía incluido en tu plan para tu contador externo y no consumirá asientos operativos regulares.</span>
                                        </div>
                                    </div>
                                </Show>

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
