import { QueryClient } from '@tanstack/solid-query';
import { PersistQueryClientProvider } from '@tanstack/solid-query-persist-client';
import { get, set, del } from 'idb-keyval';

// Crear persister con IndexedDB para usar con PersistQueryClientProvider
export const persister = {
  persistClient: async (client: any) => {
    await set('tanstack-query-cache', client);
  },
  restoreClient: async () => {
    return await get('tanstack-query-cache');
  },
  removeClient: async () => {
    await del('tanstack-query-cache');
  },
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 10 * 60 * 1000, // 10 minutos para mejor cache
      gcTime: 24 * 60 * 60 * 1000, // Mantener en cache 24 horas
    },
    mutations: {
      retry: 0,
    },
  },
});

