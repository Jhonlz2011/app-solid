import { Component, onMount } from 'solid-js';
import { toast } from 'solid-sonner';
import { useNavigate, useSearch } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { AuthLoginSchema } from '@app/schema/frontend';
import { actions } from '@modules/auth/store/auth.store';
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
    <div class="w-full p-8 bg-card border border-border shadow-card-soft rounded-2xl shadow-lg">
      <h2 class="text-3xl font-bold mb-2 text-dark">Iniciar sesión</h2>
      <p class="text-muted text-sm mb-6">Ingresa tus credenciales para continuar</p>

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

        <div class="text-sm text-muted mt-2 text-center">
          ¿Problemas para ingresar? Contacta al administrador.
        </div>
      </form>
    </div>
  );
};

export default Login;