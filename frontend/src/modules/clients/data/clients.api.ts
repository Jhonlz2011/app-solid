/**
 * clients.api.ts — Export generic API for clients
 */
import { api } from '@shared/lib/eden';
import { createEntityApi } from '@modules/entities/data/entities.api';

export const clientsApi = createEntityApi(api.api.clients);
export type ClientListItem = Awaited<ReturnType<typeof clientsApi.list>>['data'][number];
