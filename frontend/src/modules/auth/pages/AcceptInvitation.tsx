import { Component, createSignal, Show, onMount, For } from 'solid-js';
import { useSearch, useNavigate } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { toast } from 'solid-sonner';
import { authApi } from '../api/auth.api';
import { actions } from '../store/auth.store';
import { getFriendlyErrorMessage } from '@shared/utils/api-errors';
import TextField from '@form/TextField';
import Button from '@form/Button';
import { Badge } from '@shared/ui/display/Badge';
import OAuthButtons from '../components/OAuthButtons';
import { FormSubmissionContext } from '@shared/ui/form/form.types';

// ─── Password Strength Meter ───
const PasswordStrength: Component<{ password: string }> = (props) => {
    const strength = () => {
        const p = props.password;
        if (!p) return 0;
        let s = 0;
        if (p.length >= 8) s++;
        if (/[A-Z]/.test(p)) s++;
        if (/[0-9]/.test(p)) s++;
        if (/[^A-Za-z0-9]/.test(p)) s++;
        return s;
    };
    const label = () => ['', 'Débil', 'Regular', 'Buena', 'Fuerte'][strength()];
    const color = () => ['bg-border', 'bg-danger', 'bg-warning', 'bg-primary', 'bg-success'][strength()];
    return (
        <Show when={props.password}>
            <div class="flex items-center gap-2 mt-1 px-1">
                <div class="flex-1 flex gap-1">
                    <For each={[0, 1, 2, 3]}>{(i) => (
                        <div class={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < strength() ? color() : 'bg-border'}`} />
                    )}</For>
                </div>
                <span class="text-xs text-muted font-medium">{label()}</span>
            </div>
        </Show>
    );
};

export const AcceptInvitation: Component = () => {
    const navigate = useNavigate();
    const search = useSearch({ strict: false });

    const token = () => (search() as { token?: string })?.token || new URLSearchParams(window.location.search).get('token') || '';
    const email = () => (search() as { email?: string })?.email || new URLSearchParams(window.location.search).get('email') || '';

    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);
    const [submitting, setSubmitting] = createSignal(false);

    const form = createForm(() => ({
        defaultValues: {
            password: '',
            confirmPassword: '',
        },
        validators: {
            onSubmit: ({ value }) => {
                if (!value.password || value.password.length < 8) {
                    return 'La contraseña debe tener al menos 8 caracteres';
                }
                if (value.password !== value.confirmPassword) {
                    return 'Las contraseñas no coinciden';
                }
                return undefined;
            },
        },
        onSubmit: async ({ value }) => {
            if (!token() || !email()) {
                toast.error('Enlace de invitación inválido o incompleto');
                return;
            }

            setSubmitting(true);
            try {
                // 1. Set initial password & mark user as verified
                await authApi.acceptInvitation({
                    token: token(),
                    email: email(),
                    password: value.password,
                });

                // 2. Sign in automatically
                await actions.login({
                    email: email(),
                    password: value.password,
                });

                toast.success('¡Cuenta activada exitosamente!');
                navigate({ to: '/dashboard', replace: true });
            } catch (err: any) {
                toast.error(getFriendlyErrorMessage(err, 'Error al activar la cuenta'));
            } finally {
                setSubmitting(false);
            }
        },
    }));

    return (
        <div class="w-full p-6 sm:p-8 bg-card border border-border rounded-2xl shadow-xl">
            {/* Header */}
            <div class="mb-6">
                <div class="flex items-center gap-2 mb-2">
                    <span class="size-2 rounded-full bg-primary animate-pulse" />
                    <span class="text-xs font-semibold text-primary uppercase tracking-wider">Invitación Corporativa</span>
                </div>
                <h1 class="text-2xl font-bold text-heading">Bienvenido al equipo</h1>
                <p class="text-muted text-sm mt-1">
                    Configura tu contraseña para activar tu acceso a la organización
                </p>
                <Show when={email()}>
                    <div class="mt-3">
                        <Badge variant="primary" class="gap-1.5 px-3 py-1 text-xs">
                            <span>Invitado como:</span>
                            <strong>{email()}</strong>
                        </Badge>
                    </div>
                </Show>
            </div>

            {/* Error state if missing parameters */}
            <Show
                when={Boolean(token() && email())}
                fallback={
                    <div class="text-center py-6 space-y-4">
                        <div class="size-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto text-xl font-bold">
                            ✕
                        </div>
                        <p class="text-sm text-muted">
                            El enlace de invitación no es válido o ha expirado.
                        </p>
                        <Button variant="outline" onClick={() => navigate({ to: '/login' })}>
                            Ir al inicio de sesión
                        </Button>
                    </div>
                }
            >
                {/* 1-Click OAuth Fast Pass */}
                <div class="space-y-3 mb-6">
                    <div class="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary font-medium leading-relaxed">
                        ⚡ <strong>Acceso 1-Click:</strong> Si utilizas Google o Microsoft con esta dirección, puedes acceder directamente sin definir contraseña.
                    </div>
                    <OAuthButtons mode="login" />
                </div>

                <div class="relative flex items-center justify-center my-4">
                    <div class="grow border-t border-border" />
                    <span class="px-3 text-xs text-muted font-medium uppercase tracking-wider bg-card">o crea tu contraseña personal</span>
                    <div class="grow border-t border-border" />
                </div>

                {/* Password Setup Form */}
                <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            setHasAttemptedSubmit(true);
                            form.handleSubmit();
                        }}
                        class="flex flex-col gap-4"
                        novalidate
                    >
                        <form.Field
                            name="password"
                            validators={{
                                onChange: ({ value }) => (!value || value.length < 8) ? 'La contraseña debe tener al menos 8 caracteres' : undefined,
                            }}
                        >
                            {(f) => (
                                <div class="flex flex-col gap-1">
                                    <TextField.Root field={f()} disabled={submitting()}>
                                        <TextField.Label>Nueva contraseña *</TextField.Label>
                                        <TextField.PasswordInput placeholder="Mínimo 8 caracteres" autocomplete="new-password" />
                                        <TextField.ErrorMessage />
                                    </TextField.Root>
                                    <PasswordStrength password={f().state.value} />
                                </div>
                            )}
                        </form.Field>

                        <form.Field
                            name="confirmPassword"
                            validators={{
                                onChangeListenTo: ['password'],
                                onChange: ({ value, fieldApi }) => {
                                    const pwd = fieldApi.form.getFieldValue('password');
                                    if (value !== pwd) return 'Las contraseñas no coinciden';
                                    return undefined;
                                },
                            }}
                        >
                            {(f) => (
                                <TextField.Root field={f()} disabled={submitting()}>
                                    <TextField.Label>Confirmar contraseña *</TextField.Label>
                                    <TextField.PasswordInput placeholder="Repite tu contraseña" autocomplete="new-password" />
                                    <TextField.ErrorMessage />
                                </TextField.Root>
                            )}
                        </form.Field>

                        <form.Subscribe
                            selector={(s) => ({ isSubmitting: s.isSubmitting })}
                            children={(s) => (
                                <Button
                                    type="submit"
                                    fullWidth
                                    loading={submitting() || s().isSubmitting}
                                    loadingText="Activando cuenta…"
                                    class="mt-2"
                                >
                                    Activar cuenta y entrar
                                </Button>
                            )}
                        />
                    </form>
                </FormSubmissionContext.Provider>
            </Show>
        </div>
    );
};

export default AcceptInvitation;
