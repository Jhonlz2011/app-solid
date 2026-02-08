import { Component, createEffect } from 'solid-js';
import { toast } from 'solid-sonner';
import { useNavigate } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { AuthLoginSchema } from '@app/schema/frontend';
import { actions, useAuth } from '@modules/auth/store/auth.store';
import { AuthError } from '@modules/auth/types/auth.types';
import Input from '@shared/ui/Input';
import Button from '@shared/ui/Button';

const Login: Component = () => {
  const navigate = useNavigate();
  const auth = useAuth();

  // Redirect if already authenticated
  createEffect(() => {
    if (auth.isAuthenticated()) {
      navigate({ to: '/dashboard' });
    }
  });

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
        navigate({ to: '/dashboard' });
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
    <div class="min-h-screen flex items-center justify-center bg-bg text-text p-4">
      <div class="max-w-md w-full p-8 bg-card border border-border shadow-card-soft rounded-2xl shadow-lg">
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
                error={field().state.meta.errors.length ? (field().state.meta.errors[0] as any)?.message || field().state.meta.errors[0] : undefined}
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
                error={field().state.meta.errors.length ? (field().state.meta.errors[0] as any)?.message || field().state.meta.errors[0] : undefined}
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
    </div>
  );
};

export default Login;