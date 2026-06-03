import { createSignal, onMount, onCleanup } from 'solid-js';

/**
 * Hook reactivo para obtener el estado actual de la conexión de red (online/offline).
 * Escucha los eventos globales del navegador y devuelve un Signal booleano.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = createSignal(typeof navigator !== 'undefined' ? navigator.onLine : true);

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
