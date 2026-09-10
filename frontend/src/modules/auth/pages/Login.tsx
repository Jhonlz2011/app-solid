import { Component, onMount, Show, createSignal, For } from 'solid-js';
import { toast } from 'solid-sonner';
import { useNavigate, useSearch } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { AuthLoginSchema, type AuthLoginFormData } from '@app/schema/frontend';
import type { DiscoverTenantItemType } from '@app/schema/dto';
import { actions } from '@modules/auth/store/auth.store';
import { useBranding, getSubdomain } from '../store/branding.store';
import { getFriendlyErrorMessage } from '@shared/utils/api-errors';
import { buildTenantUrl, isGlobalPortalHost, resolveSlugFromHost } from '@app/schema/utils';
import { resolvePostAuthRouting, getSafeRedirectPath, executeAuthNavigation, fetchUserOrganizations, mapOrgToTenant } from '../utils/resolve-routing';
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
  const branding = useBranding();

  const subdomain = getSubdomain();

  // UI state
  const [showTenants, setShowTenants] = createSignal(false);
  const [discoveredTenants, setDiscoveredTenants] = createSignal<DiscoverTenantItemType[]>([]);
  const [loadingTenants, setLoadingTenants] = createSignal(false);

  // Turnstile token state
  const [turnstileToken, setTurnstileToken] = createSignal<string | null>(null);

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    if (errorParam) {
      toast.error(getFriendlyErrorMessage(errorParam, 'Error al autenticar con el proveedor social'));
    }

    // If authenticated user enters portal login -> show tenant selector
    const { useAuth } = await import('@modules/auth/store/auth.store');
    const auth = useAuth();
    if (auth.isAuthenticated()) {
      const orgs = await fetchUserOrganizations();
      if (orgs.length > 0) {
        const isGlobal = isGlobalPortalHost(window.location.hostname);
        const currentSlug = resolveSlugFromHost(window.location.hostname);
        if (!isGlobal && currentSlug && !orgs.some(o => o.slug === currentSlug)) {
          toast.error(`No tienes acceso a ${currentSlug}. Selecciona una de tus empresas:`);
        }
        setDiscoveredTenants(orgs.map(mapOrgToTenant));
        setShowTenants(true);
      }
    }
  });

  const handleSelectTenant = async (tenant: DiscoverTenantItemType) => {
    setLoadingTenants(true);
    try {
      await actions.switchOrganization(tenant.organizationId);
      const safePath = getSafeRedirectPath(search);
      window.location.href = buildTenantUrl(tenant.slug, safePath, {
        queryParams: { session: 'true' },
      });
    } catch (err: any) {
      toast.error(err?.message || 'Error al seleccionar empresa');
    } finally {
      setLoadingTenants(false);
    }
  };

  const initialEmail = () => {
    const searchParams = typeof search === 'function' ? search() : search;
    return (searchParams as any)?.email
      || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('email') || '' : '');
  };

  const form = createForm(() => ({
    defaultValues: {
      email: initialEmail(),
      password: '',
    } as AuthLoginFormData,
    validators: { onSubmit: AuthLoginSchema },
    onSubmit: async ({ value }) => {
      try {
        const res = await actions.login({
          email: value.email,
          password: value.password,
        });

        const safePath = getSafeRedirectPath(search);
        const isGlobal = isGlobalPortalHost(window.location.hostname);
        const currentSlug = resolveSlugFromHost(window.location.hostname);
        const decision = await resolvePostAuthRouting(res.user, isGlobal, currentSlug, safePath);

        const navigated = await executeAuthNavigation(decision, {
          safePath,
          switchOrg: actions.switchOrganization,
        });

        if (!navigated) {
          if (decision.action === 'no-access') {
            toast.error(`No tienes acceso a ${decision.currentSlug}. Selecciona una de tus empresas:`);
          }
          if ('tenants' in decision) {
            setDiscoveredTenants(decision.tenants);
            setShowTenants(true);
          }
        }
      } catch (err) {
        setShowTenants(false);
        setDiscoveredTenants([]);
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
      <div class="flex flex-col items-center @sm:flex-row gap-4 mb-6">
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
      <div class="flex items-center gap-3 mb-6">
        <div class="flex-1 h-px bg-linear-to-r from-transparent to-border" />
        <div class="size-1 rounded-full bg-border-strong" />
        <div class="flex-1 h-px bg-linear-to-l from-transparent to-border" />
      </div>

      {/* ── Main Login Form ── */}
      <Show when={!showTenants()}>
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
              <TextField.Root field={field()} class="pb-1">
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
              <TextField.Root field={field()} class="pb-1">
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
                <TextField.ErrorMessage />
              </TextField.Root>
            )}
          </form.Field>

          {/* Cloudflare Turnstile */}
          <Turnstile
            class="-mt-5 pt-5"
            action="login"
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
            redirectPath={
              (() => {
                const searchParams = typeof search === 'function' ? search() : search;
                const redirectTo = (searchParams as any)?.redirect
                  ?? new URLSearchParams(window.location.search).get('redirect');
                return typeof redirectTo === 'string' && redirectTo.startsWith('/') ? redirectTo : '/dashboard';
              })()
            }
          />

          <Show when={!branding.tenant()}>
            <p class="text-xs @sm:text-sm text-muted text-center pt-2">
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