import { api } from '@shared/lib/eden';
import { createEntityMutations } from '@modules/entities/data/entities.mutations';
import { clientsApi } from './clients.api';
import { clientKeys } from './clients.keys';

export const clientMutations = createEntityMutations(clientsApi, clientKeys, api.api.clients);

export const useCreateClient = clientMutations.useCreate;
export const useUpdateClient = clientMutations.useUpdate;
export const useDeleteClient = clientMutations.useDelete;
export const useBulkDeleteClient = clientMutations.useBulkDelete;
export const useBulkRestoreClient = clientMutations.useBulkRestore;
export const useRestoreClient = clientMutations.useRestore;
export const useHardDeleteClient = clientMutations.useHardDelete;
