import { Component, onMount, Show, createSignal, For } from 'solid-js';
import { toast } from 'solid-sonner';
import { useNavigate, useSearch, useRouteContext } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { AuthLoginSchema, type AuthLoginFormData } from '@app/schema/frontend';
import type { DiscoverTenantItemType } from '@app/schema/dto';
import { actions } from '@modules/auth/store/auth.store';
import { authApi } from '../api/auth.api';
import { useBranding, getSubdomain } from '../store/branding.store';
import { getFriendlyErrorMessage } from '@shared/utils/api-errors';
import { isGlobalPortalHost, resolveSlugFromHost } from '@app/schema/utils';
import { resolvePostAuthRouting, getSafeRedirectPath, executeAuthNavigation, buildHandoffTargetUrl } from '../utils/resolve-routing';
import TextField from '@form/TextField';
import Button from '@form/Button';
import Turnstile from '@shared/ui/Turnstile';
import OAuthButtons from '../components/OAuthButtons';
import { MailIcon } from '@icons/MailIcon';
import { LockIcon } from '@icons/LockIcon';
import { BuildingIcon } from '@icons/BuildingIcon';

const Login: Component = () => {
  const navigate = useNavigate();
  const search = useSearch({ from: '/auth-layout/login' });
  const context = useRouteContext({ from: '/auth-layout/login' });
  const branding = useBranding();

  const subdomain = getSubdomain();

  // UI state
  const [showTenants, setShowTenants] = createSignal(false);
  const [discoveredTenants, setDiscoveredTenants] = createSignal<DiscoverTenantItemType[]>([]);
  const [loadingTenants, setLoadingTenants] = createSignal(false);

  // Two-factor challenge state
  const [twoFactorRequired, setTwoFactorRequired] = createSignal(false);
  const [twoFactorMode, setTwoFactorMode] = createSignal<'totp' | 'backup'>('totp');
  const [twoFactorCode, setTwoFactorCode] = createSignal('');
  const [trustDevice, setTrustDevice] = createSignal(false);
  const [verifyingTwoFactor, setVerifyingTwoFactor] = createSignal(false);

  // Turnstile token state
  const [turnstileToken, setTurnstileToken] = createSignal<string | null>(null);
  let turnstileActions: { reset: () => void } | undefined;

  onMount(() => {
    // 1. Reactive check for OAuth error passed in search params (H-01)
    const searchParams = search();
    const errorParam = searchParams?.error;
    if (errorParam) {
      toast.error(getFriendlyErrorMessage(errorParam, 'Acceso denegado a este inquilino.'));
      navigate({
        to: '/login',
        search: (prev: any) => {
          const next = { ...prev };
          delete next.error;
          delete next.error_description;
          return next;
        },
        replace: true,
      });
    }

    // 2. Consume postAuthDecision evaluated by authRoute.beforeLoad (H-02 deduplication)
    const postAuth = context()?.postAuthDecision;

    if (postAuth) {
      if (postAuth.action === 'no-access') {
        toast.error('Acceso denegado a este inquilino.');
      }
      if ('tenants' in postAuth && Array.isArray(postAuth.tenants) && postAuth.tenants.length > 0) {
        setDiscoveredTenants(postAuth.tenants);
        setShowTenants(true);
      }
    }
  });

  const handleSelectTenant = async (tenant: DiscoverTenantItemType) => {
    setLoadingTenants(true);
    try {
      const safePath = getSafeRedirectPath(search());
      const handoff = await authApi.requestTenantHandoff(tenant.organizationId, tenant.slug);
      window.location.href = buildHandoffTargetUrl(handoff.redirectUrl, safePath);
    } catch (err: any) {
      toast.error(err?.message || 'Error al seleccionar empresa');
    } finally {
      setLoadingTenants(false);
    }
  };

  const completePostLoginNavigation = async (user: { companySlug?: string | null }) => {
    const safePath = getSafeRedirectPath(search());
    const isGlobal = isGlobalPortalHost(window.location.hostname);
    const currentSlug = resolveSlugFromHost(window.location.hostname);
    const decision = await resolvePostAuthRouting(user, isGlobal, currentSlug, safePath);

    const navigated = await executeAuthNavigation(decision, {
      safePath,
      switchOrg: actions.switchOrganization,
    });

    if (!navigated) {
      if (decision.action === 'no-access') {
        toast.error('Acceso denegado a este inquilino.');
      }
      if ('tenants' in decision && decision.tenants.length > 0) {
        setDiscoveredTenants(decision.tenants);
        setShowTenants(true);
      }
    }
  };

  const handleTwoFactorSubmit = async (e: Event) => {
    e.preventDefault();
    const code = twoFactorCode().trim();
    if (!code) {
      toast.error(twoFactorMode() === 'backup' ? 'Ingresa un código de respaldo' : 'Ingresa el código de 6 dígitos');
      return;
    }

    setVerifyingTwoFactor(true);
    try {
      const res = await actions.completeTwoFactorLogin({
        code,
        mode: twoFactorMode(),
        trustDevice: trustDevice(),
      });
      setTwoFactorRequired(false);
      setTwoFactorCode('');
      await completePostLoginNavigation(res.user);
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, 'Código de verificación inválido'));
    } finally {
      setVerifyingTwoFactor(false);
    }
  };

  const initialEmail = () => {
    return search()?.email || '';
  };

  const form = createForm(() => ({
    defaultValues: {
      email: initialEmail(),
      password: '',
    } as AuthLoginFormData,
    validators: {
      onChange: AuthLoginSchema,
      onSubmit: AuthLoginSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const res = await actions.login({
          email: value.email,
          password: value.password,
          turnstileToken: turnstileToken(),
        });

        if (res.requiresTwoFactor) {
          setTwoFactorRequired(true);
          setTwoFactorMode('totp');
          setTwoFactorCode('');
          toast.info('Ingresa el código de tu aplicación de autenticación para continuar.');
          return;
        }

        await completePostLoginNavigation(res.user);
      } catch (err) {
        setShowTenants(false);
        setDiscoveredTenants([]);
        setTurnstileToken(null);
        turnstileActions?.reset();
        toast.error(getFriendlyErrorMessage(err, 'Error al iniciar sesión'));
      }
    },
  }));

  return (
    <div
      class="@container w-full p-6 sm:p-8 rounded-2xl transition-all duration-300"
      classList={{
        "bg-card/80 backdrop-blur-md shadow-2xl ring-1 ring-white/10": !!branding.tenant()?.loginBgUrl,
        "bg-card border border-border shadow-card": !branding.tenant()?.loginBgUrl,
      }}
    >
      {/* ── Logo / Brand ── */}
      <div class="flex flex-col items-center @sm:flex-row gap-4 mb-3">
        <div class="shrink-0">
          <Show
            when={branding.tenant()?.logoUrl}
            fallback={
              <Show
                when={branding.tenant()}
                fallback={
                  <div class="size-16 rounded-2xl overflow-hidden ring-1 ring-border/50 bg-primary/5 flex items-center justify-center p-2.5 transition-transform hover:scale-105 duration-300">
                    <img
                      src="/icons/logo-blank-192x192.png"
                      alt="Zelys"
                      class="size-full object-contain"
                    />
                  </div>
                }
              >
                <div class="size-16 rounded-2xl flex items-center justify-center shadow-md bg-primary transition-transform hover:scale-105 duration-300">
                  <span class="text-white font-bold text-2xl drop-shadow-sm">
                    {(branding.tenant()?.tradeName || branding.tenant()?.businessName || 'Z').charAt(0).toUpperCase()}
                  </span>
                </div>
              </Show>
            }
          >
            <div class="size-14 rounded-2xl overflow-hidden shadow-md ring-1 ring-border/50 p-1 bg-card-alt flex items-center justify-center transition-transform hover:scale-105 duration-300">
              <img
                src={branding.tenant()?.logoUrl!}
                alt={`Logo de ${branding.tenant()?.tradeName || branding.tenant()?.businessName || 'Zelys'}`}
                class="size-full object-contain"
              />
            </div>
          </Show>
        </div>

        {/* Title + subtitle */}
        <div class="text-center @sm:text-left min-w-0">
          <h1 class="text-xl sm:text-2xl font-bold text-heading tracking-tight">
            {branding.tenant()?.tradeName || branding.tenant()?.businessName || 'Iniciar sesión'}
          </h1>
          <p class="text-xs sm:text-sm text-muted mt-0.5">
            {branding.tenant() ? 'Portal Corporativo de Acceso' : 'Ingresa tus credenciales para continuar'}
          </p>
        </div>
      </div>

      {/* ── Decorative separator ── */}
      <div class="flex items-center gap-3 mb-3">
        <div class="flex-1 h-px bg-linear-to-r from-transparent to-border" />
        <div class="size-1 rounded-full bg-border-strong" />
        <div class="flex-1 h-px bg-linear-to-l from-transparent to-border" />
      </div>

      {/* ── Main Login Form ── */}
      <Show when={!showTenants() && !twoFactorRequired()}>
        <form
          id="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          class="flex flex-col gap-5"
          novalidate
        >
          {/* Email */}
          <form.Field name="email">
            {(field) => (
              <TextField.Root field={field} class="pb-1">
                <TextField.Label>Usuario o correo electrónico *</TextField.Label>
                <TextField.Input
                  id="login-email"
                  type="text"
                  class="py-2"
                  required
                  placeholder="nombre@empresa.com"
                  autocomplete="username"
                  leftIcon={<MailIcon class="size-4 text-muted" />}
                />
                <TextField.ErrorMessage />
              </TextField.Root>
            )}
          </form.Field>

          {/* Password with "¿Olvidaste tu contraseña?" on the label row */}
          <form.Field name="password">
            {(field) => (
              <TextField.Root field={field} class="pb-1">
                <TextField.Label
                  badge={
                    <a
                      href="/forgot-password"
                      class="text-xs text-muted hover:text-primary transition-colors select-none"
                      onClick={(e) => { e.preventDefault(); navigate({ to: '/forgot-password' }); }}
                    >
                      ¿Olvidaste tu contraseña?
                    </a>
                  }
                >
                  Contraseña *
                </TextField.Label>
                <TextField.PasswordInput
                  id="login-password"
                  class="py-2"
                  required
                  placeholder="••••••••"
                  autocomplete="current-password"
                  leftIcon={<LockIcon class="size-4 text-muted" />}
                />
                <TextField.ErrorMessage/>
              </TextField.Root>
            )}
          </form.Field>

          {/* Cloudflare Turnstile */}
          <Turnstile
            class="-mt-5 pt-4"
            action="login"
            ref={(act) => { turnstileActions = act; }}
            onToken={(token) => setTurnstileToken(token)}
            onExpire={() => setTurnstileToken(null)}
            onError={() => {
              setTurnstileToken(null);
              toast.error('Error en la verificación de seguridad. Desactiva tu bloqueador de anuncios.');
              console.warn('[Login] Turnstile error — widget failed or will retry automatically');
            }}
          />

          {/* Submit Button */}
          <form.Subscribe
            selector={(state) => ({ isSubmitting: state.isSubmitting })}
            children={(state) => (
              <Button
                type="submit"
                fullWidth
                size="md"
                class="font-semibold cursor-pointer"
                disabled={state().isSubmitting || !turnstileToken()}
                loading={state().isSubmitting || !turnstileToken()}
                loadingText={!turnstileToken() ? "Verificando seguridad…" : "Accediendo…"}
              >
                Iniciar sesión
              </Button>
            )}
          />

          {/* ── OAuth Social Providers ── */}
          <div class="relative flex items-center justify-center my-1">
            <div class="grow border-t border-border" />
            <span class="px-3 text-xs text-muted font-medium uppercase tracking-wider bg-card">o continúa con</span>
            <div class="grow border-t border-border" />
          </div>

          <OAuthButtons
            redirectPath={getSafeRedirectPath(search())}
          />

          <Show when={!branding.tenant()}>
            <p class="text-xs @sm:text-sm text-muted text-center">
              ¿No tienes cuenta?{' '}
              <a
                href="/register"
                class="text-primary hover:text-primary-strong hover:underline font-medium transition-colors"
                onClick={(e) => { e.preventDefault(); navigate({ to: '/register' }); }}
              >
                Regístrate
              </a>
            </p>
          </Show>
        </form>
      </Show>

      {/* ── Two-Factor Challenge (TOTP / Backup Code) ── */}
      <Show when={twoFactorRequired() && !showTenants()}>
        <form onSubmit={handleTwoFactorSubmit} class="flex flex-col gap-4 animate-in fade-in duration-300" novalidate>
          <div>
            <h3 class="text-base font-semibold text-heading">Verificación en dos pasos (2FA)</h3>
            <p class="text-xs text-muted mt-0.5">
              {twoFactorMode() === 'totp'
                ? 'Ingresa el código de 6 dígitos generado por tu aplicación de autenticación.'
                : 'Ingresa uno de tus códigos de respaldo de un solo uso.'}
            </p>
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="login-2fa-code" class="text-xs font-medium text-heading">
              {twoFactorMode() === 'totp' ? 'Código de autenticación *' : 'Código de respaldo *'}
            </label>
            <input
              id="login-2fa-code"
              type="text"
              inputMode={twoFactorMode() === 'totp' ? 'numeric' : 'text'}
              autocomplete="one-time-code"
              placeholder={twoFactorMode() === 'totp' ? '000000' : 'xxxxx-xxxxx'}
              value={twoFactorCode()}
              onInput={(e) => setTwoFactorCode(e.currentTarget.value)}
              disabled={verifyingTwoFactor()}
              class="w-full px-3.5 py-2.5 text-center text-base tracking-widest font-mono rounded-xl border border-border bg-surface text-heading placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60"
            />
          </div>

          <label class="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={trustDevice()}
              onChange={(e) => setTrustDevice(e.currentTarget.checked)}
              class="rounded border-border text-primary focus:ring-primary/30"
            />
            Confiar en este dispositivo durante 30 días
          </label>

          <Button
            type="submit"
            fullWidth
            loading={verifyingTwoFactor()}
            loadingText="Verificando código…"
          >
            Verificar y continuar
          </Button>

          <div class="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              class="text-primary hover:underline cursor-pointer"
              onClick={() => {
                setTwoFactorMode(prev => (prev === 'totp' ? 'backup' : 'totp'));
                setTwoFactorCode('');
              }}
            >
              {twoFactorMode() === 'totp' ? 'Usar código de respaldo' : 'Usar código de la app'}
            </button>

            <button
              type="button"
              class="text-muted hover:text-heading cursor-pointer"
              onClick={() => {
                setTwoFactorRequired(false);
                setTwoFactorCode('');
                setTurnstileToken(null);
                turnstileActions?.reset();
              }}
            >
              Volver
            </button>
          </div>
        </form>
      </Show>

      {/* ── Tenant Selector (post-auth multi-empresa) ── */}
      <Show when={showTenants()}>
        <div class="flex flex-col gap-4 animate-in fade-in duration-300">
          <div>
            <h3 class="text-base font-semibold text-heading">Selecciona una empresa</h3>
            <p class="text-xs text-muted mt-0.5">
              Tu usuario pertenece a varias organizaciones. Selecciona para continuar:
            </p>
          </div>

          <div class="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            <For each={discoveredTenants()}>
              {(tenant) => (
                <button
                  type="button"
                  disabled={loadingTenants()}
                  onClick={() => handleSelectTenant(tenant)}
                  class="flex items-center gap-3.5 p-3 rounded-xl border border-border bg-card-alt hover:bg-card hover:border-primary/50 text-left transition-all duration-200 hover:shadow-sm cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div
                    class="size-10 rounded-lg flex items-center justify-center overflow-hidden shrink-0 transition-colors"
                    classList={{
                      "bg-primary/10 group-hover:bg-primary/20": !tenant.logoUrl,
                    }}
                  >
                    <Show
                      when={tenant.logoUrl}
                      fallback={<BuildingIcon class="size-5 text-primary" />}
                    >
                      <img src={tenant.logoUrl!} alt="Logo" class="size-full object-contain" />
                    </Show>
                  </div>
                  <div class="grow min-w-0">
                    <h4 class="text-sm font-semibold text-heading truncate group-hover:text-primary transition-colors">
                      {tenant.tradeName || tenant.businessName}
                    </h4>
                    <p class="text-xs text-muted truncate">{tenant.slug}.zelys.app</p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="size-4 text-muted group-hover:text-primary transition-colors shrink-0">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              )}
            </For>
          </div>

          <Button
            variant="outline"
            fullWidth
            type="button"
            onClick={() => {
              setShowTenants(false);
              setDiscoveredTenants([]);
            }}
          >
            Regresar
          </Button>
        </div>
      </Show>
    </div>
  );
};

export default Login;
