// Account Section - Username/Email Form with TanStack Form + Valibot
import { Component, Show, createMemo } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import type { Profile } from '../models/profile.types';
import { UpdateProfileSchema } from '../models/profile.schemas';
import { TextField } from '@shared/ui/TextField';
import Button from '@shared/ui/Button';
import { AlertCircleIcon, FloppyDiskIcon } from '@shared/ui/icons';

interface AccountSectionProps {
    profile: Profile;
    onUpdate: (data: { username?: string; email?: string }) => Promise<void>;
    isUpdating: boolean;
}

export const AccountSection: Component<AccountSectionProps> = (props) => {
    // Memoize profile values to prevent unnecessary re-renders
    const profileUsername = createMemo(() => props.profile.username || '');
    const profileEmail = createMemo(() => props.profile.email || '');

    const form = createForm(() => ({
        defaultValues: {
            username: profileUsername(),
            email: profileEmail(),
        },
        validatorAdapter: valibotValidator(),
        validators: {
            onBlur: UpdateProfileSchema,
            onSubmit: UpdateProfileSchema,
        },
        onSubmit: async ({ value }) => {
            // Only send changed fields
            const updates: { username?: string; email?: string } = {};
            if (value.username !== profileUsername()) {
                updates.username = value.username;
            }
            if (value.email !== profileEmail()) {
                updates.email = value.email;
            }

            if (Object.keys(updates).length > 0) {
                await props.onUpdate(updates);
            }
        },
    }));

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
                class="space-y-5"
            >
                {/* Username Field */}
                <form.Field name="username">
                    {(field) => (
                        <TextField.Root field={field()} disabled={props.isUpdating}>
                            <TextField.Label>Nombre de usuario</TextField.Label>
                            <div class="relative">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-muted z-10">@</span>
                                <TextField.Input placeholder="nombredeusuario" class="pl-9" />
                            </div>
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )}
                </form.Field>

                {/* Email Field */}
                <form.Field name="email">
                    {(field) => (
                        <TextField.Root field={field()} disabled={props.isUpdating}>
                            <TextField.Label>Correo electrónico</TextField.Label>
                            <TextField.Input type="email" placeholder="tu@email.com" />
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

                {/* Submit Button - using form.Subscribe for proper reactivity */}
                <form.Subscribe selector={(state) => ({
                    values: state.values,
                    isSubmitting: state.isSubmitting,
                })}>
                    {(state) => {
                        const hasChanges = () =>
                            state().values.username !== profileUsername() ||
                            state().values.email !== profileEmail();

                        return (
                            <Button
                                type="submit"
                                disabled={!hasChanges() || props.isUpdating || state().isSubmitting}
                                loading={props.isUpdating || state().isSubmitting}
                                loadingText="Guardando..."
                                size="lg"
                                icon={<FloppyDiskIcon/>}
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
