import { createSignal, onCleanup } from 'solid-js';
import { queryClient } from '@shared/lib/queryClient';

/**
 * Hook reactivo que cuenta las mutaciones pausadas (offline) en tiempo real.
 * Escucha el MutationCache mediante subscribe() para actualizar automáticamente.
 */
export function usePendingMutations() {
  const getCount = () =>
    queryClient.getMutationCache().getAll().filter(m => m.state.isPaused).length;

  const [count, setCount] = createSignal(getCount());

  const unsubscribe = queryClient.getMutationCache().subscribe(() => {
    setCount(getCount());
  });

  onCleanup(unsubscribe);

  return count;
}
