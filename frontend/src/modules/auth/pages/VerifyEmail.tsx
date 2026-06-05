import { Component, createSignal, onMount, Show } from 'solid-js';
import { useSearch, useNavigate } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { api } from '@shared/lib/eden';
import { actions, useAuth } from '../store/auth.store';
import Button from '@shared/ui/Button';

const VerifyEmail: Component = () => {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const auth = useAuth();
  
  const [verifying, setVerifying] = createSignal(false);
  const [verified, setVerified] = createSignal(false);
  const [resending, setResending] = createSignal(false);
  
  const token = () => (search() as any)?.token;

  onMount(async () => {
    // Si la URL contiene un token, procesar la verificación inmediatamente
    const currentToken = token();
    if (currentToken) {
      setVerifying(true);
      try {
        const { error } = await api.api.auth['verify-email'].post({ token: currentToken });
        if (error) throw new Error(error.value?.message || 'Error verificando el correo');
        
        setVerified(true);
        toast.success('¡Correo electrónico verificado con éxito!');
        
        // Esperar 2.5s para mostrar animación de éxito y redirigir
        setTimeout(() => {
          if (auth.isAuthenticated()) {
            actions.refreshSession().then(() => navigate({ to: '/dashboard', replace: true }));
          } else {
            navigate({ to: '/login', replace: true });
          }
        }, 2500);
      } catch (err: any) {
        toast.error(err.message || 'Error en la verificación');
        setVerifying(false);
      }
    }
  });

  const handleResend = async () => {
    setResending(true);
    try {
      const { error } = await api.api.auth['resend-verification'].post({});
      if (error) throw new Error(error.value?.message || 'Error al reenviar');
      toast.success('Se ha enviado un nuevo enlace de verificación a tu correo.');
    } catch (err: any) {
      toast.error(err.message || 'Error reenviando correo');
    } finally {
      setResending(false);
    }
  };

  const handleLogout = () => {
    actions.logout(true).then(() => navigate({ to: '/login', replace: true }));
  };

  return (
    <div class="h-screen flex items-center justify-center bg-bg p-4">
      <div class="w-full max-w-md p-8 bg-card border border-border shadow-card-soft rounded-2xl text-center transition-all duration-300">
        
        <Show when={token()}>
          {/* VISTA DE VERIFICACIÓN ACTIVA */}
          <Show when={verified()} fallback={
            <div class="flex flex-col items-center py-6">
              <div class="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <h2 class="text-2xl font-bold text-heading">Verificando tu cuenta</h2>
              <p class="text-muted mt-2 text-sm">Por favor, espera un momento mientras validamos tu enlace...</p>
            </div>
          }>
            <div class="flex flex-col items-center py-6">
              <div class="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mb-4 text-3xl animate-bounce">✓</div>
              <h2 class="text-2xl font-bold text-heading">¡Cuenta Verificada!</h2>
              <p class="text-muted mt-2 text-sm">Tu correo ha sido confirmado. Redirigiéndote a la plataforma...</p>
            </div>
          </Show>
        </Show>

        <Show when={!token()}>
          {/* VISTA DE ESPERA DE VERIFICACIÓN */}
          <div class="flex flex-col items-center">
            <div class="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6 text-3xl">✉</div>
            <h2 class="text-2xl font-bold text-heading">Verifica tu correo electrónico</h2>
            <p class="text-muted mt-3 text-sm leading-relaxed">
              Hemos enviado un enlace de validación a la dirección de correo registrada. 
              Por favor, revisa tu bandeja de entrada (y la carpeta de spam) para confirmar tu cuenta.
            </p>
            
            <div class="flex flex-col gap-3 w-full mt-8">
              <Button
                onClick={handleResend}
                loading={resending()}
                disabled={resending()}
              >
                Reenviar correo de verificación
              </Button>
              
              <button
                onClick={handleLogout}
                class="text-sm text-muted hover:text-danger font-medium transition-colors py-2 cursor-pointer"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </Show>

      </div>
    </div>
  );
};

export default VerifyEmail;
