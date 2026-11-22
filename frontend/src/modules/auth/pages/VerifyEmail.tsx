import { type Component, createSignal, onMount, onCleanup, createEffect, Switch, Match, Show } from 'solid-js';
import { useSearch, useNavigate } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { authClient } from '@shared/lib/auth-client';
import { actions, useAuth } from '../store/auth.store';
import { getFriendlyErrorMessage } from '@shared/utils/api-errors';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { broadcast, BroadcastEvents } from '@shared/store/broadcast.store';
import { isGlobalPortalHost, resolveSlugFromHost } from '@app/schema/utils';
import { resolvePostAuthRouting, executeAuthNavigation, invalidateOrgCache } from '../utils/resolve-routing';
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
  const [manualEmail, setManualEmail] = createSignal('');

  const token = () => (search() as { token?: string; email?: string })?.token;
  const searchEmail = () => (search() as { token?: string; email?: string })?.email || '';
  const targetEmail = () => auth.user()?.email || searchEmail() || manualEmail().trim();

  // ── Timers & Listeners cleanup ─────────────────────────────────────────
  let redirectTimer: ReturnType<typeof setTimeout> | undefined;
  let countdownInterval: ReturnType<typeof setInterval> | undefined;

  // Register cleanup unconditionally so timers are cleared even in the ?token= flow
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

  // ── Redirect helper ────────────────────────────────────────────────────
  const redirectAfterSuccess = async () => {
    invalidateOrgCache();
    // 1. Better-Auth autoSignInAfterVerification sets the session cookie.
    try {
      const orgList = await authClient.organization.list();
      if (orgList?.data && orgList.data.length === 1) {
        await authClient.organization.setActive({ organizationId: orgList.data[0].id });
      }
    } catch { /* Org already active or unavailable */ }

    // 2. Hydrate session in auth store
    const sessionRestored = await actions.initSession().catch(() => false);

    // 3. Clear verification cooldown
    sessionStorage.removeItem(COOLDOWN_STORAGE_KEY);

    redirectTimer = setTimeout(async () => {
      const currentUser = auth.user();
      if (sessionRestored && currentUser) {
        const isGlobal = isGlobalPortalHost(window.location.hostname);
        const currentSlug = resolveSlugFromHost(window.location.hostname);
        const decision = await resolvePostAuthRouting(currentUser, isGlobal, currentSlug, '/dashboard');
        const navigated = await executeAuthNavigation(decision, {
          safePath: '/dashboard',
          switchOrg: actions.switchOrganization,
        });
        if (!navigated) {
          navigate({ to: '/login', search: { redirect: undefined }, replace: true });
        }
      } else {
        navigate({ to: '/login', search: { redirect: undefined }, replace: true });
      }
    }, 1200);
  };

  // ── Token verification or auto-send on mount ───────────────────────────
  onMount(async () => {
    const currentToken = token();
    if (currentToken) {
      setStatus('verifying');
      try {
        const res = await authClient.verifyEmail({ query: { token: currentToken } });
        if (res.error) throw new Error(res.error.message || 'Error verificando el correo');

        // Cross-Tab notification: notify any other waiting tabs in this browser
        broadcast.emit(BroadcastEvents.EMAIL_VERIFIED, { verified: true }, { remoteOnly: true });
        broadcast.emit(BroadcastEvents.AUTH_LOGIN, { verified: true }, { remoteOnly: true });

        setStatus('verified');
        toast.success('¡Correo electrónico verificado con éxito!');
        await redirectAfterSuccess();
      } catch (err: any) {
        toast.error(getFriendlyErrorMessage(err, 'Error en la verificación del correo'));
        setStatus('error');
      }
      return;
    }

    // ── 1. SSE Realtime Event (Cross-Device: Mobile -> Desktop) ─────────────
    const handleSseVerified = () => {
      if (status() === 'waiting' || status() === 'error') {
        setStatus('verified');
        toast.success('¡Correo electrónico verificado con éxito!');
        redirectAfterSuccess();
      }
    };
    window.addEventListener(RealtimeEvents.USER.EMAIL_VERIFIED, handleSseVerified);

    // ── 2. BroadcastChannel Event (Cross-Tab: Tab B -> Tab A) ──────────────
    const unbindEmailVerified = broadcast.on(BroadcastEvents.EMAIL_VERIFIED, () => {
      if (status() === 'waiting' || status() === 'error') {
        setStatus('verified');
        toast.success('¡Correo verificado en otra pestaña!');
        redirectAfterSuccess();
      }
    });

    const unbindAuthLogin = broadcast.on(BroadcastEvents.AUTH_LOGIN, () => {
      if (status() === 'waiting' || status() === 'error') {
        setStatus('verified');
        redirectAfterSuccess();
      }
    });

    // ── 3. Tab Visibility Sync (Focus Recovery) ───────────────────────────
    const handleVisibilityChange = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && (status() === 'waiting' || status() === 'error')) {
        const hasSession = await actions.initSession().catch(() => false);
        const u = auth.user();
        if (hasSession && (u?.emailVerifiedAt || (u as any)?.emailVerified)) {
          setStatus('verified');
          toast.success('¡Cuenta verificada exitosamente!');
          redirectAfterSuccess();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    onCleanup(() => {
      clearTimeout(redirectTimer);
      clearInterval(countdownInterval);
      window.removeEventListener(RealtimeEvents.USER.EMAIL_VERIFIED, handleSseVerified);
      unbindEmailVerified();
      unbindAuthLogin();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    });

    // Sin token: revisar cooldown existente en sessionStorage
    const until = sessionStorage.getItem(COOLDOWN_STORAGE_KEY);
    if (until) {
      const remaining = Math.ceil((parseInt(until, 10) - Date.now()) / 1000);
      if (remaining > 0) {
        startCountdown(remaining);
        return;
      }
      sessionStorage.removeItem(COOLDOWN_STORAGE_KEY);
    }

    // Si no hay cooldown activo, auto-enviar correo de verificación si el usuario no está verificado
    const user = auth.user();
    if (user?.email && !user.emailVerified) {
      try {
        await authClient.sendVerificationEmail({
          email: user.email,
          callbackURL: '/verify-email',
        });
        toast.info(`Hemos enviado un enlace de verificación a ${user.email}`);
      } catch (err) {
        console.warn('[VerifyEmail] Error al auto-enviar verificación:', err);
      }
      startCountdown(60);
    } else {
      startCountdown(60);
    }
  });

  // ── Reactive state listener for auth user ──────────────────────────────
  createEffect(() => {
    const user = auth.user();
    const s = status();
    if ((s === 'waiting' || s === 'error') && (user?.emailVerifiedAt || (user as any)?.emailVerified)) {
      setStatus('verified');
      toast.success('¡Cuenta verificada exitosamente!');
      redirectAfterSuccess();
    }
  });

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resending() || countdown() > 0) return;
    const emailToSend = targetEmail();
    if (!emailToSend || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToSend)) {
      toast.error('Ingresa tu correo electrónico para reenviar el enlace de verificación');
      return;
    }

    setResending(true);
    try {
      const res = await authClient.sendVerificationEmail({
        email: emailToSend,
        callbackURL: '/verify-email',
      });
      if (res.error) throw new Error(res.error.message || 'Error al reenviar');

      toast.success('Se ha enviado un nuevo enlace de verificación a tu correo.');
      startCountdown(60);
    } catch (err: any) {
      toast.error(getFriendlyErrorMessage(err, 'Error al reenviar el correo'));
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
                <Show when={!auth.user()?.email && !searchEmail()}>
                  <input
                    type="email"
                    placeholder="Ingresa tu correo electrónico"
                    value={manualEmail()}
                    onInput={(e) => setManualEmail(e.currentTarget.value)}
                    class="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-surface text-heading placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </Show>

                <Button
                  onClick={handleResend}
                  loading={resending()}
                  loadingText="Reenviando..."
                  disabled={resending() || countdown() > 0 || !targetEmail()}
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
                  {auth.isAuthenticated() ? 'Cerrar sesión' : 'Volver al inicio de sesión'}
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
