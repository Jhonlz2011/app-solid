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

import { brandsApi } from '@modules/brands/data/brands.api';
import { warehousesApi } from '@modules/settings/data/warehouses.api';
import { categoriesApi } from '@modules/categories/data/categories.api';
import { locationsApi } from '@modules/locations/data/locations.api';
import { attributesApi } from '@modules/attributes/data/attributes.api';
import { uomApi } from '@modules/uom/data/uom.api';

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
      networkMode: 'online', // Hace que las consultas esperen conexión en lugar de fallar
    },
    mutations: {
      retry: 1,
      networkMode: 'online', // Pausa mutaciones cuando offline → se reanudan con resumePausedMutations()
    },
  },
});

// =============================================================================
// Mutation Defaults — Permite rehidratar mutationFn tras desconexión/recarga
// Las keys DEBEN coincidir exactamente con los mutationKey de cada hook
// =============================================================================

// Brands
queryClient.setMutationDefaults(['brands', 'create'], {
  mutationFn: (vars: any) => brandsApi.create(vars),
});
queryClient.setMutationDefaults(['brands', 'update'], {
  mutationFn: (vars: any) => brandsApi.update(vars.id, vars.data),
});

// Clients (usa eden directamente porque clients.api.ts inline lo hace)
queryClient.setMutationDefaults(['clients', 'create'], {
  mutationFn: async (vars: any) => {
    const { api } = await import('@shared/lib/eden');
    const { data, error } = await api.api.clients.post(vars);
    if (error) throw error;
    return data!;
  },
});
queryClient.setMutationDefaults(['clients', 'update'], {
  mutationFn: async (vars: any) => {
    const { api } = await import('@shared/lib/eden');
    const { data, error } = await api.api.clients({ id: vars.id }).put(vars.data);
    if (error) throw error;
    return data!;
  },
});

// Suppliers (misma estructura que clients)
queryClient.setMutationDefaults(['suppliers', 'create'], {
  mutationFn: async (vars: any) => {
    const { api } = await import('@shared/lib/eden');
    const { data, error } = await api.api.suppliers.post(vars);
    if (error) throw error;
    return data!;
  },
});
queryClient.setMutationDefaults(['suppliers', 'update'], {
  mutationFn: async (vars: any) => {
    const { api } = await import('@shared/lib/eden');
    const { data, error } = await api.api.suppliers({ id: vars.id }).put(vars.data);
    if (error) throw error;
    return data!;
  },
});

// Products
queryClient.setMutationDefaults(['products', 'create'], {
  mutationFn: async (vars: any) => {
    const { api } = await import('@shared/lib/eden');
    const { data, error } = await api.api.products.post(vars);
    if (error) throw error;
    return data!;
  },
});
queryClient.setMutationDefaults(['products', 'update'], {
  mutationFn: async (vars: any) => {
    const { api } = await import('@shared/lib/eden');
    const { data, error } = await api.api.products({ id: vars.id }).put(vars.data);
    if (error) throw error;
    return data!;
  },
});

// Categories
queryClient.setMutationDefaults(['catalogs', 'categories', 'create'], {
  mutationFn: (vars: any) => categoriesApi.create(vars),
});
queryClient.setMutationDefaults(['catalogs', 'categories', 'update'], {
  mutationFn: (vars: any) => categoriesApi.update(vars.id, vars.data),
});

// Locations
queryClient.setMutationDefaults(['locations', 'create'], {
  mutationFn: (vars: any) => locationsApi.create(vars),
});
queryClient.setMutationDefaults(['locations', 'update'], {
  mutationFn: (vars: any) => locationsApi.update(vars.id, vars.data),
});

// Attributes
queryClient.setMutationDefaults(['attributes', 'create'], {
  mutationFn: (vars: any) => attributesApi.create(vars),
});
queryClient.setMutationDefaults(['attributes', 'update'], {
  mutationFn: (vars: any) => attributesApi.update(vars.id, vars.data),
});

// UOM
queryClient.setMutationDefaults(['uom', 'create'], {
  mutationFn: (vars: any) => uomApi.create(vars),
});
queryClient.setMutationDefaults(['uom', 'update'], {
  mutationFn: (vars: any) => uomApi.update(vars.id, vars.data),
});

// Warehouses
queryClient.setMutationDefaults(['inventory', 'warehouses', 'create'], {
  mutationFn: (vars: any) => warehousesApi.create(vars),
});
queryClient.setMutationDefaults(['inventory', 'warehouses', 'update'], {
  mutationFn: (vars: any) => warehousesApi.update(vars.id, vars.data),
});

