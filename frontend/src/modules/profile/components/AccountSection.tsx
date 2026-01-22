// Account Section - Username/Email Form with TanStack Form + Valibot
import { Component, createEffect, on, Show } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import type { Profile } from '../models/profile.types';
import { UpdateProfileSchema } from '../models/profile.schemas';
import { TextField } from './fields/TextField';
import Button from '@shared/components/ui/Button';
import { AlertCircleIcon } from '@shared/components/icons';

interface AccountSectionProps {
    profile: Profile;
    onUpdate: (data: { username?: string; email?: string }) => Promise<void>;
    isUpdating: boolean;
}

export const AccountSection: Component<AccountSectionProps> = (props) => {
    const form = createForm(() => ({
        defaultValues: {
            username: props.profile.username || '',
            email: props.profile.email || '',
        },
        validatorAdapter: valibotValidator(),
        validators: {
            onBlur: UpdateProfileSchema,
            onSubmit: UpdateProfileSchema,
        },
        onSubmit: async ({ value }) => {
            // Only send changed fields
            const updates: { username?: string; email?: string } = {};
            if (value.username !== props.profile.username) {
                updates.username = value.username;
            }
            if (value.email !== props.profile.email) {
                updates.email = value.email;
            }

            if (Object.keys(updates).length > 0) {
                // Toast handling is in parent (ProfilePage) for consistency
                await props.onUpdate(updates);
            }
        },
    }));

    // Reset form when profile changes externally
    createEffect(on(
        () => props.profile,
        () => form.reset({
            username: props.profile.username || '',
            email: props.profile.email || '',
        }),
        { defer: true }
    ));

    return (
        <div>
            <h2 class="text-lg font-semibold text-heading mb-1">Información de la cuenta</h2>
            <p class="text-sm text-muted mb-6">Actualiza tu nombre de usuario y dirección de email.</p>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    form.handleSubmit();
                }}
                class="space-y-1"
            >
                {/* Username Field */}
                <form.Field name="username">
                    {(field) => (
                        <TextField
                            field={field()}
                            label="Nombre de usuario"
                            id="username"
                            placeholder="nombredeusuario"
                            prefix="@"
                        />
                    )}
                </form.Field>

                {/* Email Field */}
                <form.Field name="email">
                    {(field) => (
                        <TextField
                            field={field()}
                            label="Correo electrónico"
                            id="email"
                            type="email"
                            placeholder="tu@email.com"
                        />
                    )}
                </form.Field>

                {/* Form-level Error Message */}
                <Show when={form.state.submissionAttempts > 0 && !form.state.canSubmit}>
                    <div class="flex items-center gap-2 p-3 bg-danger/10 border border-danger/20 rounded-lg text-sm text-danger">
                        <AlertCircleIcon class="size-4 shrink-0" />
                        Por favor corrige los errores antes de continuar
                    </div>
                </Show>

                {/* Submit Button - using form.Subscribe for proper reactivity */}
                <form.Subscribe selector={(state) => ({
                    values: state.values,
                    isSubmitting: state.isSubmitting,
                })}>
                    {(state) => {
                        const hasChanges = () =>
                            state().values.username !== props.profile.username ||
                            state().values.email !== props.profile.email;

                        return (
                            <Button
                                type="submit"
                                disabled={!hasChanges() || props.isUpdating || state().isSubmitting}
                                loading={props.isUpdating || state().isSubmitting}
                                size="lg"
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
