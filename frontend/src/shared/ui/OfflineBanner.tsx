import { Component, Show, createSignal } from 'solid-js';
import { setOnlineStatus } from '@shared/hooks/useOnlineStatus';
import { toast } from 'solid-sonner';
import { usePendingMutations } from '@shared/hooks/usePendingMutations';

export const OfflineBanner: Component = () => {
  const [isChecking, setIsChecking] = createSignal(false);
  const pendingCount = usePendingMutations();

  const handleRetry = async () => {
    if (isChecking()) return;
    setIsChecking(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      await fetch(`${apiUrl}/api/health`, { method: 'HEAD', mode: 'no-cors' });
      setOnlineStatus(true);
      toast.success('Conexión restablecida. Sincronizando datos...');
    } catch {
      toast.warning('Aún sin conexión. Inténtalo de nuevo más tarde.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div 
      id="pwa-offline-banner"
      class="w-full bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400 px-4 py-2.5 flex items-center justify-between text-sm transition-all duration-300 animate-in fade-in slide-in-from-top-4"
    >
      <div class="flex items-center gap-2.5">
        <div class="flex items-center justify-center size-5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full shrink-0">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            class="size-3.5 animate-pulse" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            stroke-width="2.5"
          >
            <path 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>
        <span class="font-medium text-xs sm:text-sm">
          <strong>Modo sin conexión</strong>
          <Show
            when={pendingCount() > 0}
            fallback={<> — Navegando con datos en caché.</>}
          >
            {' — '}
            <span class="inline-flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
              </svg>
              <strong>{pendingCount()}</strong> operación{pendingCount() !== 1 ? 'es' : ''} pendiente{pendingCount() !== 1 ? 's' : ''} de sincronización.
            </span>
          </Show>
        </span>
      </div>
      <button 
        type="button" 
        onClick={handleRetry} 
        disabled={isChecking()}
        class="text-xs font-semibold underline hover:text-amber-800 dark:hover:text-amber-300 transition-colors cursor-pointer ml-4 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isChecking() ? 'Verificando...' : 'Reintentar'}
      </button>
    </div>
  );
};

export default OfflineBanner;
