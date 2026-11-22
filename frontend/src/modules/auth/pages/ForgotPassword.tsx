import { Component, createSignal, Show } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { authClient } from '@shared/lib/auth-client';
import { getFriendlyErrorMessage } from '@shared/utils/api-errors';
import Button from '@form/Button';
import Turnstile from '@shared/ui/Turnstile';
import { MailIcon } from '@icons/MailIcon';
import { CheckIcon } from '@icons/CheckIcon';

const ForgotPassword: Component = () => {
  const navigate = useNavigate();

  const [email, setEmail] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [submitted, setSubmitted] = createSignal(false);
  const [turnstileToken, setTurnstileToken] = createSignal<string | null>(null);
  let turnstileActions: { reset: () => void } | undefined;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const cleanEmail = email().trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error('Ingresa un correo electrónico válido');
      return;
    }

    setSubmitting(true);
    try {
      const headers: Record<string, string> = {};
      if (turnstileToken()) {
        headers['x-turnstile-token'] = turnstileToken()!;
      }

      const res = await authClient.requestPasswordReset({
        email: cleanEmail,
        redirectTo: `${window.location.origin}/reset-password`,
        fetchOptions: { headers },
      });

      if (res.error) {
        throw new Error(getFriendlyErrorMessage(res.error, 'No se pudo procesar la solicitud'));
      }

      setSubmitted(true);
      toast.success('Si el correo está registrado, recibirás un enlace de recuperación.');
    } catch (err) {
      turnstileActions?.reset();
      setTurnstileToken(null);
      toast.error(getFriendlyErrorMessage(err, 'No se pudo enviar el correo de recuperación'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="w-full p-6 sm:p-8 bg-card border border-border rounded-2xl shadow-card">
      <Show
        when={!submitted()}
        fallback={
          <div class="flex flex-col items-center text-center py-4 gap-4">
            <div class="size-14 rounded-full bg-success/10 text-success flex items-center justify-center">
              <CheckIcon class="size-7" />
            </div>
            <div>
              <h1 class="text-xl font-bold text-heading">Revisa tu correo</h1>
              <p class="text-sm text-muted mt-1.5 leading-relaxed">
                Si existe una cuenta asociada a <strong>{email().trim()}</strong>, te hemos enviado un enlace seguro para restablecer tu contraseña.
              </p>
            </div>
            <Button
              variant="outline"
              fullWidth
              onClick={() => navigate({ to: '/login' })}
              class="mt-2"
            >
              Volver al inicio de sesión
            </Button>
          </div>
        }
      >
        <div class="mb-6">
          <h1 class="text-xl sm:text-2xl font-bold text-heading tracking-tight">Recuperar contraseña</h1>
          <p class="text-xs sm:text-sm text-muted mt-1">
            Ingresa tu correo electrónico y te enviaremos un enlace de un solo uso para crear una nueva contraseña.
          </p>
        </div>

        <form onSubmit={handleSubmit} class="flex flex-col gap-5" novalidate>
          <div class="flex flex-col gap-1.5">
            <label for="forgot-email" class="text-sm font-medium text-heading">
              Correo electrónico *
            </label>
            <div class="relative">
              <div class="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <MailIcon class="size-4 text-muted" />
              </div>
              <input
                id="forgot-email"
                type="email"
                required
                autocomplete="email"
                placeholder="nombre@empresa.com"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                disabled={submitting()}
                class="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-border bg-surface text-heading placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60"
              />
            </div>
          </div>

          <Turnstile
            action="forgot_password"
            ref={(act) => { turnstileActions = act; }}
            onToken={(tok) => setTurnstileToken(tok)}
            onExpire={() => setTurnstileToken(null)}
            onError={() => setTurnstileToken(null)}
          />

          <Button
            type="submit"
            fullWidth
            disabled={submitting() || !turnstileToken()}
            loading={submitting() || !turnstileToken()}
            loadingText={!turnstileToken() ? 'Verificando seguridad…' : 'Enviando enlace…'}
          >
            Enviar enlace de recuperación
          </Button>

          <p class="text-xs sm:text-sm text-muted text-center">
            ¿Recordaste tu contraseña?{' '}
            <a
              href="/login"
              class="text-primary hover:underline font-medium"
              onClick={(e) => { e.preventDefault(); navigate({ to: '/login' }); }}
            >
              Volver a iniciar sesión
            </a>
          </p>
        </form>
      </Show>
    </div>
  );
};

export default ForgotPassword;
