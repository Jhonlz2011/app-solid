/**
 * auth.api.ts — Eden API fetchers for Auth module (ERP Tenant Provisioning & Domain Services)
 *
 * Session login & logout are handled natively by authClient (Better-Auth).
 */
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { AuthRegisterPayload } from '@app/schema/dto';

export const authApi = {
    register: async (payload: AuthRegisterPayload, signal?: AbortSignal) => {
        const { data, error } = await api.api.auth.register.post(payload, { fetch: { signal } });
        if (error) throwApiError(error);
        return data!;
    },

    checkSlug: async (slug: string) => {
        const { data, error } = await api.api.auth['check-slug']({ slug }).get();
        if (error) throwApiError(error);
        return data!;
    },

    checkRuc: async (ruc: string) => {
        const { data, error } = await api.api.auth['check-ruc']({ ruc }).get();
        if (error) throwApiError(error);
        return data!;
    },

    getTenantInfo: async (slug?: string) => {
        const { data, error } = await api.api.auth['tenant-info'].get({ query: { slug } });
        if (error) throwApiError(error);
        return data!;
    },
};