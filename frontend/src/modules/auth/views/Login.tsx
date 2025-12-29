// frontend/src/modules/auth/views/Login.tsx
import { Component, createSignal, Show, createEffect } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { actions, useAuth } from '@modules/auth/auth.store';
import { AuthError } from '@modules/auth/models/auth.types';
import Input from '@shared/components/ui/Input';
import Button from '@shared/components/ui/Button';

const Login: Component = () => {
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [isPending, setIsPending] = createSignal(false);
  const navigate = useNavigate();
  const auth = useAuth();

  // Redirect if already authenticated
  createEffect(() => {
    if (auth.isAuthenticated()) {
      navigate({ to: '/dashboard' });
    }
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);

    if (!email() || !password()) {
      return;
    }

    setIsPending(true);
    try {
      await actions.login({ email: email(), password: password() });
      navigate({ to: '/dashboard' });
    } catch (err) {
      if (err instanceof AuthError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Error al iniciar sesión. Por favor, intenta de nuevo.');
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div class="min-h-screen flex items-center justify-center app-shell p-4">
      <div class="max-w-md w-full p-8 card-panel rounded-2xl shadow-lg">
        <h2 class="text-3xl font-bold text-white mb-2">Iniciar sesión</h2>
        <p class="text-muted text-sm mb-6">Ingresa tus credenciales para continuar</p>

        <form onSubmit={handleSubmit} class="flex flex-col gap-5" aria-labelledby="login-form" novalidate>
          <Input
            id="email"
            label="Email"
            type="email"
            value={email()}
            onInput={e => setEmail(e.currentTarget.value)}
            required
            placeholder="you@example.com"
            autocomplete="email"
            disabled={isPending()}
          />

          <Input
            id="password"
            label="Contraseña"
            type="password"
            value={password()}
            onInput={e => setPassword(e.currentTarget.value)}
            required
            placeholder="••••••••"
            autocomplete="current-password"
            disabled={isPending()}
          />

          <Button type="submit" disabled={isPending() || !email() || !password()}>
            <Show when={isPending()} fallback={<span>Iniciar sesión</span>}>
              <span class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Accediendo…
              </span>
            </Show>
          </Button>

          <Show when={error()}>
            <div role="alert" class="text-red-400 text-sm mt-2 p-3 bg-red-900/20 border border-red-800 rounded-lg">
              {error()}
            </div>
          </Show>

          <div class="text-sm text-muted mt-2 text-center">
            ¿Problemas para ingresar? Contacta al administrador.
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;