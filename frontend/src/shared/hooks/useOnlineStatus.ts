import { createSignal, onMount, onCleanup } from 'solid-js';
import { onlineManager } from '@tanstack/solid-query';
import { queryClient } from '@shared/lib/queryClient';
import { toast } from 'solid-sonner';

// Signal global para compartir el estado de red entre todos los componentes
const [isOnline, setIsOnline] = createSignal(typeof navigator !== 'undefined' ? navigator.onLine : true);

/**
 * Hook reactivo para obtener el estado actual de la conexión de red (online/offline).
 * Escucha los eventos globales del navegador y devuelve un Signal booleano.
 */
export function useOnlineStatus() {
  const handleOnline = () => {
    setIsOnline(true);
    onlineManager.setOnline(true);

    // Contar mutaciones pausadas antes de reanudar
    const pausedCount = queryClient
      .getMutationCache()
      .getAll()
      .filter(m => m.state.isPaused).length;

    if (pausedCount > 0) {
      const toastId = toast.loading(
        `Sincronizando ${pausedCount} operación${pausedCount !== 1 ? 'es' : ''} pendiente${pausedCount !== 1 ? 's' : ''}...`
      );
      queryClient.resumePausedMutations().then(() => {
        queryClient.invalidateQueries();
        toast.success('Todo sincronizado correctamente', { id: toastId, duration: 3000 });
      }).catch(() => {
        toast.error('Algunas operaciones no pudieron sincronizarse', { id: toastId, duration: 5000 });
      });
    } else {
      // No hay mutaciones pausadas, solo refrescar datos
      queryClient.invalidateQueries();
    }
  };
  const handleOffline = () => {
    setIsOnline(false);
    onlineManager.setOnline(false);
  };

  onMount(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }
  });

  onCleanup(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  });

  return isOnline;
}

/**
 * Permite cambiar el estado de conexión desde interceptores de red (p. ej., Eden Fetcher).
 */
export function setOnlineStatus(online: boolean) {
  setIsOnline(online);
  onlineManager.setOnline(online);
}
