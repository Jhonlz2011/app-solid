import { createSignal, onMount, onCleanup } from 'solid-js';

// Signal global para compartir el estado de red entre todos los componentes
const [isOnline, setIsOnline] = createSignal(typeof navigator !== 'undefined' ? navigator.onLine : true);

/**
 * Hook reactivo para obtener el estado actual de la conexión de red (online/offline).
 * Escucha los eventos globales del navegador y devuelve un Signal booleano.
 */
export function useOnlineStatus() {
  const handleOnline = () => setIsOnline(true);
  const handleOffline = () => setIsOnline(false);

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
}
