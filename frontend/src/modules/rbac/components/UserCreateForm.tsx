import { Component, createSignal, Show, createMemo, createEffect } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { UserCreateSchema, type UserCreateData } from '@app/schema/frontend';
import type { RoleType } from '@app/schema/dto';
import { TextField } from '@form/TextField';
import Checkbox from '@form/Checkbox';
import Button from '@form/Button';
import { EntitySelect } from '@shared/ui/selectors';
import { FormSubmissionContext, hasFieldError, getFieldError } from '@shared/ui/form/form.types';
import { handleFormApiErrors } from '@shared/utils/form.utils';
import { copyToClipboard } from '@shared/utils/clipboard';
import { toast } from 'solid-sonner';
import { SparklesIcon } from '@icons/SparklesIcon';
import { AlertTriangleIcon } from '@icons/AlertTriangleIcon';
import { MailIcon } from '@icons/MailIcon';
import { KeyIcon } from '@icons/KeyIcon';
import { CopyIcon } from '@icons/CopyIcon';
import { EyeIcon } from '@icons/EyeIcon';
import { EyeOffIcon } from '@icons/EyeOffIcon';
import { RotateCwIcon } from '@icons/RotateCwIcon';
import { useCheckUserEmail } from '../data/users.queries';
import { UserRolePicker } from './shared/UserRolePicker';
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
    initialRoleName?: string;
    hasFreeAccountantSeat?: boolean;
    freeAccountantSeatAvailable?: boolean;
    onSubmit: (values: UserCreateData) => void | Promise<void>;
    isSubmitting?: boolean;
    onStateChange?: (state: UserCreateFormState) => void;
}

