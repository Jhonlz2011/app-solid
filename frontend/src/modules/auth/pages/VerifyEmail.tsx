import { type Component, createSignal, onMount, onCleanup, createEffect, Switch, Match } from 'solid-js';
import { useSearch, useNavigate } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { authClient } from '@shared/lib/auth-client';
import { actions, useAuth } from '../store/auth.store';
import Button from '@form/Button';
import { MailIcon } from '@icons/MailIcon';
import { CheckIcon } from '@icons/CheckIcon';
import { LogoutIcon } from '@icons/LogoutIcon';

/**
 * VerifyEmail — 4-state component using a finite state machine pattern.
 *
 * States:
 *   waiting   → No token in URL. User sees "check your inbox" + resend button.
 *   verifying → Token present, API call in-flight. Shows spinner.
 *   verified  → Email confirmed (via token POST or SSE from another device). Shows success + redirect.
 *   error     → Token was invalid/expired. Falls back to waiting UI so user can resend.
 *
 * Countdown:
 *   Backend enforces a 60s cooldown via Redis TTL. Frontend mirrors it with a reactive
 *   countdown stored in sessionStorage to survive page refresh.
 */
type VerifyStatus = 'waiting' | 'verifying' | 'verified' | 'error';

const COOLDOWN_STORAGE_KEY = 'resend_cooldown_until';

