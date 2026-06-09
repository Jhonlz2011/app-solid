import { Component, onMount, Show, createSignal, For } from 'solid-js';
import { toast } from 'solid-sonner';
import { useNavigate, useSearch } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { AuthLoginSchema } from '@app/schema/frontend';
import type { DiscoverTenantItemType } from '@app/schema/backend';
import { actions } from '@modules/auth/store/auth.store';
import { authApi } from '../api/auth.api';
import { useBranding, getSubdomain, applyBranding } from '../store/branding.store';
import { AuthError } from '@modules/auth/types/auth.types';
import Input from '@shared/ui/Input';
import Button from '@shared/ui/Button';

// Extract field error without `as any`
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

  const [step, setStep] = createSignal<'email' | 'tenants' | 'password'>(isGlobalLogin ? 'email' : 'password');
  const [discoveredTenants, setDiscoveredTenants] = createSignal<DiscoverTenantItemType[]>([]);
  const [selectedTenant, setSelectedTenant] = createSignal<DiscoverTenantItemType | null>(null);
  const [loadingTenants, setLoadingTenants] = createSignal(false);

  // Phase 2 of logout: clean up stale user/modules data.
  // By onMount, the old route's components (sidebar, layout) are fully unmounted,
  // so clearing user and modules here is guaranteed to be flash-free.
  onMount(() => actions.cleanupStaleSession());

  const handleRedirect = (slug: string, path: string) => {
    const host = window.location.hostname;
    const port = window.location.port;
    const protocol = window.location.protocol;
    
    const ipRegex = /^[0-9.]+$/;
    if (host === 'localhost' || ipRegex.test(host)) {
      // In development: use query param slug
      const url = new URL(window.location.origin + path);
      url.searchParams.set('slug', slug);
      url.searchParams.set('session', 'true');
      window.location.href = url.toString();
    } else {
      // In production or wildcard subdomains: use subdomain prefix
      const domainParts = host.split('.');
      let baseDomain = 'zelys.app';
      if (host.includes('zelys.app')) {
        baseDomain = 'zelys.app';
      } else {
        baseDomain = domainParts.slice(-2).join('.');
      }
      
      const portStr = port ? `:${port}` : '';
      const separator = path.includes('?') ? '&' : '?';
      const pathWithSession = `${path}${separator}session=true`;
      const finalUrl = `${protocol}//${slug}.${baseDomain}${portStr}${pathWithSession}`;
      window.location.href = finalUrl;
    }
  };

  const handleNextStep = async () => {
    const emailValue = form.getFieldValue('email');
    if (!emailValue || emailValue.trim() === '') {
      toast.error('Por favor, ingresa tu usuario o correo.');
      return;
    }
    
    setLoadingTenants(true);
    try {
      const tenants = await authApi.discoverTenants(emailValue);
      setDiscoveredTenants(tenants);
      
      if (!tenants || tenants.length === 0) {
        toast.error('No se encontraron empresas activas asociadas a este correo.');
      } else if (tenants.length === 1) {
        const tenant = tenants[0];
        setSelectedTenant(tenant);
        
        // Cargar y aplicar branding dinámico para el inquilino único
        try {
          const tenantInfo = await authApi.getTenantInfo(tenant.slug);
          applyBranding(tenantInfo);
        } catch (brandingErr) {
          console.warn('No se pudo cargar el branding del tenant:', brandingErr);
        }
        
        setStep('password');
      } else {
        setStep('tenants');
      }
    } catch (err) {
      let msg = 'Error al buscar empresas';
      if (err instanceof AuthError || err instanceof Error) {
        msg = err.message;
      }
      toast.error(msg);
    } finally {
      setLoadingTenants(false);
    }
  };

  const handleSelectTenant = async (tenant: DiscoverTenantItemType) => {
    setSelectedTenant(tenant);
    setLoadingTenants(true);
    try {
      // Cargar y aplicar branding dinámico para el inquilino seleccionado
      const tenantInfo = await authApi.getTenantInfo(tenant.slug);
      applyBranding(tenantInfo);
      setStep('password');
    } catch (err) {
      console.warn('No se pudo cargar el branding del tenant:', err);
      // Even if branding fails, we proceed to password step
      setStep('password');
    } finally {
      setLoadingTenants(false);
    }
  };

  const handleBack = () => {
    if (step() === 'password') {
      if (discoveredTenants().length > 1) {
        setStep('tenants');
      } else {
        setStep('email');
        setDiscoveredTenants([]);
        setSelectedTenant(null);
      }
      applyBranding(null);
    } else if (step() === 'tenants') {
      setStep('email');
      setDiscoveredTenants([]);
      setSelectedTenant(null);
      applyBranding(null);
    }
  };

  const form = createForm(() => ({
    defaultValues: {
      email: '',
      password: '',
    },
    validatorAdapter: valibotValidator(),
    validators: {
      onSubmit: AuthLoginSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const payload: { email: string; password: string; companyId?: number } = {
          email: value.email,
          password: value.password,
        };
        if (isGlobalLogin && selectedTenant()) {
          payload.companyId = selectedTenant()!.id;
        }

        await actions.login(payload);

        // Read redirect from TanStack search params (signal accessor) or fallback to raw URL
        const searchParams = typeof search === 'function' ? search() : search;
        const redirectTo = (searchParams as any)?.redirect
            ?? new URLSearchParams(window.location.search).get('redirect');

        // Security: only allow relative paths (prevents open redirect)
        const safePath = typeof redirectTo === 'string' && redirectTo.startsWith('/')
            ? redirectTo
            : '/dashboard';

        if (isGlobalLogin && selectedTenant()) {
          const slug = selectedTenant()!.slug;
          handleRedirect(slug, safePath);
        } else {
          navigate({ to: safePath, replace: true });
        }
      } catch (err) {
        let msg = 'Error al iniciar sesión';
        if (err instanceof AuthError || err instanceof Error) {
          msg = err.message;
        }
        toast.error(msg);
      }
    },
  }));

  return (
    <div class="w-full p-8 bg-card border border-border shadow-card-soft rounded-2xl shadow-lg transition-all duration-300">
      {/* Sección del Logotipo Dinámico */}
      <div class="flex flex-col items-center mb-6">
        <Show 
          when={branding.tenant()?.logoUrl} 
          fallback={
            <div class="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 hover:scale-105">
              <span class="text-primary font-bold text-2xl">
                <Show when={selectedTenant()} fallback="Z">
                  {(() => {
                    const tenant = selectedTenant();
                    if (!tenant) return 'Z';
                    return (tenant.tradeName || tenant.businessName || 'Z').charAt(0);
                  })()}
                </Show>
              </span>
            </div>
          }
        >
          <img 
            src={branding.tenant()?.logoUrl!} 
            alt="Logo Empresa" 
            class="max-h-16 object-contain mb-4 transition-transform duration-300 hover:scale-105"
          />
        </Show>
        
        <h2 class="text-3xl font-bold mb-1 text-heading text-center">
          <Show 
            when={branding.tenant()} 
            fallback={
              <Show when={selectedTenant()} fallback="Iniciar sesión">
                {(() => {
                  const tenant = selectedTenant();
                  return tenant ? (tenant.tradeName || tenant.businessName) : '';
                })()}
              </Show>
            }
          >
            {branding.tenant()?.tradeName || branding.tenant()?.businessName}
          </Show>
        </h2>
        <p class="text-muted text-sm text-center">
          <Show when={branding.tenant() || selectedTenant()} fallback="Ingresa tus credenciales para continuar">
            Portal Corporativo de Acceso
          </Show>
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (step() === 'email') {
            handleNextStep();
          } else if (step() === 'password') {
            form.handleSubmit();
          }
        }}
        class="flex flex-col gap-1"
        aria-labelledby="login-form"
        novalidate
      >
        {/* Step 1: Email Input */}
        <Show when={step() === 'email'}>
          <form.Field
            name="email"
            children={(field) => (
              <Input
                id="email"
                label="Usuario o correo electrónico"
                type="text"
                value={field().state.value}
                onBlur={field().handleBlur}
                onInput={(e) => field().handleChange(e.target.value)}
                required
                placeholder="nombre de usuario o correo"
                autocomplete="username"
                error={getFieldError(field().state.meta.errors)}
              />
            )}
          />

          <Button
            class="mt-4 w-full"
            type="submit"
            loading={loadingTenants()}
            loadingText="Buscando empresas…"
          >
            Siguiente
          </Button>
        </Show>

        {/* Step 2: Tenant Selector */}
        <Show when={step() === 'tenants'}>
          <div class="flex flex-col gap-3 my-4">
            <p class="text-sm text-muted mb-1 font-medium">Selecciona la empresa para acceder:</p>
            <div class="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
              <For each={discoveredTenants()}>
                {(tenant) => (
                  <button
                    type="button"
                    onClick={() => handleSelectTenant(tenant)}
                    class="flex items-center gap-4 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/50 text-left transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-md cursor-pointer group"
                  >
                    <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0 group-hover:bg-primary/20 transition-colors duration-300">
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
                    
                    <div class="flex-grow min-w-0">
                      <h4 class="font-semibold text-heading truncate group-hover:text-primary transition-colors duration-300">
                        {tenant.tradeName || tenant.businessName}
                      </h4>
                      <p class="text-xs text-muted truncate">
                        {tenant.slug}.zelys.app
                      </p>
                    </div>
                    
                    <div class="text-muted group-hover:text-primary transition-colors duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </div>

          <Button
            class="w-full mt-2"
            variant="outline"
            type="button"
            onClick={handleBack}
          >
            Regresar
          </Button>
        </Show>

        {/* Step 3: Password Input */}
        <Show when={step() === 'password'}>
          {/* Si es login global, mostramos un badge del usuario e inquilino seleccionado */}
          <Show when={isGlobalLogin && selectedTenant()}>
            <div class="flex flex-col gap-2 p-3 bg-muted/30 rounded-xl mb-4 border border-border">
              <div class="flex justify-between items-center text-xs text-muted">
                <span>Accediendo a:</span>
                <button 
                  type="button" 
                  onClick={handleBack} 
                  class="text-primary hover:underline font-semibold"
                >
                  Cambiar
                </button>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  <Show
                    when={selectedTenant()?.logoUrl}
                    fallback={
                      <span class="text-primary font-bold text-xs uppercase">
                        {(() => {
                          const tenant = selectedTenant();
                          return tenant ? (tenant.tradeName || tenant.businessName || 'Z').charAt(0) : 'Z';
                        })()}
                      </span>
                    }
                  >
                    <img src={selectedTenant()?.logoUrl || undefined} alt="Logo" class="w-full h-full object-contain" />
                  </Show>
                </div>
                <span class="text-sm font-semibold text-heading truncate">
                  {selectedTenant()?.tradeName || selectedTenant()?.businessName || ''}
                </span>
              </div>
              <div class="border-t border-border/50 pt-2 flex justify-between items-center">
                <span class="text-xs text-muted">Usuario:</span>
                <span class="text-xs font-medium text-heading truncate max-w-[200px]">
                  {form.getFieldValue('email')}
                </span>
              </div>
            </div>
          </Show>

          {/* Form fields */}
          {/* Si no es global, mostramos el email también. Si es global, lo dejamos oculto */}
          <Show 
            when={!isGlobalLogin}
            fallback={
              <form.Field
                name="email"
                children={(field) => (
                  <input
                    type="hidden"
                    name="email"
                    value={field().state.value}
                  />
                )}
              />
            }
          >
            <form.Field
              name="email"
              children={(field) => (
                <Input
                  id="email"
                  label="Usuario o correo electrónico"
                  type="text"
                  value={field().state.value}
                  onBlur={field().handleBlur}
                  onInput={(e) => field().handleChange(e.target.value)}
                  required
                  placeholder="nombre de usuario o correo"
                  autocomplete="username"
                  error={getFieldError(field().state.meta.errors)}
                />
              )}
            />
          </Show>

          <form.Field
            name="password"
            children={(field) => (
              <Input
                id="password"
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

          <form.Subscribe
            selector={(state) => ({
              isSubmitting: state.isSubmitting,
              isDirty: state.isDirty,
            })}
            children={(state) => (
              <div class="flex flex-col gap-2 mt-2">
                <Button
                  type="submit"
                  disabled={!state().isDirty || state().isSubmitting}
                  loading={state().isSubmitting}
                  loadingText="Accediendo…"
                >
                  Iniciar sesión
                </Button>
                
                <Show when={isGlobalLogin}>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={handleBack}
                    disabled={state().isSubmitting}
                  >
                    Regresar
                  </Button>
                </Show>
              </div>
            )}
          />
        </Show>

        <Show when={!branding.tenant() && !selectedTenant()}>
          <div class="text-sm text-muted mt-4 text-center">
            ¿No tienes cuenta?{' '}
            <a href="/register" class="text-primary hover:underline font-medium"
               onClick={(e) => { e.preventDefault(); navigate({ to: '/register' }); }}>
              Regístrate
            </a>
          </div>
        </Show>
      </form>
    </div>
  );
};

export default Login;