function generateTemporaryPassword(length = 12): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '@#$%&*!';
    const all = upper + lower + digits + symbols;

    const bytes = new Uint32Array(length);
    crypto.getRandomValues(bytes);

    // Guarantee at least one character from each class
    const chars: string[] = [
        upper[bytes[0] % upper.length],
        lower[bytes[1] % lower.length],
        digits[bytes[2] % digits.length],
        symbols[bytes[3] % symbols.length],
    ];
    for (let i = 4; i < length; i++) {
        chars.push(all[bytes[i] % all.length]);
    }
    // Fisher-Yates shuffle using fresh randomness
    const shuffleBytes = new Uint32Array(chars.length);
    crypto.getRandomValues(shuffleBytes);
    for (let i = chars.length - 1; i > 0; i--) {
        const j = shuffleBytes[i] % (i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
}

export const UserCreateForm: Component<UserCreateFormProps> = (props) => {
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);
    const [onboardingMode, setOnboardingMode] = createSignal<UserOnboardingMode>('invite');
    const [showPassword, setShowPassword] = createSignal(true);

    const form = createForm(() => ({
        defaultValues: {
            username: undefined as string | undefined,
            email: '',
            roleIds: [] as number[],
            entityId: null as string | null,
            mode: 'invite' as UserOnboardingMode,
            temporaryPassword: '',
            mustChangePassword: true,
            sendEmail: true,
        } as UserCreateData,
        validators: {
            onChange: UserCreateSchema,
            onSubmit: UserCreateSchema,
        },
        onSubmit: async ({ value }) => {
            try {
                const effectiveMode: UserOnboardingMode = isExistingUser() ? 'invite' : onboardingMode();
                const payload: UserCreateData = {
                    ...value,
                    mode: effectiveMode,
                    username: isExistingUser() ? undefined : (value.username?.trim() || undefined),
                    temporaryPassword: effectiveMode === 'direct' ? value.temporaryPassword : undefined,
                    mustChangePassword: effectiveMode === 'direct' ? (value.mustChangePassword ?? true) : undefined,
                    sendEmail: value.sendEmail ?? (effectiveMode === 'invite'),
                };
                await props.onSubmit(payload);
            } catch (err) {
                handleFormApiErrors(form, err, 'Error al crear el usuario', props.formId ?? 'user-create-form');
            }
        },
    }));

    const emailValue = form.useStore((s) => s.values.email);
    const tempPasswordValue = form.useStore((s) => s.values.temporaryPassword ?? '');

    // Live email check query
    const checkQuery = useCheckUserEmail(() => emailValue());

    const isAlreadyMember = createMemo(() => Boolean(checkQuery.data?.isAlreadyMember));
    const isExistingUser = createMemo(() => Boolean(checkQuery.data?.exists && !checkQuery.data?.isAlreadyMember));

    const handleModeSwitch = (nextMode: UserOnboardingMode) => {
        if (nextMode === 'direct' && isExistingUser()) return;
        setOnboardingMode(nextMode);
        form.setFieldValue('mode', nextMode);
        if (nextMode === 'direct') {
            form.setFieldValue('sendEmail', false);
            form.setFieldValue('mustChangePassword', true);
            if (!form.getFieldValue('temporaryPassword')) {
                form.setFieldValue('temporaryPassword', generateTemporaryPassword());
            }
        } else {
            form.setFieldValue('sendEmail', true);
            form.setFieldValue('temporaryPassword', '');
        }
    };

    // If an existing global Zelys user is detected, force invite mode for multi-tenant consent security
    createEffect(() => {
        if (isExistingUser() && onboardingMode() === 'direct') {
            handleModeSwitch('invite');
        }
    });

    createEffect(() => {
        props.onStateChange?.({
            mode: isExistingUser() ? 'invite' : onboardingMode(),
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

    const handleGeneratePassword = () => {
        const next = generateTemporaryPassword();
        form.setFieldValue('temporaryPassword', next);
        setShowPassword(true);
    };

    const handleCopyPassword = async () => {
        const val = tempPasswordValue();
        if (!val) return;
        const ok = await copyToClipboard(val);
        if (ok) toast.success('Contraseña temporal copiada');
    };

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
                {/* ═══ 0. Onboarding Mode Selector ═══ */}
                <div class="space-y-1.5">
                    <span class="text-xs font-medium text-muted block">Método de acceso inicial</span>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                            type="button"
                            disabled={props.isSubmitting}
                            onClick={() => handleModeSwitch('invite')}
                            class={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                                onboardingMode() === 'invite'
                                    ? 'border-primary bg-primary/8 ring-1 ring-primary/30'
                                    : 'border-border bg-surface/30 hover:bg-surface/60'
                            }`}
                        >
                            <div
                                class={`size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                    onboardingMode() === 'invite' ? 'bg-primary text-white' : 'bg-surface text-muted'
                                }`}
                            >
                                <MailIcon class="size-4" />
                            </div>
                            <div class="min-w-0">
                                <div class="text-sm font-semibold text-heading">Invitación por correo</div>
                                <p class="text-[11px] text-muted leading-snug mt-0.5">
                                    Envía o comparte un enlace único para que el usuario cree su clave.
                                </p>
                            </div>
                        </button>

                        <button
                            type="button"
                            disabled={props.isSubmitting || isExistingUser()}
                            onClick={() => handleModeSwitch('direct')}
                            title={isExistingUser() ? 'Las cuentas existentes en Zelys requieren invitación por seguridad multi-empresa' : undefined}
                            class={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                                isExistingUser()
                                    ? 'opacity-50 cursor-not-allowed border-border/60 bg-surface/20'
                                    : onboardingMode() === 'direct'
                                        ? 'border-primary bg-primary/8 ring-1 ring-primary/30'
                                        : 'border-border bg-surface/30 hover:bg-surface/60'
                            }`}
                        >
                            <div
                                class={`size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                    onboardingMode() === 'direct' && !isExistingUser() ? 'bg-primary text-white' : 'bg-surface text-muted'
                                }`}
                            >
                                <KeyIcon class="size-4" />
                            </div>
                            <div class="min-w-0">
                                <div class="text-sm font-semibold text-heading">Acceso rápido</div>
                                <p class="text-[11px] text-muted leading-snug mt-0.5">
                                    Asigna una contraseña temporal sin esperar verificación de correo.
                                </p>
                            </div>
                        </button>
                    </div>
                </div>

                {/* ═══ 1. User Identity & Live Detection ═══ */}
                <div class="space-y-4">
                    <form.Field name="email">
                        {(field) => (
                            <TextField.Root field={field} disabled={props.isSubmitting}>
                                <TextField.Label
                                    badge={
                                        <div class="flex items-center gap-1.5 min-h-5">
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

                    {/* Optional username for new users */}
                    <Show when={!isExistingUser()}>
                        <form.Field name="username">
                            {(field) => (
                                <TextField.Root field={field} disabled={props.isSubmitting || isAlreadyMember()}>
                                    <TextField.Label>Nombre de usuario (opcional)</TextField.Label>
                                    <TextField.Input
                                        type="text"
                                        placeholder="ej. maria.perez (se genera automáticamente si se deja vacío)"
                                        autocomplete="off"
                                    />
                                    <TextField.ErrorMessage />
                                </TextField.Root>
                            )}
                        </form.Field>
                    </Show>
                </div>

                {/* Existing user consent notice */}
                <Show when={isExistingUser()}>
                    <div class="rounded-xl border border-info/25 bg-info/8 p-3 text-xs text-muted leading-relaxed">
                        Esta cuenta ya existe en Zelys (<strong class="text-heading">@{checkQuery.data?.username}</strong>). Por seguridad multi-empresa, se enviará una invitación para que confirme su ingreso a esta organización.
                    </div>
                </Show>

                {/* ═══ 1B. Direct Mode: Temporary Password & Security Options ═══ */}
                <Show when={onboardingMode() === 'direct' && !isExistingUser()}>
                    <div class="rounded-xl border border-border bg-surface/40 p-4 space-y-3 animate-in fade-in duration-150">
                        <form.Field name="temporaryPassword">
                            {(field) => (
                                <div class="space-y-1.5">
                                    <TextField.Root field={field} disabled={props.isSubmitting || isAlreadyMember()}>
                                        <TextField.Label>Contraseña temporal *</TextField.Label>
                                        <div class="flex items-center gap-1.5">
                                            <div class="relative flex-1">
                                                <TextField.Input
                                                    type={showPassword() ? 'text' : 'password'}
                                                    placeholder="Mínimo 8 caracteres"
                                                    autocomplete="new-password"
                                                    class="font-mono pr-9"
                                                />
                                                <button
                                                    type="button"
                                                    tabIndex={-1}
                                                    onClick={() => setShowPassword(v => !v)}
                                                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                                                    title={showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                                >
                                                    <Show when={showPassword()} fallback={<EyeIcon class="size-4" />}>
                                                        <EyeOffIcon class="size-4" />
                                                    </Show>
                                                </button>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleGeneratePassword}
                                                disabled={props.isSubmitting}
                                                title="Generar contraseña segura"
                                            >
                                                <RotateCwIcon class="size-4" />
                                                <span class="hidden sm:inline">Generar</span>
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleCopyPassword}
                                                disabled={!tempPasswordValue()}
                                                title="Copiar contraseña"
                                            >
                                                <CopyIcon class="size-4" />
                                            </Button>
                                        </div>
                                        <TextField.ErrorMessage />
                                    </TextField.Root>
                                </div>
                            )}
                        </form.Field>

                        <div class="space-y-2 pt-1">
                            <form.Field name="mustChangePassword">
                                {(field) => (
                                    <label class="flex items-start gap-2.5 text-xs cursor-pointer">
                                        <Checkbox
                                            checked={Boolean(field().state.value)}
                                            disabled={props.isSubmitting}
                                            onChange={(checked) => field().handleChange(checked)}
                                        />
                                        <span class="text-text leading-snug">
                                            <strong class="font-medium">Exigir cambio de contraseña en el primer inicio de sesión</strong>
                                            <span class="block text-muted text-[11px]">Recomendado: el colaborador deberá elegir una clave personal al entrar.</span>
                                        </span>
                                    </label>
                                )}
                            </form.Field>

                            <form.Field name="sendEmail">
                                {(field) => (
                                    <label class="flex items-start gap-2.5 text-xs cursor-pointer">
                                        <Checkbox
                                            checked={Boolean(field().state.value)}
                                            disabled={props.isSubmitting}
                                            onChange={(checked) => field().handleChange(checked)}
                                        />
                                        <span class="text-text leading-snug">
                                            Enviar aviso de acceso por correo electrónico
                                            <span class="block text-muted text-[11px]">Por seguridad el correo no incluye la contraseña; al finalizar podrás copiar las credenciales.</span>
                                        </span>
                                    </label>
                                )}
                            </form.Field>
                        </div>
                    </div>
                </Show>

                {/* ═══ 1C. Invite Mode Options ═══ */}
                <Show when={onboardingMode() === 'invite'}>
                    <div class="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5 text-xs text-muted">
                        <p class="leading-relaxed">
                            Se generará un enlace de activación único válido por <strong>72 horas</strong>. Al guardar también podrás copiar el enlace para enviarlo por WhatsApp o chat interno.
                        </p>
                        <form.Field name="sendEmail">
                            {(field) => (
                                <label class="flex items-center gap-2 cursor-pointer text-text font-medium">
                                    <Checkbox
                                        checked={field().state.value ?? true}
                                        disabled={props.isSubmitting}
                                        onChange={(checked) => field().handleChange(checked)}
                                    />
                                    <span>Enviar correo de invitación automáticamente</span>
                                </label>
                            )}
                        </form.Field>
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
                        const selectedIds = () => field().state.value ?? [];
                        const accountantRoleId = () =>
                            props.roles.find(r => r.name.toLowerCase() === 'contador')?.id;
                        const isAccountantIncluded = () => {
                            const id = accountantRoleId();
                            return id !== undefined && selectedIds().includes(id);
                        };
                        const isExclusiveAccountant = () => isAccountantIncluded() && selectedIds().length === 1;
                        const qualifiesForFreeSeat = () =>
                            Boolean(props.freeAccountantSeatAvailable && isExclusiveAccountant());
                        const regularSeatReason = () => {
                            if (!props.hasFreeAccountantSeat) {
                                return 'Tu plan actual no incluye asiento de cortesía para contador externo; este usuario ocupará un asiento operativo regular.';
                            }
                            if (!isExclusiveAccountant()) {
                                return 'El asiento gratuito aplica únicamente si el usuario tiene el rol Contador como único rol. Al combinar roles ocupará un asiento operativo regular.';
                            }
                            return 'El asiento gratuito de contador externo ya está ocupado en esta empresa; este usuario ocupará un asiento operativo regular.';
                        };

                        return (
                            <div class="space-y-1">
                                <UserRolePicker
                                    roles={props.roles}
                                    rolesLoading={props.rolesLoading}
                                    selectedRoleIds={selectedIds()}
                                    onChange={(ids: number[]) => {
                                        field().handleChange(ids);
                                        field().handleBlur();
                                    }}
                                    disabled={props.isSubmitting || isAlreadyMember()}
                                />

                                <Show when={qualifiesForFreeSeat()}>
                                    <div class="p-3 bg-primary/10 border border-primary/25 rounded-xl flex items-start gap-2.5 text-xs text-primary animate-in fade-in slide-in-from-top-1 duration-200 mt-2">
                                        <SparklesIcon class="size-4 shrink-0 mt-0.5 text-primary" />
                                        <div>
                                            <strong class="font-semibold block">Asiento Gratuito de Contador Externo</strong>
                                            <span>Este usuario ocupará el slot de cortesía incluido en tu plan y no consumirá asientos operativos regulares.</span>
                                        </div>
                                    </div>
                                </Show>

                                <Show when={isAccountantIncluded() && !qualifiesForFreeSeat()}>
                                    <div class="p-3 bg-surface border border-border rounded-xl flex items-start gap-2.5 text-xs text-muted animate-in fade-in slide-in-from-top-1 duration-200 mt-2">
                                        <AlertTriangleIcon class="size-4 shrink-0 mt-0.5 text-amber-500" />
                                        <div>
                                            <strong class="font-semibold text-heading block">Asiento operativo regular</strong>
                                            <span>{regularSeatReason()}</span>
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
