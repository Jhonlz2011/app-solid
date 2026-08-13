import { api } from '@shared/lib/eden';
import { createEntityQueries } from '@modules/entities/data/entities.queries';
import { clientsApi } from './clients.api';
import { clientKeys } from './clients.keys';
import { createQuery } from '@tanstack/solid-query';

const baseQueries = createEntityQueries(clientsApi, clientKeys, api.api.clients.facets);

export const clientQueries = {
    ...baseQueries,
    
    // SRI specific queries
    useSriSearchByRuc: (ruc: () => string | undefined) => {
        return createQuery(() => ({
            queryKey: [...clientKeys.all, 'sri', 'ruc', ruc()],
            queryFn: () => clientsApi.sriSearchByRuc(ruc()!),
            enabled: !!ruc() && ruc()!.length >= 10,
            staleTime: 1000 * 60 * 60 * 24, // 24 hours (SRI data doesn't change often)
            gcTime: 1000 * 60 * 60 * 24,
            retry: 1,
        }));
    },

    useSriSearchByName: (name: () => string | undefined) => {
        return createQuery(() => ({
            queryKey: [...clientKeys.all, 'sri', 'name', name()],
            queryFn: () => clientsApi.sriSearchByName(name()!),
            enabled: !!name() && name()!.length > 3,
            staleTime: 1000 * 60 * 60 * 24,
            gcTime: 1000 * 60 * 60 * 24,
            retry: 1,
        }));
    }
};

export const useClients = clientQueries.useList;
export const useInfiniteClients = clientQueries.useInfinite;
export const useClientFacets = clientQueries.useFacets;
export const useClient = clientQueries.useDetail;
export const useCheckClientReferences = clientQueries.useCheckReferences;
export const useSriSearchByRuc = clientQueries.useSriSearchByRuc;
export const useSriSearchByName = clientQueries.useSriSearchByName;
