import { Component, onMount, Show, createSignal, For } from 'solid-js';
import { toast } from 'solid-sonner';
import { useNavigate, useSearch } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { AuthLoginSchema } from '@app/schema/frontend';
import type { DiscoverTenantItemType, AuthUserResponseType } from '@app/schema/backend';
import { actions } from '@modules/auth/store/auth.store';
import { authApi } from '../api/auth.api';
import { useBranding, getSubdomain, applyBranding } from '../store/branding.store';
import { AuthError } from '@modules/auth/types/auth.types';
import Input from '@shared/ui/Input';
import Button from '@shared/ui/Button';
import Turnstile from '@shared/ui/Turnstile';

const BASE_DOMAIN = import.meta.env.VITE_BASE_DOMAIN || 'zelys.app';

const getFieldError = (errors: unknown[]): string | undefined => {
    if (!errors.length) return undefined;
    const e = errors[0];
    if (typeof e === 'object' && e && 'message' in e) return (e as { message: string }).message;
    return String(e);
};

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
      companyId: undefined as number | undefined,
    },
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
            ? redirectTo
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
        // Reset token on failure — widget will auto-refresh
        setTurnstileToken(null);
        let msg = 'Error al iniciar sesión';
        if (err instanceof AuthError || err instanceof Error) msg = err.message;
        toast.error(msg);
      }
    },
  }));

  return (
    <div class="w-full p-8 bg-card border border-border rounded-2xl shadow-lg transition-all duration-300">
      {/* Logo / Brand */}
      <div class="flex flex-col items-center mb-6">
        <Show
          when={branding.tenant()?.logoUrl}
          fallback={
            <div class="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-3 transition-transform duration-300 hover:scale-105">
              <span class="text-primary font-bold text-2xl">
                {(branding.tenant()?.tradeName || branding.tenant()?.businessName || 'Z').charAt(0).toUpperCase()}
              </span>
            </div>
          }
        >
          <img
            src={branding.tenant()?.logoUrl!}
            alt={`Logo de ${branding.tenant()?.tradeName || branding.tenant()?.businessName || 'Zelys'}`}
            class="max-h-14 object-contain mb-3 transition-transform duration-300 hover:scale-105"
          />
        </Show>

        <h2 class="text-2xl font-bold text-heading text-center">
          <Show when={branding.tenant()} fallback="Iniciar sesión">
            {branding.tenant()?.tradeName || branding.tenant()?.businessName}
          </Show>
        </h2>
        <p class="text-muted text-sm text-center mt-1">
          <Show when={branding.tenant()} fallback="Ingresa tus credenciales para continuar">
            Portal Corporativo de Acceso
          </Show>
        </p>
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
          class="flex flex-col gap-3"
          novalidate
        >
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
              />
            )}
          />

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
              />
            )}
          />

          {/* Cloudflare Turnstile widget */}
          <Turnstile
            onToken={(token) => setTurnstileToken(token)}
            onExpire={() => setTurnstileToken(null)}
            onError={() => {
              setTurnstileToken(null);
              console.warn('[Login] Turnstile error — widget will retry automatically');
            }}
          />

          <form.Subscribe
            selector={(state) => ({ isSubmitting: state.isSubmitting })}
            children={(state) => (
              <Button
                class="mt-1 w-full"
                type="submit"
                disabled={state().isSubmitting || !turnstileToken()}
                loading={state().isSubmitting}
                loadingText="Accediendo…"
              >
                Iniciar sesión
              </Button>
            )}
          />

          <Show when={!branding.tenant()}>
            <p class="text-sm text-muted text-center mt-2">
              ¿No tienes cuenta?{' '}
              <a
                href="/register"
                class="text-primary hover:underline font-medium"
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
        <div class="flex flex-col gap-3">
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
                  <div class="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden shrink-0 group-hover:bg-primary/20 transition-colors duration-300">
                    <Show
                      when={tenant.logoUrl}
                      fallback={
                        <span class="text-primary font-bold text-lg uppercase">
                          {(tenant.tradeName || tenant.businessName).charAt(0)}
                        </span>
                      }
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