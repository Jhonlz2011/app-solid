import { Component, onMount, Show } from 'solid-js';
import { toast } from 'solid-sonner';
import { useNavigate, useSearch } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { AuthLoginSchema } from '@app/schema/frontend';
import { actions } from '@modules/auth/store/auth.store';
import { useBranding } from '../store/branding.store';
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

  // Phase 2 of logout: clean up stale user/modules data.
  // By onMount, the old route's components (sidebar, layout) are fully unmounted,
  // so clearing user and modules here is guaranteed to be flash-free.
  onMount(() => actions.cleanupStaleSession());

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
        await actions.login({ email: value.email, password: value.password });

        // Read redirect from TanStack search params (signal accessor) or fallback to raw URL
        const searchParams = typeof search === 'function' ? search() : search;
        const redirectTo = (searchParams as any)?.redirect
            ?? new URLSearchParams(window.location.search).get('redirect');

        // Security: only allow relative paths (prevents open redirect)
        const safePath = typeof redirectTo === 'string' && redirectTo.startsWith('/')
            ? redirectTo
            : '/dashboard';
        navigate({ to: safePath, replace: true });
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
              <span class="text-primary font-bold text-2xl">Z</span>
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
          <Show when={branding.tenant()} fallback="Iniciar sesión">
            {branding.tenant()?.tradeName || branding.tenant()?.businessName}
          </Show>
        </h2>
        <p class="text-muted text-sm text-center">
          <Show when={branding.tenant()} fallback="Ingresa tus credenciales para continuar">
            Portal Corporativo de Acceso
          </Show>
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        class="flex flex-col gap-1"
        aria-labelledby="login-form"
        novalidate
      >
        <form.Field
          name="email"
          children={(field) => (
            <Input
              id="email"
              label="Usuario o correo electronico"
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
            <Button
              class="mt-2"
              type="submit"
              disabled={!state().isDirty || state().isSubmitting}
              loading={state().isSubmitting}
              loadingText="Accediendo…"
            >
              Iniciar sesión
            </Button>
          )}
        />

        <Show when={!branding.tenant()}>
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