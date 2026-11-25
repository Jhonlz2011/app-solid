import { Component, Show, createSignal, createMemo } from 'solid-js';
import { toast } from 'solid-sonner';
import { useAuth, actions as authActions } from '@modules/auth/store/auth.store';
import { profileApi } from '@modules/profile/data/profile.api';
import Button from '@form/Button';
import { TextField } from '@form/TextField';
import { Badge } from '@display/Badge';
import { LockIcon } from '@icons/LockIcon';
import { KeyIcon } from '@icons/KeyIcon';
import { EyeIcon } from '@icons/EyeIcon';
import { EyeOffIcon } from '@icons/EyeOffIcon';
import { LogoutIcon } from '@icons/LogoutIcon';
import { CheckIcon } from '@icons/CheckIcon';

/**
 * Full-area security gate shown inside MainLayout when `auth.mustChangePassword()` is true.
 * Blocks access to ERP modules until the employee replaces their temporary password
 * with a personal password via POST /api/profile/security/password.
 */
export const ForcePasswordChangeGate: Component = () => {
    const auth = useAuth();

    const [currentPassword, setCurrentPassword] = createSignal('');
    const [newPassword, setNewPassword] = createSignal('');
    const [confirmPassword, setConfirmPassword] = createSignal('');
    const [showCurrent, setShowCurrent] = createSignal(false);
    const [showNew, setShowNew] = createSignal(false);
    const [isSubmitting, setIsSubmitting] = createSignal(false);
    const [errorMsg, setErrorMsg] = createSignal<string | null>(null);

    const hasMinLength = () => newPassword().length >= 8;
    const isDifferentFromCurrent = () => !currentPassword() || newPassword() !== currentPassword();
    const passwordsMatch = () => newPassword().length > 0 && newPassword() === confirmPassword();

    const canSubmit = createMemo(() =>
        !isSubmitting()
        && currentPassword().length > 0
        && hasMinLength()
        && isDifferentFromCurrent()
        && passwordsMatch()
    );

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        setErrorMsg(null);

        if (!hasMinLength()) {
            setErrorMsg('La nueva contraseña debe tener al menos 8 caracteres.');
            return;
        }
        if (!isDifferentFromCurrent()) {
            setErrorMsg('La nueva contraseña debe ser diferente a la contraseña temporal.');
            return;
        }
        if (!passwordsMatch()) {
            setErrorMsg('Las contraseñas no coinciden.');
            return;
        }

        setIsSubmitting(true);
        try {
            await profileApi.changePassword({
                currentPassword: currentPassword(),
                newPassword: newPassword(),
            });
            await authActions.refreshSession();
            toast.success('Contraseña actualizada correctamente', {
                description: 'Tu acceso al sistema ha sido habilitado.',
            });
        } catch (err: any) {
            const msg = err?.message || 'No se pudo actualizar la contraseña. Verifica tu contraseña temporal.';
            setErrorMsg(msg);
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div class="h-full w-full overflow-y-auto flex items-center justify-center p-5 sm:p-8 bg-bg">
            <div class="w-full max-w-md rounded-2xl border border-border bg-card shadow-card overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div class="h-1 w-full bg-primary" />

                <div class="p-6 sm:p-8 space-y-6">
                    {/* Header */}
                    <div class="flex items-start gap-4">
                        <div class="size-12 rounded-2xl border border-primary/20 bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <LockIcon class="size-5" />
                        </div>
                        <div class="space-y-1.5 min-w-0">
                            <Badge size="sm" variant="info">Seguridad de cuenta</Badge>
                            <h1 class="text-lg sm:text-xl font-bold tracking-tight text-heading">
                                Actualiza tu contraseña temporal
                            </h1>
                            <p class="text-sm text-muted leading-relaxed">
                                Hola <strong class="text-heading">{auth.user()?.username || auth.user()?.email}</strong>. Por seguridad, debes definir una contraseña personal antes de ingresar al ERP.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} class="space-y-4">
                        <TextField.Root
                            value={currentPassword()}
                            onChange={setCurrentPassword}
                            disabled={isSubmitting()}
                        >
                            <TextField.Label>Contraseña temporal actual *</TextField.Label>
                            <div class="relative">
                                <TextField.Input
                                    type={showCurrent() ? 'text' : 'password'}
                                    placeholder="Ingresa la contraseña que recibiste"
                                    autocomplete="current-password"
                                    class="pr-9"
                                    required
                                />
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => setShowCurrent(v => !v)}
                                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                                >
                                    <Show when={showCurrent()} fallback={<EyeIcon class="size-4" />}>
                                        <EyeOffIcon class="size-4" />
                                    </Show>
                                </button>
                            </div>
                        </TextField.Root>

                        <TextField.Root
                            value={newPassword()}
                            onChange={setNewPassword}
                            disabled={isSubmitting()}
                        >
                            <TextField.Label>Nueva contraseña personal *</TextField.Label>
                            <div class="relative">
                                <TextField.Input
                                    type={showNew() ? 'text' : 'password'}
                                    placeholder="Mínimo 8 caracteres"
                                    autocomplete="new-password"
                                    class="pr-9"
                                    required
                                />
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => setShowNew(v => !v)}
                                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                                >
                                    <Show when={showNew()} fallback={<EyeIcon class="size-4" />}>
                                        <EyeOffIcon class="size-4" />
                                    </Show>
                                </button>
                            </div>
                        </TextField.Root>

                        <TextField.Root
                            value={confirmPassword()}
                            onChange={setConfirmPassword}
                            disabled={isSubmitting()}
                        >
                            <TextField.Label>Confirmar nueva contraseña *</TextField.Label>
                            <TextField.Input
                                type={showNew() ? 'text' : 'password'}
                                placeholder="Repite tu nueva contraseña"
                                autocomplete="new-password"
                                required
                            />
                        </TextField.Root>

                        {/* Live validation checklist */}
                        <div class="rounded-xl border border-border bg-surface/50 p-3 space-y-1.5 text-xs">
                            <div class={`flex items-center gap-2 ${hasMinLength() ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted'}`}>
                                <CheckIcon class="size-3.5 shrink-0" />
                                <span>Al menos 8 caracteres</span>
                            </div>
                            <div class={`flex items-center gap-2 ${isDifferentFromCurrent() && newPassword().length > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted'}`}>
                                <CheckIcon class="size-3.5 shrink-0" />
                                <span>Distinta a tu contraseña temporal</span>
                            </div>
                            <div class={`flex items-center gap-2 ${passwordsMatch() ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted'}`}>
                                <CheckIcon class="size-3.5 shrink-0" />
                                <span>Las contraseñas coinciden</span>
                            </div>
                        </div>

                        <Show when={errorMsg()}>
                            <div role="alert" class="rounded-xl border border-danger/25 bg-danger/8 px-3.5 py-2.5 text-xs text-danger font-medium">
                                {errorMsg()}
                            </div>
                        </Show>

                        <div class="space-y-2.5 pt-1">
                            <Button
                                type="submit"
                                variant="primary"
                                class="w-full"
                                icon={<KeyIcon class="size-4" />}
                                loading={isSubmitting()}
                                loadingText="Actualizando contraseña..."
                                disabled={!canSubmit()}
                            >
                                Guardar y continuar
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                class="w-full"
                                icon={<LogoutIcon class="size-4" />}
                                disabled={isSubmitting()}
                                onClick={() => void authActions.logout()}
                            >
                                Cerrar sesión
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ForcePasswordChangeGate;
