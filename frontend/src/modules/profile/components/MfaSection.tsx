import { Component, Show, createSignal } from 'solid-js';
import { toast } from 'solid-sonner';
import { authClient } from '@shared/lib/auth-client';
import { profileApi } from '../data/profile.api';
import Button from '@form/Button';

type MfaSectionProps = {
    enabled: boolean;
};

/** Better Auth TOTP enrolment with one-time backup-code disclosure. */
export const MfaSection: Component<MfaSectionProps> = (props) => {
    const [password, setPassword] = createSignal('');
    const [code, setCode] = createSignal('');
    const [setup, setSetup] = createSignal<{ totpURI: string; backupCodes: string[] } | null>(null);
    const [enabled, setEnabled] = createSignal(props.enabled);
    const [pending, setPending] = createSignal(false);

    const enable = async () => {
        setPending(true);
        try {
            const result = await authClient.twoFactor.enable({ password: password() });
            if (result.error || !result.data) throw new Error(result.error?.message || 'No se pudo iniciar el enrolamiento MFA');
            setSetup(result.data);
            toast.info('Escanea el URI TOTP y confirma el código generado por tu aplicación.');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo habilitar MFA');
        } finally {
            setPending(false);
        }
    };

    const verify = async () => {
        setPending(true);
        try {
            await profileApi.verifyMfa(code());
            setEnabled(true);
            setSetup(null);
            setCode('');
            toast.success('MFA habilitado correctamente');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'El código MFA no es válido');
        } finally {
            setPending(false);
        }
    };

    const disable = async () => {
        setPending(true);
        try {
            const result = await authClient.twoFactor.disable({ password: password() });
            if (result.error) throw new Error(result.error.message || 'No se pudo deshabilitar MFA');
            setEnabled(false);
            setPassword('');
            toast.success('MFA deshabilitado');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo deshabilitar MFA');
        } finally {
            setPending(false);
        }
    };

    return (
        <section class="mt-8 pt-6 border-t border-border/60 space-y-4">
            <div>
                <h2 class="text-lg font-semibold text-heading mb-1">Autenticación multifactor</h2>
                <p class="text-sm text-muted">Protege la cuenta con una aplicación TOTP y códigos de recuperación.</p>
            </div>

            <label class="block text-sm text-muted">
                Contraseña actual
                <input
                    type="password"
                    autocomplete="current-password"
                    value={password()}
                    onInput={(event) => setPassword(event.currentTarget.value)}
                    class="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
            </label>

            <Show
                when={!enabled()}
                fallback={<Button onClick={disable} disabled={pending() || !password()} loading={pending()}>Deshabilitar MFA</Button>}
            >
                <Button onClick={enable} disabled={pending() || !password()} loading={pending()}>Iniciar configuración MFA</Button>
            </Show>

            <Show when={setup()}>
                {(pendingSetup) => (
                    <div class="space-y-3 rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm">
                        <p class="font-medium text-heading">Guarda los códigos de recuperación una sola vez:</p>
                        <code class="block break-all whitespace-pre-wrap text-xs">{pendingSetup().backupCodes.join('\n')}</code>
                        <p class="text-muted">URI TOTP para tu autenticador:</p>
                        <code class="block break-all text-xs">{pendingSetup().totpURI}</code>
                        <div class="flex gap-2 items-end">
                            <label class="flex-1 text-sm text-muted">
                                Código TOTP
                                <input
                                    inputmode="numeric"
                                    autocomplete="one-time-code"
                                    value={code()}
                                    onInput={(event) => setCode(event.currentTarget.value)}
                                    class="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                                />
                            </label>
                            <Button onClick={verify} disabled={pending() || code().length < 6} loading={pending()}>Confirmar</Button>
                        </div>
                    </div>
                )}
            </Show>
        </section>
    );
};
