import { Component, onMount, Show, createSignal, For, type JSX } from 'solid-js';
import { toast } from 'solid-sonner';
import { useNavigate, useSearch } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { AuthLoginSchema, type AuthLoginDto } from '@app/schema/frontend';
import type { DiscoverTenantItemType, AuthUserResponseType } from '@app/schema/backend';
import { actions } from '@modules/auth/store/auth.store';
import { authApi } from '../api/auth.api';
import { useBranding, getSubdomain, applyBranding } from '../store/branding.store';
import { AuthError } from '@modules/auth/types/auth.types';
import Input from '@shared/ui/Input';
import Button from '@shared/ui/Button';
import Turnstile from '@shared/ui/Turnstile';
import { MailIcon, LockIcon, BuildingIcon } from '@shared/ui/icons';

const BASE_DOMAIN = import.meta.env.VITE_BASE_DOMAIN || 'zelys.app';

const getFieldError = (errors: unknown[]): string | undefined => {
    if (!errors.length) return undefined;
    const e = errors[0];
    if (typeof e === 'object' && e && 'message' in e) return (e as { message: string }).message;
    return String(e);
};

/** Progressive stagger delay for entrance animations */
const stagger = (index: number): JSX.CSSProperties => ({
  "animation-delay": `${index * 65}ms`,
  "animation-fill-mode": "both",
});

