// Security Section - Change Password Form with TanStack Form + Valibot
import { Component, Show } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { ChangePasswordSchema } from '../models/profile.schemas';
import { TextField } from '@shared/ui/TextField';
import Button from '@shared/ui/Button';
import { AlertCircleIcon, WarningIcon, KeyIcon } from '@shared/ui/icons';

interface SecuritySectionProps {
    onChangePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>;
    isChanging: boolean;
}

export const SecuritySection: Component<SecuritySectionProps> = (props) => {
    const form = createForm(() => ({
        defaultValues: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        },
        validatorAdapter: valibotValidator(),
        validators: {
            onSubmit: ChangePasswordSchema,
        },
        onSubmit: async ({ value }) => {
            try {
                await props.onChangePassword({
                    currentPassword: value.currentPassword,
                    newPassword: value.newPassword,
                });
                // Reset form only on success
                form.reset();
            } catch {
                // Error is handled by parent (ProfilePage shows toast)
                // Don't throw - TanStack Form doesn't handle thrown errors well
                // and isSubmitting won't reset. Just catch silently.
            }
        },
    }));

    return (
            <div>
                <h2 class="text-lg font-semibold text-heading mb-1">Cambiar contraseña</h2>
                <p class="text-sm text-muted mb-6">Ingresa tu contraseña actual y elige una nueva.</p>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.handleSubmit();
                    }}
                    class="space-y-5"
                >
                    {/* Current Password - Atomic component */}
                    <form.Field name="currentPassword">
                        {(field) => (
                            <TextField.Root field={field()} disabled={props.isChanging}>
                                <TextField.Label>Contraseña actual</TextField.Label>
                                <TextField.PasswordInput placeholder="••••••••" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>

                    {/* New Password - Atomic component */}
                    <form.Field name="newPassword">
                        {(field) => (
                            <TextField.Root field={field()} disabled={props.isChanging}>
                                <TextField.Label>Nueva contraseña</TextField.Label>
                                <TextField.PasswordInput placeholder="Mínimo 8 caracteres" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>

                    {/* Confirm Password - Atomic component */}
                    <form.Field name="confirmPassword">
                        {(field) => (
                            <TextField.Root field={field()} disabled={props.isChanging}>
                                <TextField.Label>Confirmar contraseña</TextField.Label>
                                <TextField.PasswordInput placeholder="Repite la nueva contraseña" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>

                    {/* Warning */}
                    <div class="flex items-center gap-3 p-3 bg-warning/10 border border-warning/20 rounded-xl text-sm my-6">
                        <WarningIcon class="size-5 text-warning shrink-0" />
                        <p class="text-muted">
                            Al cambiar tu contraseña, todas tus sesiones activas serán cerradas y deberás iniciar sesión nuevamente.
                        </p>
                    </div>

                    {/* Submit Button - using form.Subscribe for proper reactivity */}
                    <form.Subscribe selector={(state) => ({
                        isSubmitting: state.isSubmitting,
                    })}>
                        {(state) => (
                            <Button
                                type="submit"
                                disabled={props.isChanging || state().isSubmitting}
                                loading={props.isChanging || state().isSubmitting}
                                loadingText="Cambiando..."
                                size="lg"
                                icon={<KeyIcon class="size-4" />}
                            >
                                Cambiar contraseña
                            </Button>
                        )}
                    </form.Subscribe>
                </form>
            </div>
    );
};