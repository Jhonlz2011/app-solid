/**
 * clients.api.ts — Export generic API for clients + SRI methods
 */
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import { createEntityApi } from '@modules/entities/data/entities.api';

const baseApi = createEntityApi(api.api.clients);

export const clientsApi = {
    ...baseApi,
    
    // ─── SRI (Ecuador tax authority) ──────────────────────────────
    sriSearchByRuc: async (ruc: string) => {
        const { data, error } = await api.api.sri['by-ruc'].get({
            query: { q: ruc },
        });
        if (error) throwApiError(error);
        return data!;
    },

    sriSearchByName: async (name: string) => {
        const { data, error } = await api.api.sri['by-name'].get({
            query: { q: name },
        });
        if (error) throwApiError(error);
        return data!;
    },
};

export type ClientListItem = Awaited<ReturnType<typeof clientsApi.list>>['data'][number];
export type SriClientResponse = Awaited<ReturnType<typeof clientsApi.sriSearchByRuc>>[number];