const VerifyEmail: Component = () => {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const auth = useAuth();

  const [status, setStatus] = createSignal<VerifyStatus>('waiting');
  const [resending, setResending] = createSignal(false);
  const [countdown, setCountdown] = createSignal(0);

  const token = () => (search() as { token?: string })?.token;

  // ── Timers cleanup ─────────────────────────────────────────────────────
  let redirectTimer: ReturnType<typeof setTimeout> | undefined;
  let countdownInterval: ReturnType<typeof setInterval> | undefined;
  onCleanup(() => {
    clearTimeout(redirectTimer);
    clearInterval(countdownInterval);
  });

  // ── Countdown logic ────────────────────────────────────────────────────
  const startCountdown = (seconds: number) => {
    clearInterval(countdownInterval);
    const until = Date.now() + seconds * 1000;
    sessionStorage.setItem(COOLDOWN_STORAGE_KEY, String(until));
    setCountdown(seconds);

    countdownInterval = setInterval(() => {
      setCountdown(prev => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(countdownInterval);
          sessionStorage.removeItem(COOLDOWN_STORAGE_KEY);
          return 0;
        }
        return next;
      });
    }, 1000);
  };

  // Restore countdown from sessionStorage on mount (survives page refresh) or start initial 60s cooldown
  onMount(() => {
    const until = sessionStorage.getItem(COOLDOWN_STORAGE_KEY);
    if (until) {
      const remaining = Math.ceil((parseInt(until) - Date.now()) / 1000);
      if (remaining > 0) {
        startCountdown(remaining);
      } else {
        sessionStorage.removeItem(COOLDOWN_STORAGE_KEY);
      }
    } else if (!token()) {
      startCountdown(60);
    }
  });

  // ── Redirect helper ────────────────────────────────────────────────────
  const redirectAfterSuccess = async () => {
    // Better-Auth autoSignInAfterVerification sets the session cookie.
    // If not authenticated in-memory, hydrate session from the active cookie.
    if (!auth.isAuthenticated()) {
      await actions.initSession().catch(() => {});
    }

    redirectTimer = setTimeout(() => {
      if (auth.isAuthenticated()) {
        navigate({ to: '/dashboard', replace: true });
      } else {
        navigate({ to: '/login', search: { redirect: undefined }, replace: true });
      }
    }, 2000);
  };

  // ── Token verification (direct link click) ─────────────────────────────
  onMount(async () => {
    const currentToken = token();
    if (!currentToken) return;

    setStatus('verifying');
    try {
      const res = await authClient.verifyEmail({ query: { token: currentToken } });
      if (res.error) throw new Error(res.error.message || 'Error verificando el correo');

      setStatus('verified');
      toast.success('¡Correo electrónico verificado con éxito!');
      redirectAfterSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Error en la verificación');
      setStatus('error');
    }
  });

  // ── SSE: cross-device verification listener ────────────────────────────
  createEffect(() => {
    const user = auth.user();
    const s = status();
    if ((s === 'waiting' || s === 'error') && user?.emailVerifiedAt) {
      setStatus('verified');
      toast.success('¡Cuenta verificada exitosamente!');
      redirectAfterSuccess();
    }
  });

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resending() || countdown() > 0) return;
    setResending(true);
    try {
      const user = auth.user();
      if (!user?.email) throw new Error('No hay correo registrado');
      const res = await authClient.sendVerificationEmail({
        email: user.email,
        callbackURL: '/verify-email',
      });
      if (res.error) throw new Error(res.error.message || 'Error al reenviar');

      toast.success('Se ha enviado un nuevo enlace de verificación a tu correo.');
      startCountdown(60);
    } catch (err: any) {
      toast.error(err.message || 'Error reenviando correo');
    } finally {
      setResending(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(COOLDOWN_STORAGE_KEY);
    actions.logout(true).then(() => navigate({ to: '/login', search: { redirect: undefined },  replace: true }));
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div class="h-screen flex items-center justify-center bg-bg p-4">
      <div class="w-full max-w-md p-8 bg-card border border-border shadow-card-soft rounded-2xl text-center transition-all duration-300">
        <Switch>
          {/* ── VERIFIED ─────────────────────────────────────────── */}
          <Match when={status() === 'verified'}>
            <div class="flex flex-col items-center py-6" role="status">
              <div class="size-16 bg-success/10 text-success rounded-full flex items-center justify-center mb-4 animate-bounce">
                <CheckIcon class="size-8" />
              </div>
              <h2 class="text-2xl font-bold text-heading">¡Cuenta Verificada!</h2>
              <p class="text-muted mt-2 text-sm">
                Tu correo ha sido confirmado. Redirigiéndote a la plataforma...
              </p>
            </div>
          </Match>

          {/* ── VERIFYING (spinner) ──────────────────────────────── */}
          <Match when={status() === 'verifying'}>
            <div class="flex flex-col items-center py-6" role="status" aria-label="Verificando cuenta">
              <div class="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <h2 class="text-2xl font-bold text-heading">Verificando tu cuenta</h2>
              <p class="text-muted mt-2 text-sm">
                Por favor, espera un momento mientras validamos tu enlace...
              </p>
            </div>
          </Match>

          {/* ── WAITING / ERROR (check inbox + resend + countdown) */}
          <Match when={status() === 'waiting' || status() === 'error'}>
            <div class="flex flex-col items-center">
              <div class="size-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
                <MailIcon class="size-8" />
              </div>
              <h2 class="text-2xl font-bold text-heading">Verifica tu correo electrónico</h2>
              <p class="text-muted mt-3 text-sm leading-relaxed">
                Hemos enviado un enlace de validación a la dirección de correo registrada.
                Por favor, revisa tu bandeja de entrada (y la carpeta de spam) para confirmar tu cuenta.
              </p>

              <div class="flex flex-col gap-3 w-full mt-8">
                <Button
                  onClick={handleResend}
                  loading={resending()}
                  loadingText="Reenviando..."
                  disabled={resending() || countdown() > 0}
                  icon={<MailIcon class="size-4" />}
                >
                  {countdown() > 0
                    ? `Reenviar en ${countdown()}s`
                    : 'Reenviar correo de verificación'
                  }
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  icon={<LogoutIcon class="size-4" />}
                >
                  Cerrar sesión
                </Button>
              </div>
            </div>
          </Match>
        </Switch>
      </div>
    </div>
  );
};

export default VerifyEmail;
