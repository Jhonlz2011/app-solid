import { api } from '@shared/lib/eden';
import { createEntityQueries } from '@modules/entities/data/entities.queries';
import { clientsApi } from './clients.api';
import { clientKeys } from './clients.keys';

export const clientQueries = createEntityQueries(clientsApi, clientKeys, api.clients.facets);

export const useClients = clientQueries.useList;
export const useInfiniteClients = clientQueries.useInfinite;
export const useClientFacets = clientQueries.useFacets;
export const useClient = clientQueries.useDetail;
export const useCheckClientReferences = clientQueries.useCheckReferences;
