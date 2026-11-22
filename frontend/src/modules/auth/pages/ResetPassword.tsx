import { Component, createSignal, Show, For } from 'solid-js';
import { useNavigate, useSearch } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { authClient } from '@shared/lib/auth-client';
import { getFriendlyErrorMessage } from '@shared/utils/api-errors';
import Button from '@form/Button';
import { LockIcon } from '@icons/LockIcon';

const PasswordStrength: Component<{ password: string }> = (props) => {
  const strength = () => {
    const p = props.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };
  const label = () => ['', 'Débil', 'Regular', 'Buena', 'Fuerte'][strength()];
  const color = () => ['bg-border', 'bg-danger', 'bg-warning', 'bg-primary', 'bg-success'][strength()];
  return (
    <Show when={props.password}>
      <div class="flex items-center gap-2 mt-1 px-1">
        <div class="flex-1 flex gap-1">
          <For each={[0, 1, 2, 3]}>{(i) => (
            <div class={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < strength() ? color() : 'bg-border'}`} />
          )}</For>
        </div>
        <span class="text-xs text-muted font-medium">{label()}</span>
      </div>
    </Show>
  );
};

const ResetPassword: Component = () => {
  const navigate = useNavigate();
  const search = useSearch({ from: '/auth-layout/reset-password' });

  const searchParams = () => (typeof search === 'function' ? search() : search);
  const token = () => searchParams()?.token || '';

  const [password, setPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const currentToken = token();
    if (!currentToken) {
      toast.error('El enlace de recuperación es inválido o incompleto');
      return;
    }

    const pwd = password();
    if (pwd.length < 8 || pwd.length > 128) {
      toast.error('La contraseña debe tener entre 8 y 128 caracteres');
      return;
    }
    if (pwd !== confirmPassword()) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authClient.resetPassword({
        newPassword: pwd,
        token: currentToken,
      });

      if (res.error) {
        throw new Error(getFriendlyErrorMessage(res.error, 'El enlace expiró o es inválido'));
      }

      toast.success('¡Contraseña actualizada correctamente! Inicia sesión con tu nueva contraseña.');
      navigate({ to: '/login', replace: true });
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, 'No se pudo restablecer la contraseña'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="w-full p-6 sm:p-8 bg-card border border-border rounded-2xl shadow-card">
      <div class="mb-6">
        <h1 class="text-xl sm:text-2xl font-bold text-heading tracking-tight">Restablecer contraseña</h1>
        <p class="text-xs sm:text-sm text-muted mt-1">
          Elige una nueva contraseña segura. Todas tus sesiones anteriores se cerrarán automáticamente.
        </p>
      </div>

      <Show
        when={Boolean(token())}
        fallback={
          <div class="text-center py-6 space-y-4">
            <div class="size-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto text-xl font-bold">
              ✕
            </div>
            <p class="text-sm text-muted">
              El enlace de recuperación no es válido o ha expirado. Solicita uno nuevo.
            </p>
            <Button variant="outline" fullWidth onClick={() => navigate({ to: '/forgot-password' })}>
              Solicitar nuevo enlace
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} class="flex flex-col gap-4" novalidate>
          <div class="flex flex-col gap-1.5">
            <label for="reset-password" class="text-sm font-medium text-heading">
              Nueva contraseña *
            </label>
            <div class="relative">
              <div class="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <LockIcon class="size-4 text-muted" />
              </div>
              <input
                id="reset-password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autocomplete="new-password"
                placeholder="Mínimo 8 caracteres"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                disabled={submitting()}
                class="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-border bg-surface text-heading placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60"
              />
            </div>
            <PasswordStrength password={password()} />
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="reset-confirm-password" class="text-sm font-medium text-heading">
              Confirmar contraseña *
            </label>
            <div class="relative">
              <div class="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <LockIcon class="size-4 text-muted" />
              </div>
              <input
                id="reset-confirm-password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autocomplete="new-password"
                placeholder="Repite tu nueva contraseña"
                value={confirmPassword()}
                onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                disabled={submitting()}
                class="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-border bg-surface text-heading placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60"
              />
            </div>
          </div>

          <Button
            type="submit"
            fullWidth
            loading={submitting()}
            loadingText="Actualizando contraseña…"
            class="mt-2"
          >
            Guardar nueva contraseña
          </Button>
        </form>
      </Show>
    </div>
  );
};

export default ResetPassword;