const Login: Component = () => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const branding = useBranding();

  const subdomain = getSubdomain();
  const isGlobalLogin = !subdomain;

  // UI state
  const [showTenants, setShowTenants] = createSignal(false);
  const [discoveredTenants, setDiscoveredTenants] = createSignal<DiscoverTenantItemType[]>([]);
  const [loadingTenants, setLoadingTenants] = createSignal(false);

  // Turnstile token state
  const [turnstileToken, setTurnstileToken] = createSignal<string | null>(null);

  onMount(() => actions.cleanupStaleSession());

  const handleRedirect = (slug: string, path: string) => {
    const host = window.location.hostname;
    const port = window.location.port;
    const protocol = window.location.protocol;

    const ipRegex = /^[0-9.]+$/;
    if (host === 'localhost' || ipRegex.test(host)) {
      const url = new URL(window.location.origin + path);
      url.searchParams.set('slug', slug);
      url.searchParams.set('session', 'true');
      window.location.href = url.toString();
    } else {
      const domainParts = host.split('.');
      const baseDomain = host.includes(BASE_DOMAIN) ? BASE_DOMAIN : domainParts.slice(-2).join('.');
      const portStr = port ? `:${port}` : '';
      const separator = path.includes('?') ? '&' : '?';
      window.location.href = `${protocol}//${slug}.${baseDomain}${portStr}${path}${separator}session=true`;
    }
  };

  const handleSelectTenant = async (tenant: DiscoverTenantItemType) => {
    setLoadingTenants(true);
    try {
      const tenantInfo = await authApi.getTenantInfo(tenant.slug);
      applyBranding(tenantInfo);
    } catch {
      // Non-critical: branding fallback is fine
    } finally {
      setLoadingTenants(false);
    }
    form.setFieldValue('companyId', tenant.id);
    form.handleSubmit();
  };

  const form = createForm(() => ({
    defaultValues: {
      email: '',
      password: '',
      companyId: undefined,
    } as AuthLoginDto,
    validatorAdapter: valibotValidator(),
    validators: { onSubmit: AuthLoginSchema },
    onSubmit: async ({ value }) => {
      try {
        const payload: { email: string; password: string; companyId?: number; turnstileToken?: string } = {
          email: value.email,
          password: value.password,
          turnstileToken: turnstileToken() ?? undefined,
        };

        if (value.companyId) {
          payload.companyId = value.companyId;
        } else if (!isGlobalLogin && branding.tenant()) {
          payload.companyId = branding.tenant()!.id;
        }

        const res = await actions.login(payload);

        if (res && 'requiresTenantSelection' in res && res.requiresTenantSelection) {
          setDiscoveredTenants(res.tenants);
          setShowTenants(true);
          return;
        }

        const successRes = res as { user: AuthUserResponseType & { companySlug?: string }; sessionId: string };
        const companySlug = successRes?.user?.companySlug;

        const searchParams = typeof search === 'function' ? search() : search;
        const redirectTo = (searchParams as any)?.redirect
            ?? new URLSearchParams(window.location.search).get('redirect');
        const safePath = typeof redirectTo === 'string' && redirectTo.startsWith('/')
            ? new URL(redirectTo, window.location.origin).pathname
            : '/dashboard';

        if (companySlug) {
          handleRedirect(companySlug, safePath);
        } else {
          navigate({ to: safePath, replace: true });
        }
      } catch (err) {
        setShowTenants(false);
        setDiscoveredTenants([]);
        form.setFieldValue('companyId', undefined);
        // Turnstile token stays valid for retries — only Turnstile itself invalidates it via expired-callback
        let msg = 'Error al iniciar sesión';
        if (err instanceof AuthError || err instanceof Error) msg = err.message;
        toast.error(msg);
      }
    },
  }));

  return (
    <div classList={{
      "w-full p-8 rounded-2xl transition-all duration-500": true,
      "bg-card/80 backdrop-blur-sm shadow-2xl ring-1 ring-white/10": !!branding.tenant()?.loginBgUrl,
      "bg-card border border-border shadow-lg": !branding.tenant()?.loginBgUrl,
    }}>
      {/* ── Logo / Brand ── */}
      <div class="@container mb-4">
        <div class="flex flex-col items-center @sm:flex-row @sm:items-center gap-4">
          {/* Logo */}
          <div class="shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-500" style={stagger(0)}>
            <Show
              when={branding.tenant()?.logoUrl}
              fallback={
                <div
                  class="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300 hover:scale-105"
                  style={{
                    "background": "linear-gradient(135deg, var(--primary, #1f86c2), color-mix(in srgb, var(--primary, #1f86c2) 65%, #000))",
                  }}
                >
                  <span class="text-white font-bold text-2xl drop-shadow-sm">
                    {(branding.tenant()?.tradeName || branding.tenant()?.businessName || 'Z').charAt(0).toUpperCase()}
                  </span>
                </div>
              }
            >
              <div class="w-16 h-16 rounded-2xl overflow-hidden shadow-lg transition-transform duration-300 hover:scale-105 ring-1 ring-border/50">
                <img
                  src={branding.tenant()?.logoUrl!}
                  alt={`Logo de ${branding.tenant()?.tradeName || branding.tenant()?.businessName || 'Zelys'}`}
                  class="w-full h-full object-contain"
                />
              </div>
            </Show>
          </div>

          {/* Title + subtitle */}
          <div class="flex flex-col items-center @sm:items-start min-w-0">
            <h2 class="text-2xl font-bold text-heading text-center @sm:text-left animate-in fade-in slide-in-from-bottom-2 duration-500" style={stagger(1)}>
              <Show when={branding.tenant()} fallback="Iniciar sesión">
                {branding.tenant()?.tradeName || branding.tenant()?.businessName}
              </Show>
            </h2>
            <p class="text-muted text-sm text-center @sm:text-left mt-1 animate-in fade-in slide-in-from-bottom-2 duration-500" style={stagger(2)}>
              <Show when={branding.tenant()} fallback="Ingresa tus credenciales para continuar">
                Portal Corporativo de Acceso
              </Show>
            </p>
          </div>
        </div>
      </div>

      {/* ── Decorative separator ── */}
      <div class="flex items-center gap-3 mb-6 animate-in fade-in duration-700" style={stagger(3)}>
        <div class="flex-1 h-px bg-linear-to-r from-transparent to-border" />
        <div class="w-1 h-1 rounded-full bg-border-strong" />
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
          class="flex flex-col gap-1"
          novalidate
        >
          <div class="animate-in fade-in slide-in-from-bottom-2 duration-500" style={stagger(4)}>
            <form.Field
              name="email"
              children={(field) => (
                <Input
                  id="login-email"
                  label="Usuario o correo electrónico"
                  type="text"
                  value={field().state.value}
                  onBlur={field().handleBlur}
                  onInput={(e) => field().handleChange(e.target.value)}
                  required
                  placeholder="nombre@empresa.com"
                  autocomplete="username"
                  error={getFieldError(field().state.meta.errors)}
                  leadingIcon={<MailIcon class="size-[18px]" />}
                />
              )}
            />
          </div>

          <div class="animate-in fade-in slide-in-from-bottom-2 duration-500" style={stagger(5)}>
            <form.Field
              name="password"
              children={(field) => (
                <Input
                  id="login-password"
                  label="Contraseña"
                  type="password"
                  value={field().state.value}
                  onBlur={field().handleBlur}
                  onInput={(e) => field().handleChange(e.target.value)}
                  required
                  placeholder="••••••••"
                  autocomplete="current-password"
                  error={getFieldError(field().state.meta.errors)}
                  leadingIcon={<LockIcon class="size-[18px]" />}
                />
              )}
            />
          </div>

          {/* Forgot password placeholder */}
          <div class="flex justify-end -mt-2 mb-1 animate-in fade-in duration-500" style={stagger(6)}>
            <a
              href="/forgot-password"
              class="text-xs text-muted hover:text-primary transition-colors duration-200"
              onClick={(e) => { e.preventDefault(); navigate({ to: '/forgot-password' }); }}
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          {/* Cloudflare Turnstile widget */}
          <div class="animate-in fade-in duration-500" style={stagger(7)}>
            <Turnstile
              onToken={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken(null)}
              onError={() => {
                setTurnstileToken(null);
                toast.error('Error al cargar la verificación de seguridad. Desactiva tu bloqueador de anuncios.');
                console.warn('[Login] Turnstile error — widget failed or will retry automatically');
              }}
            />
          </div>

          <div class="animate-in fade-in slide-in-from-bottom-2 duration-500" style={stagger(8)}>
            <form.Subscribe
              selector={(state) => ({ isSubmitting: state.isSubmitting })}
              children={(state) => (
                <Button
                  class="mt-1 w-full font-bold"
                  type="submit"
                  disabled={state().isSubmitting || !turnstileToken()}
                  loading={state().isSubmitting}
                  loadingText="Accediendo…"
                >
                  Iniciar sesión
                </Button>
              )}
            />
          </div>

          <Show when={!branding.tenant()}>
            <p class="text-sm text-muted text-center mt-2 animate-in fade-in duration-500" style={stagger(9)}>
              ¿No tienes cuenta?{' '}
              <a
                href="/register"
                class="text-primary hover:text-primary-strong hover:underline font-medium transition-colors duration-200"
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
        <div class="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <p class="text-sm text-muted font-medium mb-1">
            Tu usuario pertenece a varias empresas. Selecciona para continuar:
          </p>
          <div class="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            <For each={discoveredTenants()}>
              {(tenant) => (
                <button
                  type="button"
                  disabled={loadingTenants()}
                  onClick={() => handleSelectTenant(tenant)}
                  class="flex items-center gap-4 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/50 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div
                    class="w-11 h-11 rounded-lg flex items-center justify-center overflow-hidden shrink-0 transition-colors duration-300"
                    classList={{
                      "bg-primary/10 group-hover:bg-primary/20": !tenant.logoUrl,
                    }}
                  >
                    <Show
                      when={tenant.logoUrl}
                      fallback={<BuildingIcon class="size-5 text-primary" />}
                    >
                      <img src={tenant.logoUrl!} alt="Logo" class="w-full h-full object-contain" />
                    </Show>
                  </div>
                  <div class="grow min-w-0">
                    <h4 class="font-semibold text-heading truncate group-hover:text-primary transition-colors duration-300">
                      {tenant.tradeName || tenant.businessName}
                    </h4>
                    <p class="text-xs text-muted truncate">{tenant.slug}.zelys.app</p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 text-muted group-hover:text-primary transition-colors duration-300 shrink-0">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              )}
            </For>
          </div>

          <Button
            class="w-full mt-1"
            variant="outline"
            type="button"
            onClick={() => {
              setShowTenants(false);
              setDiscoveredTenants([]);
              form.setFieldValue('companyId', undefined);
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