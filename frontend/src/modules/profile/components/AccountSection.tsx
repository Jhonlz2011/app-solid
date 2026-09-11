// Account Section - Username/Email Management with Real-Time Validation & Native Better-Auth
import { Component, Show, createMemo, createSignal } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import type { ProfileType } from '@app/schema/dto';
import { UpdateProfileSchema } from '@app/schema/frontend';
import { TextField } from '@form/TextField';
import Button from '@form/Button';
import { AlertCircleIcon } from '@icons/AlertCircleIcon';
import { FloppyDiskIcon } from '@icons/FloppyDiskIcon';
import { MailIcon } from '@icons/MailIcon';
import { AvailabilityBadge } from '@shared/ui/form/AvailabilityBadge';
import { createUsernameAvailabilityValidator, createEmailAvailabilityValidator } from '@shared/ui/form/validators/availability.validators';

interface AccountSectionProps {
    profile: ProfileType;
    onUpdateProfile: (data: { username?: string; name?: string }) => Promise<void>;
    onChangeEmail: (newEmail: string) => Promise<void>;
    isUpdatingProfile: boolean;
    isChangingEmail: boolean;
}

export const AccountSection: Component<AccountSectionProps> = (props) => {
    // Memoize profile values to prevent unnecessary re-renders
    const profileUsername = createMemo(() => props.profile.username || '');
    const profileEmail = createMemo(() => props.profile.email || '');

    // Feedback for email change request
    const [pendingNewEmail, setPendingNewEmail] = createSignal<string | null>(null);

    const form = createForm(() => ({
        defaultValues: {
            username: profileUsername(),
            email: profileEmail(),
        },
        validators: {
            onChange: UpdateProfileSchema,
            onSubmit: UpdateProfileSchema,
        },
        onSubmit: async ({ value }) => {
            const hasUsernameChanged = value.username !== profileUsername();
            const hasEmailChanged = value.email !== profileEmail();

            // 1. Manejo de cambio de username (Inmediato vía Better-Auth)
            if (hasUsernameChanged) {
                await props.onUpdateProfile({ username: value.username });
            }

            // 2. Manejo de cambio de correo (Seguro con verificación vía Better-Auth)
            if (hasEmailChanged) {
                await props.onChangeEmail(value.email);
                setPendingNewEmail(value.email);
            }
        },
    }));

    const isPending = () => props.isUpdatingProfile || props.isChangingEmail;

    return (
        <div>
            <h2 class="text-lg font-semibold text-heading mb-1">Información de la cuenta</h2>
            <p class="text-sm text-muted mb-6">Actualiza tu nombre de usuario y dirección de email de forma segura.</p>

            {/* Banner informativo si se solicitó cambio de correo */}
            <Show when={pendingNewEmail()}>
                {(email) => (
                    <div class="mb-5 p-4 bg-primary/10 border border-primary/20 rounded-xl flex items-start gap-3 animate-in fade-in duration-200">
                        <MailIcon class="size-5 text-primary shrink-0 mt-0.5" />
                        <div class="text-xs text-heading space-y-1">
                            <p class="font-semibold text-primary">Enlace de confirmación enviado</p>
                            <p class="text-muted leading-relaxed">
                                Hemos enviado un enlace de validación a <strong>{email()}</strong>. Tu cuenta mantendrá tu correo actual ({profileEmail()}) hasta que verifiques la nueva dirección.
                            </p>
                        </div>
                    </div>
                )}
            </Show>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    form.handleSubmit();
                }}
                class="space-y-4"
            >
                {/* Username Field with Live Availability */}
                <form.Field
                    name="username"
                    asyncDebounceMs={350}
                    validators={{
                        onChangeAsync: createUsernameAvailabilityValidator({
                            currentValue: profileUsername,
                        }),
                    }}
                >
                    {(field) => (
                        <TextField.Root field={field} disabled={isPending}>
                            <TextField.Label
                                badge={
                                    <AvailabilityBadge
                                        field={field}
                                        currentValue={profileUsername}
                                        currentLabel="Tu usuario actual"
                                        availableLabel="Disponible"
                                        takenLabel="Ya en uso"
                                    />
                                }
                            >
                                Nombre de usuario
                            </TextField.Label>
                            <TextField.Input
                                placeholder="nombredeusuario"
                                leftIcon={<span class="text-sm font-medium text-muted">@</span>}
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

                {/* Email Field with Live Availability */}
                <form.Field
                    name="email"
                    asyncDebounceMs={350}
                    validators={{
                        onChangeAsync: createEmailAvailabilityValidator({
                            currentValue: profileEmail,
                        }),
                    }}
                >
                    {(field) => (
                        <TextField.Root field={field} disabled={isPending}>
                            <TextField.Label
                                badge={
                                    <AvailabilityBadge
                                        field={field}
                                        currentValue={profileEmail}
                                        currentLabel="Tu correo actual"
                                        availableLabel="Disponible"
                                        takenLabel="Ya registrado"
                                    />
                                }
                            >
                                Correo electrónico
                            </TextField.Label>
                            <TextField.Input
                                type="email"
                                placeholder="tu@email.com"
                            />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )}
                </form.Field>

                {/* Form-level Error Message */}
                <Show when={form.state.submissionAttempts > 0 && !form.state.canSubmit}>
                    <div class="flex items-center gap-2 p-3 bg-danger/10 border border-danger/20 rounded-lg text-sm text-danger">
                        <AlertCircleIcon class="size-4 shrink-0" />
                        Por favor corrige los errores antes de continuar
                    </div>
                </Show>

                {/* Submit Button */}
                <form.Subscribe selector={(state) => ({
                    values: state.values,
                    isSubmitting: state.isSubmitting,
                    canSubmit: state.canSubmit,
                    isValidating: state.isValidating,
                })}>
                    {(state) => {
                        const hasUsernameChange = () => state().values.username !== profileUsername();
                        const hasEmailChange = () => state().values.email !== profileEmail();
                        const hasChanges = () => hasUsernameChange() || hasEmailChange();

                        const isSubmitDisabled = () =>
                            !hasChanges() ||
                            isPending() ||
                            state().isSubmitting ||
                            !state().canSubmit;

                        return (
                            <Button
                                type="submit"
                                disabled={isSubmitDisabled()}
                                loading={isPending() || state().isSubmitting || state().isValidating}
                                loadingText="Guardando..."
                                size="lg"
                                icon={<FloppyDiskIcon class="size-4" />}
                            >
                                Guardar cambios
                            </Button>
                        );
                    }}
                </form.Subscribe>
            </form>
        </div>
    );
};

export default AccountSection;
