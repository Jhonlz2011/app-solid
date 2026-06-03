import { onlineManager } from '@tanstack/solid-query';
import { toast } from 'solid-sonner';

/**
 * Verifica si estamos offline según TanStack Query's onlineManager.
 * Usar ANTES de llamar mutateAsync/mutate para decidir el flujo.
 */
export function isOffline(): boolean {
  return !onlineManager.isOnline();
}

/**
 * Muestra un toast informativo de "Guardado localmente" con ícono de nube.
 * Usar cuando una mutación se encola offline.
 */
export function showOfflineSavedToast() {
  toast.info('Guardado localmente', {
    description: 'Se sincronizará automáticamente al recuperar la conexión.',
    icon: '☁️',
  });
}
