import { QueryClient, QueryCache, MutationCache } from '@tanstack/solid-query';
import { get, set, del } from 'idb-keyval';
import { actions as authActions } from '@modules/auth/store/auth.store';

// Helper to check for 401s from Eden clients
const isUnauthorizedError = (error: any) => {
  return error?.status === 401 || 
         (typeof error?.message === 'string' && error.message.includes('401'));
};

// Global Error Handler for both Queries and Mutations
const handleGlobalError = (error: any) => {
  if (isUnauthorizedError(error)) {
    console.warn('[TanStack Query] Global 401 Unauthorized detected. Forcing logout...');
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      authActions.logout(false);
      window.location.href = '/login';
    }
  }
};

// Configurar persister con IndexedDB para usar con PersistQueryClientProvider
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
  queryCache: new QueryCache({
    onError: handleGlobalError,
  }),
  mutationCache: new MutationCache({
    onError: handleGlobalError,
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Do not retry 401s, fast-fail to trigger logout
        if (isUnauthorizedError(error)) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      staleTime: 10 * 60 * 1000, 
      gcTime: 24 * 60 * 60 * 1000, 
    },
    mutations: {
      retry: 0,
    },
  },
});
